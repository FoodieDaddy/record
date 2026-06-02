package com.mahjong.score.service.impl;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mahjong.score.common.BizException;
import com.mahjong.score.common.PageResult;
import com.mahjong.score.dto.transfer.TransferReq;
import com.mahjong.score.dto.transfer.TransferResp;
import com.mahjong.score.entity.RoomMember;
import com.mahjong.score.entity.Session;
import com.mahjong.score.entity.Transfer;
import com.mahjong.score.entity.User;
import com.mahjong.score.mapper.RoomMemberMapper;
import com.mahjong.score.mapper.SessionMapper;
import com.mahjong.score.mapper.TransferMapper;
import com.mahjong.score.mapper.UserMapper;
import com.mahjong.score.service.OverviewService;
import com.mahjong.score.service.TransferService;
import com.mahjong.score.service.impl.ws.ScoreWebSocket;
import com.mahjong.score.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TransferServiceImpl implements TransferService {

    private static final String SESSION_PREFIX = "mj:session:";
    private static final String ROOM_PREFIX = "mj:room:";

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
        String activeSessionKey = ROOM_PREFIX + req.getRoomId() + ":active_session";
        String sessionIdStr = redisTemplate.opsForValue().get(activeSessionKey);
        Long sessionId = null;
        if (sessionIdStr != null) {
            sessionId = Long.parseLong(sessionIdStr);
        } else {
            // 降级查数据库
            Session session = sessionMapper.selectOne(
                    new LambdaQueryWrapper<Session>()
                            .eq(Session::getRoomId, req.getRoomId())
                            .eq(Session::getStatus, 0)
                            .last("LIMIT 1"));
            if (session != null) {
                sessionId = session.getId();
                // 缓存活跃场次 ID
                redisTemplate.opsForValue().set(activeSessionKey, String.valueOf(sessionId), 24, TimeUnit.HOURS);
            }
        }

        Transfer transfer = new Transfer();
        transfer.setId(idGenerator.nextId());
        transfer.setRoomId(req.getRoomId());
        transfer.setSessionId(sessionId != null ? sessionId : 0L);
        transfer.setFromUserId(userId);
        transfer.setToUserId(req.getToUserId());
        transfer.setAmount(req.getAmount());
        transfer.setRemark(req.getRemark());
        transfer.setStatus(0);
        transferMapper.insert(transfer);

        if (sessionId != null) {
            String sessionPrefix = SESSION_PREFIX + sessionId + ":";
            String scoresKey = sessionPrefix + "scores";

            // 更新排行榜
            redisTemplate.opsForZSet().incrementScore(scoresKey, String.valueOf(userId), -req.getAmount());
            redisTemplate.opsForZSet().incrementScore(scoresKey, String.valueOf(req.getToUserId()), req.getAmount());
            redisTemplate.expire(scoresKey, 24, TimeUnit.HOURS);

            // 写入批次数据（供折线图使用）
            long batchTs = System.currentTimeMillis();
            String batchKey = sessionPrefix + "batch:" + batchTs;
            String batchesKey = sessionPrefix + "batches";

            redisTemplate.opsForHash().put(batchKey, String.valueOf(userId), String.valueOf(-req.getAmount()));
            redisTemplate.opsForHash().put(batchKey, String.valueOf(req.getToUserId()), String.valueOf(req.getAmount()));
            redisTemplate.opsForHash().put(batchKey, "_created_by", String.valueOf(userId));
            redisTemplate.expire(batchKey, 24, TimeUnit.HOURS);

            redisTemplate.opsForList().rightPush(batchesKey, String.valueOf(batchTs));
            redisTemplate.expire(batchesKey, 24, TimeUnit.HOURS);
        }

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

        return buildResp(transfer);
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
                .map(id -> "mj:user:" + id)
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
        String fromKey = "mj:user:" + t.getFromUserId();
        String toKey = "mj:user:" + t.getToUserId();

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
