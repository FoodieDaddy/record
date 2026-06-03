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
import com.smartrecord.entity.Transfer;
import com.smartrecord.entity.User;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.SessionMapper;
import com.smartrecord.mapper.TransferMapper;
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

import java.time.LocalDateTime;
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
     * Lua 脚本：原子转账（扣分 + 加分 + 记录流水）
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

    private final TransferMapper transferMapper;
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
        // 不能给自己转账
        if (userId.equals(req.getToUserId())) {
            throw new BizException("不能给自己转账");
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

        // 组装流水 JSON（结算时批量落盘用）
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
                throw new BizException("转账失败，请重试");
            }
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lua 转账执行异常: roomId={}, from={}, to={}, amount={}",
                    req.getRoomId(), userId, req.getToUserId(), req.getAmount(), e);
            throw new BizException("系统繁忙，请稍后重试");
        }

        // 设置流水列表过期时间（每次续期 24h）
        redisTemplate.expire(eventsKey, 24, TimeUnit.HOURS);

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
                .status(0)
                .sessionId(sessionId)
                .createdAt(LocalDateTime.now())
                .build();
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

    @Override
    public List<TransferResp> getRoomTransfers(Long roomId) {
        List<Transfer> transfers = transferMapper.selectList(
                new LambdaQueryWrapper<Transfer>()
                        .eq(Transfer::getRoomId, roomId)
                        .orderByDesc(Transfer::getCreatedAt));

        Map<Long, User> userMap = batchLoadUsers(transfers);
        return transfers.stream()
                .map(t -> buildResp(t, userMap))
                .collect(Collectors.toList());
    }

    @Override
    public PageResult<TransferResp> getRoomTransfers(Long roomId, int page, int size) {
        return getRoomTransfers(roomId, null, page, size);
    }

    @Override
    public PageResult<TransferResp> getRoomTransfers(Long roomId, Long sessionId, int page, int size) {
        LambdaQueryWrapper<Transfer> wrapper = new LambdaQueryWrapper<Transfer>()
                .eq(Transfer::getRoomId, roomId);
        if (sessionId != null) {
            wrapper.eq(Transfer::getSessionId, sessionId);
        }
        long total = transferMapper.selectCount(wrapper);
        List<Transfer> transfers = transferMapper.selectList(
                wrapper.orderByDesc(Transfer::getCreatedAt)
                        .last("LIMIT " + size + " OFFSET " + (page - 1) * size));
        Map<Long, User> userMap = batchLoadUsers(transfers);
        List<TransferResp> records = transfers.stream()
                .map(t -> buildResp(t, userMap))
                .collect(Collectors.toList());
        return PageResult.of(total, records);
    }

    @Override
    public void revokeTransfer(Long userId, Long transferId) {
        Transfer transfer = transferMapper.selectById(transferId);
        if (transfer == null) throw new BizException("转账记录不存在");
        if (!transfer.getFromUserId().equals(userId)) throw new BizException("只有转账人可以撤回");
        if (transfer.getStatus() != 0) throw new BizException("该转账已撤回");

        // 5 分钟内可撤回
        LocalDateTime deadline = transfer.getCreatedAt().plusMinutes(5);
        if (LocalDateTime.now().isAfter(deadline)) {
            throw new BizException("超过 5 分钟无法撤回");
        }

        transfer.setStatus(1);
        transferMapper.updateById(transfer);
    }

    /**
     * 批量预加载 transfer 列表中涉及的所有用户信息，避免 N+1 查询
     */
    private Map<Long, User> batchLoadUsers(List<Transfer> transfers) {
        Set<Long> userIds = new HashSet<>();
        for (Transfer t : transfers) {
            userIds.add(t.getFromUserId());
            userIds.add(t.getToUserId());
        }
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

    private TransferResp buildResp(Transfer t, Map<Long, User> userMap) {
        User from = userMap.get(t.getFromUserId());
        User to = userMap.get(t.getToUserId());
        String fromNickname = from != null ? from.getNickname() : "";
        String fromAvatarUrl = from != null ? from.getAvatarUrl() : "";
        String toNickname = to != null ? to.getNickname() : "";
        String toAvatarUrl = to != null ? to.getAvatarUrl() : "";

        return TransferResp.builder()
                .id(t.getId())
                .fromUser(TransferResp.UserInfo.builder()
                        .userId(t.getFromUserId())
                        .nickname(fromNickname)
                        .avatarUrl(fromAvatarUrl)
                        .build())
                .toUser(TransferResp.UserInfo.builder()
                        .userId(t.getToUserId())
                        .nickname(toNickname)
                        .avatarUrl(toAvatarUrl)
                        .build())
                .amount(t.getAmount())
                .amountDisplay(String.format("%.2f", t.getAmount() / 100.0))
                .remark(t.getRemark())
                .status(t.getStatus())
                .sessionId(t.getSessionId())
                .createdAt(t.getCreatedAt())
                .build();
    }

    private TransferResp buildResp(Transfer t) {
        // 从 Redis 缓存获取用户信息
        String fromKey = "sr:user:" + t.getFromUserId();
        String toKey = "sr:user:" + t.getToUserId();

        String fromJson = redisTemplate.opsForValue().get(fromKey);
        String toJson = redisTemplate.opsForValue().get(toKey);

        String fromNickname = "";
        String fromAvatarUrl = "";
        String toNickname = "";
        String toAvatarUrl = "";

        if (fromJson != null) {
            JSONObject fromObj = JSONUtil.parseObj(fromJson);
            fromNickname = fromObj.getStr("nickname", "");
            fromAvatarUrl = fromObj.getStr("avatarUrl", "");
        } else {
            User from = userMapper.selectById(t.getFromUserId());
            if (from != null) {
                fromNickname = from.getNickname();
                fromAvatarUrl = from.getAvatarUrl();
            }
        }

        if (toJson != null) {
            JSONObject toObj = JSONUtil.parseObj(toJson);
            toNickname = toObj.getStr("nickname", "");
            toAvatarUrl = toObj.getStr("avatarUrl", "");
        } else {
            User to = userMapper.selectById(t.getToUserId());
            if (to != null) {
                toNickname = to.getNickname();
                toAvatarUrl = to.getAvatarUrl();
            }
        }

        return TransferResp.builder()
                .id(t.getId())
                .fromUser(TransferResp.UserInfo.builder()
                        .userId(t.getFromUserId())
                        .nickname(fromNickname)
                        .avatarUrl(fromAvatarUrl)
                        .build())
                .toUser(TransferResp.UserInfo.builder()
                        .userId(t.getToUserId())
                        .nickname(toNickname)
                        .avatarUrl(toAvatarUrl)
                        .build())
                .amount(t.getAmount())
                .amountDisplay(String.format("%.2f", t.getAmount() / 100.0))
                .remark(t.getRemark())
                .status(t.getStatus())
                .sessionId(t.getSessionId())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
