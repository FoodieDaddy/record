package com.smartrecord.service.impl;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.common.PageResult;
import com.smartrecord.dto.transfer.TransferReq;
import com.smartrecord.dto.transfer.TransferResp;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.entity.Session;
import com.smartrecord.entity.User;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.SessionMapper;
import com.smartrecord.mapper.UserMapper;
import com.smartrecord.service.OverviewService;
import com.smartrecord.service.TransferService;
import com.smartrecord.service.impl.ws.ScoreWebSocket;
import com.smartrecord.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TransferServiceImpl implements TransferService {

    private static final String SESSION_PREFIX = "sr:session:";
    private static final String ROOM_PREFIX = "sr:room:";

    /**
     * Lua 脚本：原子计分（扣分 + 加分 + 记录流水）
     * KEYS[1] = 排行榜 Sorted Set (sr:session:{sid}:scores)
     * KEYS[2] = 流水 List (sr:session:{sid}:events)
     * ARGV[1] = fromUserId, ARGV[2] = toUserId
     * ARGV[3] = amount, ARGV[4] = eventJson
     * 返回 1 表示成功
     */
    private static final String TRANSFER_LUA = """
            local scoresKey = KEYS[1]
            local eventsKey = KEYS[2]
            local fromUser = ARGV[1]
            local toUser = ARGV[2]
            local amount = tonumber(ARGV[3])
            local eventJson = ARGV[4]
            redis.call('ZINCRBY', scoresKey, -amount, fromUser)
            redis.call('ZINCRBY', scoresKey, amount, toUser)
            redis.call('RPUSH', eventsKey, eventJson)
            return 1
            """;

    private static final DefaultRedisScript<Long> TRANSFER_SCRIPT = new DefaultRedisScript<>(TRANSFER_LUA, Long.class);

    private final RoomMemberMapper roomMemberMapper;
    private final SessionMapper sessionMapper;
    private final UserMapper userMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final StringRedisTemplate redisTemplate;
    private final ScoreWebSocket scoreWebSocket;

    @Lazy
    @Autowired
    private OverviewService overviewService;

    @Override
    public TransferResp transfer(Long userId, TransferReq req) {
        // 不能给自己计分
        if (userId.equals(req.getToUserId())) {
            throw new BizException("不能给自己计分");
        }

        // 从 Redis 缓存验证双方都是房间成员
        String membersKey = ROOM_PREFIX + req.getRoomId() + ":members";
        Boolean isFromMember = redisTemplate.opsForHash().hasKey(membersKey, String.valueOf(userId));
        Boolean isToMember = redisTemplate.opsForHash().hasKey(membersKey, String.valueOf(req.getToUserId()));

        if (!Boolean.TRUE.equals(isFromMember) || !Boolean.TRUE.equals(isToMember)) {
            throw new BizException("双方必须都是房间成员");
        }

        // 从 Redis 缓存获取活跃场次 ID
        Long sessionId = resolveActiveSessionId(req.getRoomId());
        if (sessionId == null) {
            throw new BizException("当前没有进行中的场次");
        }

        // 组装流水 JSON
        long now = System.currentTimeMillis();
        String eventJson = String.format("{\"from\":%d,\"to\":%d,\"amount\":%d,\"time\":%d,\"remark\":\"%s\"}",
                userId, req.getToUserId(), req.getAmount(), now,
                req.getRemark() != null ? req.getRemark() : "");

        // 执行 Lua 脚本：原子完成 扣分 + 加分 + 记录流水
        String scoresKey = SESSION_PREFIX + sessionId + ":scores";
        String eventsKey = SESSION_PREFIX + sessionId + ":events";
        try {
            Long result = redisTemplate.execute(TRANSFER_SCRIPT,
                    List.of(scoresKey, eventsKey),
                    String.valueOf(userId),
                    String.valueOf(req.getToUserId()),
                    String.valueOf(req.getAmount()),
                    eventJson);
            if (result == null || result == 0) {
                throw new BizException("计分失败，请重试");
            }
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lua 计分执行异常: roomId={}, from={}, to={}, amount={}",
                    req.getRoomId(), userId, req.getToUserId(), req.getAmount(), e);
            throw new BizException("系统繁忙，请稍后重试");
        }

        // 更新最后活跃时间（供幽灵对局清扫器判断）
        redisTemplate.opsForValue().set(
                SESSION_PREFIX + sessionId + ":last_active",
                LocalDateTime.now().toString(), 48, TimeUnit.HOURS);

        // WebSocket 推送给房间内所有玩家（ID 转字符串，避免 JS 精度丢失）
        Map<String, Object> pushData = new HashMap<>();
        pushData.put("type", "TRANSFER");
        pushData.put("roomId", String.valueOf(req.getRoomId()));
        pushData.put("fromUserId", String.valueOf(userId));
        pushData.put("toUserId", String.valueOf(req.getToUserId()));
        pushData.put("amount", req.getAmount());
        scoreWebSocket.pushToRoom(String.valueOf(req.getRoomId()), pushData);

        // 异步更新总览缓存
        overviewService.computeOverview(req.getRoomId());

        return TransferResp.builder()
                .id(now)
                .fromUser(TransferResp.UserInfo.builder().userId(userId).build())
                .toUser(TransferResp.UserInfo.builder().userId(req.getToUserId()).build())
                .amount(req.getAmount())
                .amountDisplay(String.format("%.2f", req.getAmount() / 100.0))
                .remark(req.getRemark())
                .sessionId(sessionId)
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Override
    public PageResult<TransferResp> getRoomTransfers(Long roomId, int page, int size) {
        return getRoomTransfers(roomId, null, page, size);
    }

    @Override
    public PageResult<TransferResp> getRoomTransfers(Long roomId, Long sessionId, int page, int size) {
        // 1. 查 session 表获取该房间的 sessionId 列表
        LambdaQueryWrapper<Session> wrapper = new LambdaQueryWrapper<Session>()
                .eq(Session::getRoomId, roomId);
        if (sessionId != null) {
            wrapper.eq(Session::getId, sessionId);
        }
        wrapper.orderByDesc(Session::getCreatedAt);
        List<Session> sessions = sessionMapper.selectList(wrapper);
        if (sessions.isEmpty()) {
            return PageResult.of(0, List.of());
        }

        // 2. 批量读取 Redis events
        List<JSONObject> allEvents = new ArrayList<>();
        for (Session s : sessions) {
            String eventsKey = SESSION_PREFIX + s.getId() + ":events";
            List<String> rawEvents = redisTemplate.opsForList().range(eventsKey, 0, -1);
            if (rawEvents == null) continue;
            for (String raw : rawEvents) {
                try {
                    JSONObject obj = JSONUtil.parseObj(raw);
                    obj.set("_sessionId", s.getId());
                    allEvents.add(obj);
                } catch (Exception e) {
                    log.warn("解析计分流水失败: {}", raw, e);
                }
            }
        }

        // 3. 按时间倒序
        allEvents.sort((a, b) -> Long.compare(
                b.getLong("time", 0L), a.getLong("time", 0L)));

        long total = allEvents.size();

        // 4. 分页截取
        int from = (page - 1) * size;
        int to = Math.min(from + size, allEvents.size());
        List<JSONObject> pageEvents = from < allEvents.size()
                ? allEvents.subList(from, to) : List.of();

        // 5. 批量加载用户信息
        Set<Long> userIds = new HashSet<>();
        for (JSONObject e : pageEvents) {
            userIds.add(e.getLong("from"));
            userIds.add(e.getLong("to"));
        }
        Map<Long, User> userMap = batchLoadUsersByIds(userIds);

        // 6. 组装响应
        List<TransferResp> records = pageEvents.stream().map(e -> {
            Long fromId = e.getLong("from");
            Long toId = e.getLong("to");
            User fromUser = userMap.get(fromId);
            User toUser = userMap.get(toId);
            int amount = e.getInt("amount");
            long ts = e.getLong("time", 0L);
            return TransferResp.builder()
                    .id(ts)
                    .sessionId(e.getLong("_sessionId"))
                    .fromUser(TransferResp.UserInfo.builder()
                            .userId(fromId)
                            .nickname(fromUser != null ? fromUser.getNickname() : "")
                            .avatarUrl(fromUser != null ? fromUser.getAvatarUrl() : "")
                            .build())
                    .toUser(TransferResp.UserInfo.builder()
                            .userId(toId)
                            .nickname(toUser != null ? toUser.getNickname() : "")
                            .avatarUrl(toUser != null ? toUser.getAvatarUrl() : "")
                            .build())
                    .amount(amount)
                    .amountDisplay(String.format("%.2f", amount / 100.0))
                    .remark(e.getStr("remark", ""))
                    .createdAt(LocalDateTime.ofInstant(Instant.ofEpochMilli(ts), ZoneId.systemDefault()))
                    .build();
        }).collect(Collectors.toList());

        return PageResult.of(total, records);
    }

    /**
     * 从 Redis 获取房间活跃场次 ID，未命中则降级查 MySQL 并回填
     */
    private Long resolveActiveSessionId(Long roomId) {
        String activeSessionKey = ROOM_PREFIX + roomId + ":active_session";
        String sessionIdStr = redisTemplate.opsForValue().get(activeSessionKey);
        if (sessionIdStr != null) {
            return Long.parseLong(sessionIdStr);
        }
        // 降级查数据库
        Session session = sessionMapper.selectOne(
                new LambdaQueryWrapper<Session>()
                        .eq(Session::getRoomId, roomId)
                        .eq(Session::getStatus, 0)
                        .last("LIMIT 1"));
        if (session != null) {
            redisTemplate.opsForValue().set(activeSessionKey, String.valueOf(session.getId()), 24, TimeUnit.HOURS);
            return session.getId();
        }
        return null;
    }

    /**
     * 批量加载用户信息（Redis 缓存优先，未命中查 MySQL）
     */
    private Map<Long, User> batchLoadUsersByIds(Set<Long> userIds) {
        if (userIds.isEmpty()) return Collections.emptyMap();

        List<String> keys = userIds.stream()
                .map(id -> "sr:user:" + id)
                .collect(Collectors.toList());
        List<String> cached = redisTemplate.opsForValue().multiGet(keys);

        Map<Long, User> userMap = new HashMap<>();
        List<Long> missedIds = new ArrayList<>();
        List<Long> idList = new ArrayList<>(userIds);

        for (int i = 0; i < idList.size(); i++) {
            String json = cached != null ? cached.get(i) : null;
            if (json != null) {
                JSONObject obj = JSONUtil.parseObj(json);
                User u = new User();
                u.setId(idList.get(i));
                u.setNickname(obj.getStr("nickname", ""));
                u.setAvatarUrl(obj.getStr("avatarUrl", ""));
                userMap.put(idList.get(i), u);
            } else {
                missedIds.add(idList.get(i));
            }
        }

        if (!missedIds.isEmpty()) {
            List<User> users = userMapper.selectBatchIds(missedIds);
            for (User u : users) {
                userMap.put(u.getId(), u);
            }
        }
        return userMap;
    }
}
