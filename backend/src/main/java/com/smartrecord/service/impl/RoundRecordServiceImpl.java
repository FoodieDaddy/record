package com.smartrecord.service.impl;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.common.ErrorCode;
import com.smartrecord.enums.EmotionType;
import com.smartrecord.dto.round.ConfirmRoundReq;
import com.smartrecord.dto.round.RoundRecordResp;
import com.smartrecord.dto.round.SubmitRoundReq;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.entity.RoundRecord;
import com.smartrecord.entity.RoundRecordDetail;
import com.smartrecord.entity.User;
import com.smartrecord.enums.RoundInputMethod;
import com.smartrecord.enums.RoundRecordStatus;
import com.smartrecord.enums.ScoreMode;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.RoundRecordDetailMapper;
import com.smartrecord.mapper.RoundRecordMapper;
import com.smartrecord.mapper.UserMapper;
import com.smartrecord.service.EmotionAudioPool;
import com.smartrecord.service.OverviewService;
import com.smartrecord.service.RoundRecordService;
import com.smartrecord.service.SubscribeMessageService;
import com.smartrecord.service.impl.ws.ScoreWebSocket;
import com.smartrecord.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoundRecordServiceImpl implements RoundRecordService {

    private final RoomMapper roomMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final RoundRecordMapper roundRecordMapper;
    private final RoundRecordDetailMapper roundRecordDetailMapper;
    private final UserMapper userMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final StringRedisTemplate redisTemplate;
    private final RedissonClient redissonClient;
    private final ScoreWebSocket scoreWebSocket;
    private final EmotionAudioPool emotionAudioPool;
    private final OverviewService overviewService;
    private final SubscribeMessageService subscribeMessageService;
    @Qualifier("asyncExecutor")
    private final Executor asyncExecutor;

    private static final String ROOM_PREFIX = "sr:room:";
    private static final int ROOM_EXPIRE_HOURS = 24;
    private static final String SCORE_PREFIX = "score:";
    private static final String CONFIRM_PREFIX = "confirm:";

    /** 房间合并数据 Hash（meta + overview + round + roundConfig + qr） */
    private String roomDataKey(Long roomId) { return ROOM_PREFIX + roomId + ":data"; }
    /** 轮次得分/确认数据 Hash */
    private String roundDataKey(Long roomId) { return ROOM_PREFIX + roomId + ":round:data"; }

    @Override
    public RoundRecordResp startRound(Long userId, Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) throw new BizException(ErrorCode.ROOM_NOT_FOUND);
        if (ScoreMode.ROUND_RECORD.getCode() != (room.getScoreMode() != null ? room.getScoreMode() : 1)) {
            throw new BizException(ErrorCode.ROUND_FREE_FLOW_NOT_SUPPORTED);
        }
        if (!room.getOwnerId().equals(userId)) throw new BizException(ErrorCode.NOT_OWNER_START_ROUND);

        String lockKey = ROOM_PREFIX + roomId + ":lock";
        RLock lock = redissonClient.getLock(lockKey);
        try {
            if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                throw new BizException(ErrorCode.SYSTEM_BUSY);
            }

            // 检查是否有待处理录
            if (redisTemplate.opsForHash().hasKey(roomDataKey(roomId), "round:id")) {
                throw new BizException(ErrorCode.ROUND_ALREADY_PENDING);
            }

            int inputMethod = room.getRoundInputMethod() != null ? room.getRoundInputMethod() : 1;
            int trustMode = room.getTrustMode() != null ? room.getTrustMode() : 1;
            int zeroSum = room.getZeroSumRequired() != null ? room.getZeroSumRequired() : 1;

            long roundId = idGenerator.nextId();
            int status;
            if (inputMethod == RoundInputMethod.HOST_FILL.getCode()) {
                status = trustMode == 1
                        ? RoundRecordStatus.PENDING_CONFIRM.getCode()
                        : RoundRecordStatus.PENDING_CONFIRM.getCode();
            } else {
                status = RoundRecordStatus.PENDING_MEMBER_INPUT.getCode();
            }

            // 写入 data Hash 的 round 字段
            Map<String, String> roundFields = new HashMap<>();
            roundFields.put("round:id", String.valueOf(roundId));
            roundFields.put("round:status", String.valueOf(status));
            roundFields.put("round:inputMethod", String.valueOf(inputMethod));
            roundFields.put("round:trustMode", String.valueOf(trustMode));
            roundFields.put("round:zeroSumRequired", String.valueOf(zeroSum));
            roundFields.put("round:createdBy", String.valueOf(userId));
            roundFields.put("round:totalScore", "0");
            roundFields.put("round:createdAt", String.valueOf(System.currentTimeMillis()));

            // 从 data Hash 读取轮次配置
            String autoSeconds = (String) redisTemplate.opsForHash().get(roomDataKey(roomId), "roundConfig:autoTimeoutSeconds");
            String autoAction = (String) redisTemplate.opsForHash().get(roomDataKey(roomId), "roundConfig:autoTimeoutAction");
            roundFields.put("round:autoTimeoutSeconds", autoSeconds != null ? autoSeconds : "30");
            roundFields.put("round:autoTimeoutAction", autoAction != null ? autoAction : "1");

            redisTemplate.opsForHash().putAll(roomDataKey(roomId), roundFields);
            redisTemplate.expire(roomDataKey(roomId), ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

            // 初始化 round:data Hash TTL
            redisTemplate.expire(roundDataKey(roomId), ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

            // 广播 ROUND_STARTED
            RoundRecordResp resp = buildRespFromRedis(roomId, room);
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "ROUND_STARTED");
            pushData.put("round", resp);
            scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);

            // 发送订阅消息给离线用户（记分提醒）
            sendScoreReminderToOfflineUsers(roomId, room);

            // 信任关闭时启动超时监控
            if (trustMode == 0) {
                startTimeoutMonitor(roomId, roundId, status);
            }

            return resp;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException(ErrorCode.OPERATION_INTERRUPTED);
        } finally {
            if (lock.isHeldByCurrentThread()) lock.unlock();
        }
    }

    @Override
    public RoundRecordResp submitRound(Long userId, SubmitRoundReq req) {
        Long roomId = req.getRoomId();
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) throw new BizException(ErrorCode.ROOM_NOT_FOUND);

        String lockKey = ROOM_PREFIX + roomId + ":lock";
        RLock lock = redissonClient.getLock(lockKey);
        try {
            if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                throw new BizException(ErrorCode.SYSTEM_BUSY);
            }

            // 检查 round 存在
            String roundIdVal = (String) redisTemplate.opsForHash().get(roomDataKey(roomId), "round:id");
            if (roundIdVal == null) throw new BizException(ErrorCode.ROUND_EXPIRED);

            int status = Integer.parseInt((String) redisTemplate.opsForHash().get(roomDataKey(roomId), "round:status"));
            int inputMethod = Integer.parseInt((String) redisTemplate.opsForHash().get(roomDataKey(roomId), "round:inputMethod"));
            int trustMode = Integer.parseInt((String) redisTemplate.opsForHash().get(roomDataKey(roomId), "round:trustMode"));
            int zeroSum = Integer.parseInt((String) redisTemplate.opsForHash().get(roomDataKey(roomId), "round:zeroSumRequired"));
            long createdBy = Long.parseLong((String) redisTemplate.opsForHash().get(roomDataKey(roomId), "round:createdBy"));

            if (inputMethod == RoundInputMethod.HOST_FILL.getCode()) {
                // 房主填写
                if (!room.getOwnerId().equals(userId)) throw new BizException(ErrorCode.NOT_OWNER_FILL_SCORE);
                if (status != RoundRecordStatus.PENDING_CONFIRM.getCode()) {
                    throw new BizException(ErrorCode.ROUND_INVALID_STATE);
                }

                // 写入 round:data（score: 前缀）
                int totalScore = 0;
                Map<String, String> scoreFields = new HashMap<>();
                for (SubmitRoundReq.PlayerScore ps : req.getScores()) {
                    scoreFields.put(SCORE_PREFIX + ps.getUserId(), String.valueOf(ps.getScore()));
                    totalScore += ps.getScore();
                }

                // 零和校验
                if (zeroSum == 1 && totalScore != 0) {
                    throw new BizException(ErrorCode.ROUND_SCORE_ZERO_SUM);
                }

                redisTemplate.opsForHash().putAll(roundDataKey(roomId), scoreFields);
                redisTemplate.opsForHash().put(roomDataKey(roomId), "round:totalScore", String.valueOf(totalScore));

                if (trustMode == 1) {
                    // 信任开启：直接生效
                    return applyRound(roomId, room);
                } else {
                    // 信任关闭：广播等待确认
                    RoundRecordResp resp = buildRespFromRedis(roomId, room);
                    Map<String, Object> pushData = new HashMap<>();
                    pushData.put("type", "ROUND_STARTED");
                    pushData.put("round", resp);
                    scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);

                    // 发送订阅消息给离线用户（记分提醒）
                    sendScoreReminderToOfflineUsers(roomId, room);

                    return resp;
                }

            } else {
                // 成员自填
                if (status != RoundRecordStatus.PENDING_MEMBER_INPUT.getCode()) {
                    throw new BizException(ErrorCode.ROUND_INVALID_STATE);
                }

                // 校验用户是房间成员
                boolean isMember = roomMemberMapper.selectCount(
                        new LambdaQueryWrapper<RoomMember>()
                                .eq(RoomMember::getRoomId, roomId)
                                .eq(RoomMember::getUserId, userId)) > 0;
                if (!isMember) throw new BizException(ErrorCode.NOT_ROOM_MEMBER);

                // 成员只填自己的分数
                Integer myScore = null;
                for (SubmitRoundReq.PlayerScore ps : req.getScores()) {
                    if (ps.getUserId().equals(userId)) {
                        myScore = ps.getScore();
                        break;
                    }
                }
                if (myScore == null) throw new BizException(ErrorCode.ROUND_INVALID_STATE);

                // 写入 round:data（score: 前缀）
                redisTemplate.opsForHash().put(roundDataKey(roomId), SCORE_PREFIX + userId, String.valueOf(myScore));

                // 检查是否全员提交（只统计 score: 前缀字段）
                long memberCount = roomMemberMapper.selectCount(
                        new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
                long submittedCount = countScoreEntries(roomId);

                // 广播进度
                Map<String, Object> progressData = new HashMap<>();
                progressData.put("type", "ROUND_MEMBER_SUBMITTED");
                progressData.put("userId", String.valueOf(userId));
                progressData.put("submitted", submittedCount);
                progressData.put("total", memberCount);
                scoreWebSocket.pushToRoom(String.valueOf(roomId), progressData);

                if (submittedCount < memberCount) {
                    // 还有人未提交
                    return buildRespFromRedis(roomId, room);
                }

                // 全员提交：从 round:data 读取所有 score: 字段汇总
                Map<String, String> scoreEntries = getScoreEntries(roomId);
                int totalScore = 0;
                for (String val : scoreEntries.values()) {
                    totalScore += Integer.parseInt(val);
                }

                // 零和校验
                if (zeroSum == 1 && totalScore != 0) {
                    throw new BizException(ErrorCode.ROUND_SCORE_ZERO_SUM);
                }

                redisTemplate.opsForHash().put(roomDataKey(roomId), "round:totalScore", String.valueOf(totalScore));

                if (trustMode == 1) {
                    // 信任开启：直接生效
                    return applyRound(roomId, room);
                } else {
                    // 信任关闭：进入确认阶段
                    redisTemplate.opsForHash().put(roomDataKey(roomId), "round:status",
                            String.valueOf(RoundRecordStatus.PENDING_CONFIRM.getCode()));
                    RoundRecordResp resp = buildRespFromRedis(roomId, room);
                    Map<String, Object> pushData = new HashMap<>();
                    pushData.put("type", "ROUND_STARTED");
                    pushData.put("round", resp);
                    scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);

                    // 发送订阅消息给离线用户（记分提醒）
                    sendScoreReminderToOfflineUsers(roomId, room);

                    return resp;
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException(ErrorCode.OPERATION_INTERRUPTED);
        } finally {
            if (lock.isHeldByCurrentThread()) lock.unlock();
        }
    }

    @Override
    public RoundRecordResp confirmRound(Long userId, ConfirmRoundReq req) {
        Long roomId = req.getRoomId();
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) throw new BizException(ErrorCode.ROOM_NOT_FOUND);

        String lockKey = ROOM_PREFIX + roomId + ":lock";
        RLock lock = redissonClient.getLock(lockKey);
        try {
            if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                throw new BizException(ErrorCode.SYSTEM_BUSY);
            }

            String roundIdVal = (String) redisTemplate.opsForHash().get(roomDataKey(roomId), "round:id");
            if (roundIdVal == null) throw new BizException(ErrorCode.ROUND_EXPIRED);

            int status = Integer.parseInt((String) redisTemplate.opsForHash().get(roomDataKey(roomId), "round:status"));
            if (status != RoundRecordStatus.PENDING_CONFIRM.getCode()) {
                throw new BizException(ErrorCode.ROUND_CONFIRM_INVALID_STATE);
            }

            // 校验用户是房间成员
            boolean isMember = roomMemberMapper.selectCount(
                    new LambdaQueryWrapper<RoomMember>()
                            .eq(RoomMember::getRoomId, roomId)
                            .eq(RoomMember::getUserId, userId)) > 0;
            if (!isMember) throw new BizException(ErrorCode.NOT_ROOM_MEMBER);

            if (Boolean.FALSE.equals(req.getAgree())) {
                // 驳回
                Map<String, String> rejectFields = new HashMap<>();
                rejectFields.put("round:status", String.valueOf(RoundRecordStatus.REJECTED.getCode()));
                rejectFields.put("round:rejectedBy", String.valueOf(userId));
                redisTemplate.opsForHash().putAll(roomDataKey(roomId), rejectFields);

                // 广播 ROUND_REJECTED
                Map<String, Object> pushData = new HashMap<>();
                pushData.put("type", "ROUND_REJECTED");
                pushData.put("roundId", roundIdVal);
                pushData.put("rejectedBy", String.valueOf(userId));
                scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);

                // 清理 round keys（延迟）
                scheduleRoundCleanup(roomId, 60);
                return buildRespFromRedis(roomId, room);
            }

            // 同意：记录确认（confirm: 前缀写入 round:data）
            redisTemplate.opsForHash().put(roundDataKey(roomId), CONFIRM_PREFIX + userId, "1");

            // 检查是否全员确认
            long memberCount = roomMemberMapper.selectCount(
                    new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
            long confirmCount = countConfirmEntries(roomId);

            // 广播确认进度
            Map<String, Object> progressData = new HashMap<>();
            progressData.put("type", "ROUND_CONFIRM_PROGRESS");
            progressData.put("userId", String.valueOf(userId));
            progressData.put("confirmCount", confirmCount);
            progressData.put("total", memberCount);
            scoreWebSocket.pushToRoom(String.valueOf(roomId), progressData);

            if (confirmCount >= memberCount) {
                // 全员确认：生效
                return applyRound(roomId, room);
            }

            return buildRespFromRedis(roomId, room);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException(ErrorCode.OPERATION_INTERRUPTED);
        } finally {
            if (lock.isHeldByCurrentThread()) lock.unlock();
        }
    }

    @Override
    public void cancelRound(Long userId, Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException(ErrorCode.ROOM_NOT_FOUND);
        if (!room.getOwnerId().equals(userId)) throw new BizException(ErrorCode.NOT_OWNER_CANCEL);

        String lockKey = ROOM_PREFIX + roomId + ":lock";
        RLock lock = redissonClient.getLock(lockKey);
        try {
            if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                throw new BizException(ErrorCode.SYSTEM_BUSY);
            }

            String roundId = (String) redisTemplate.opsForHash().get(roomDataKey(roomId), "round:id");
            if (roundId == null) {
                throw new BizException(ErrorCode.ROUND_NOT_FOUND);
            }
            deleteRoundKeys(roomId);

            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "ROUND_CANCELLED");
            pushData.put("roundId", roundId);
            scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException(ErrorCode.OPERATION_INTERRUPTED);
        } finally {
            if (lock.isHeldByCurrentThread()) lock.unlock();
        }
    }

    @Override
    public RoundRecordResp getPending(Long roomId) {
        if (!redisTemplate.opsForHash().hasKey(roomDataKey(roomId), "round:id")) {
            return null;
        }
        Room room = roomMapper.selectById(roomId);
        if (room == null) return null;
        return buildRespFromRedis(roomId, room);
    }

    // ===== 内部方法 =====

    private RoundRecordResp applyRound(Long roomId, Room room) {
        String rdk = roomDataKey(roomId);
        long roundId = Long.parseLong((String) redisTemplate.opsForHash().get(rdk, "round:id"));
        int inputMethod = Integer.parseInt((String) redisTemplate.opsForHash().get(rdk, "round:inputMethod"));
        int trustMode = Integer.parseInt((String) redisTemplate.opsForHash().get(rdk, "round:trustMode"));
        int zeroSum = Integer.parseInt((String) redisTemplate.opsForHash().get(rdk, "round:zeroSumRequired"));
        long createdBy = Long.parseLong((String) redisTemplate.opsForHash().get(rdk, "round:createdBy"));
        int totalScore = Integer.parseInt((String) redisTemplate.opsForHash().get(rdk, "round:totalScore"));
        long createdAtMs = Long.parseLong((String) redisTemplate.opsForHash().get(rdk, "round:createdAt"));

        // 读取 score: 字段
        Map<String, String> scoreEntries = getScoreEntries(roomId);

        // 写入 MySQL
        RoundRecord record = new RoundRecord();
        record.setId(roundId);
        record.setRoomId(roomId);
        record.setStatus(RoundRecordStatus.APPLIED.getCode());
        record.setInputMethod(inputMethod);
        record.setTrustMode(trustMode);
        record.setZeroSumRequired(zeroSum);
        record.setCreatedBy(createdBy);
        record.setTotalScore(totalScore);
        record.setAppliedAt(LocalDateTime.now());
        record.setCreatedAt(LocalDateTime.ofInstant(Instant.ofEpochMilli(createdAtMs), ZoneId.systemDefault()));
        roundRecordMapper.insert(record);

        for (Map.Entry<String, String> entry : scoreEntries.entrySet()) {
            RoundRecordDetail detail = new RoundRecordDetail();
            detail.setId(idGenerator.nextId());
            detail.setRoundRecordId(roundId);
            detail.setUserId(Long.parseLong(entry.getKey()));
            detail.setScore(Integer.parseInt(entry.getValue()));
            roundRecordDetailMapper.insert(detail);
        }

        // 更新 Redis 排行榜
        String scoresKey = ROOM_PREFIX + roomId + ":scores";
        for (Map.Entry<String, String> entry : scoreEntries.entrySet()) {
            int score = Integer.parseInt(entry.getValue());
            if (score != 0) {
                redisTemplate.opsForZSet().incrementScore(scoresKey, entry.getKey(), score);
            }
        }

        // 更新房间 lastActiveAt
        roomMapper.update(null, new LambdaUpdateWrapper<Room>()
                .eq(Room::getId, roomId)
                .eq(Room::getStatus, 0)
                .set(Room::getLastActiveAt, LocalDateTime.now()));

        // 删除 round 相关 key
        deleteRoundKeys(roomId);

        // 生成情绪音频
        Map<String, Object> scoresWithEmotion = new HashMap<>();
        List<Map<String, Object>> scoreList = new ArrayList<>();
        for (Map.Entry<String, String> entry : scoreEntries.entrySet()) {
            long uid = Long.parseLong(entry.getKey());
            int score = Integer.parseInt(entry.getValue());
            Map<String, Object> item = new HashMap<>();
            item.put("userId", uid);
            item.put("score", score);
            EmotionType emotion = score > 0 ? EmotionType.WIN : score < 0 ? EmotionType.LOSE : null;
            if (emotion != null) {
                item.put("emotionAudioUrl", emotionAudioPool.randomUrl(emotion));
            }
            scoreList.add(item);
        }

        // 广播 ROUND_APPLIED
        Map<String, Object> pushData = new HashMap<>();
        pushData.put("type", "ROUND_APPLIED");
        pushData.put("roundId", roundId);
        pushData.put("scores", scoreList);
        scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);

        // 异步更新总览缓存
        overviewService.computeOverview(roomId);

        // 刷新房间 TTL
        redisTemplate.expire(roomDataKey(roomId), ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
        redisTemplate.expire(ROOM_PREFIX + roomId + ":scores", ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        return RoundRecordResp.builder()
                .id(roundId)
                .roomId(roomId)
                .status(RoundRecordStatus.APPLIED.getCode())
                .inputMethod(inputMethod)
                .trustMode(trustMode)
                .zeroSumRequired(zeroSum)
                .createdBy(createdBy)
                .totalScore(totalScore)
                .createdAt(record.getCreatedAt())
                .build();
    }

    private void deleteRoundKeys(Long roomId) {
        // 从 data Hash 中删除 round 相关字段
        String rdk = roomDataKey(roomId);
        Map<Object, Object> allFields = redisTemplate.opsForHash().entries(rdk);
        List<String> roundFields = new ArrayList<>();
        for (Object field : allFields.keySet()) {
            if (((String) field).startsWith("round:")) {
                roundFields.add((String) field);
            }
        }
        if (!roundFields.isEmpty()) {
            redisTemplate.opsForHash().delete(rdk, roundFields.toArray());
        }
        // 删除轮次得分/确认数据
        redisTemplate.delete(roundDataKey(roomId));
    }

    private void scheduleRoundCleanup(Long roomId, int delaySeconds) {
        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(delaySeconds * 1000L);
                // 只清理 REJECTED 状态的，不清理已手动取消或已生效的
                String status = (String) redisTemplate.opsForHash().get(roomDataKey(roomId), "round:status");
                if (status != null && Integer.parseInt(status) == RoundRecordStatus.REJECTED.getCode()) {
                    deleteRoundKeys(roomId);
                }
            } catch (Exception e) {
                log.warn("清理 round key 失败: roomId={}", roomId, e);
            }
        }, asyncExecutor);
    }

    private void startTimeoutMonitor(Long roomId, long roundId, int expectedStatus) {
        // 读取超时设置
        String secondsStr = (String) redisTemplate.opsForHash().get(roomDataKey(roomId), "round:autoTimeoutSeconds");
        String actionStr = (String) redisTemplate.opsForHash().get(roomDataKey(roomId), "round:autoTimeoutAction");
        int timeoutSeconds = secondsStr != null ? Integer.parseInt(secondsStr) : 30;
        int timeoutAction = actionStr != null ? Integer.parseInt(actionStr) : 1;

        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(timeoutSeconds * 1000L);

                // 原子检查状态
                String currentStatus = (String) redisTemplate.opsForHash().get(roomDataKey(roomId), "round:status");
                if (currentStatus == null) return; // 已被清理
                int status = Integer.parseInt(currentStatus);

                // 只处理 PENDING_MEMBER_INPUT 和 PENDING_CONFIRM
                if (status != RoundRecordStatus.PENDING_MEMBER_INPUT.getCode()
                        && status != RoundRecordStatus.PENDING_CONFIRM.getCode()) {
                    return;
                }

                Room room = roomMapper.selectById(roomId);
                if (room == null) return;

                if (!redisTemplate.opsForHash().hasKey(roomDataKey(roomId), "round:id")) return;

                if (timeoutAction == 1) {
                    // 自动同意：仅在 PENDING_CONFIRM 且有 score 数据时生效
                    if (status == RoundRecordStatus.PENDING_CONFIRM.getCode()) {
                        long scoreCount = countScoreEntries(roomId);
                        if (scoreCount > 0) {
                            applyRound(roomId, room);
                            // 广播超时通知
                            Map<String, Object> pushData = new HashMap<>();
                            pushData.put("type", "ROUND_TIMEOUT");
                            pushData.put("roundId", roundId);
                            pushData.put("action", "auto_approve");
                            scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
                        }
                    }
                    // PENDING_MEMBER_INPUT 时自动同意无意义（没有数据），跳过
                } else {
                    // 自动取消
                    deleteRoundKeys(roomId);
                    Map<String, Object> pushData = new HashMap<>();
                    pushData.put("type", "ROUND_TIMEOUT");
                    pushData.put("roundId", roundId);
                    pushData.put("action", "auto_cancel");
                    scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
                }
            } catch (Exception e) {
                log.warn("超时监控异常: roomId={}, roundId={}", roomId, roundId, e);
            }
        }, asyncExecutor);
    }

    /**
     * 发送记分提醒订阅消息给离线用户
     */
    private void sendScoreReminderToOfflineUsers(Long roomId, Room room) {
        // 使用 asyncExecutor 彻底异步化微信订阅消息发送，防止同步公网 HTTP 阻塞事务和 Redisson 分布式锁，提升系统性能
        final var finalRoom = room;
        asyncExecutor.execute(() -> {
            try {
                String roomIdStr = String.valueOf(roomId);
                Set<Long> onlineUserIds = scoreWebSocket.getOnlineUserIds(roomIdStr);
                
                // 1. 加载房间内的所有成员
                List<RoomMember> members = roomMemberMapper.selectList(
                        new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
                
                for (RoomMember member : members) {
                    Long userId = member.getUserId();
                    if (onlineUserIds.contains(userId)) {
                        continue; // 在线用户已建立 WebSocket，不需要发送订阅消息
                    }
                    
                    User user = userMapper.selectById(userId);
                    if (user == null || user.getOpenid() == null) {
                        continue;
                    }
                    
                    // 2. 构建订阅消息数据实体
                    cn.hutool.json.JSONObject data = new cn.hutool.json.JSONObject();
                    data.set("nickname", user.getNickname() != null ? user.getNickname() : "舰员");
                    data.set("roomNo", finalRoom.getRoomNo());
                    data.set("time", LocalDateTime.now().format(
                            java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
                    
                    // 3. 同步至微信小程序后台推送
                    subscribeMessageService.sendSubscribeMessage(
                            user.getOpenid(),
                            "template_id_score_reminder",
                            "pages/room/room?roomNo=" + finalRoom.getRoomNo(),
                            data);
                }
            } catch (Exception e) {
                log.warn("异步发送记分提醒订阅消息失败: roomId={}", roomId, e);
            }
        });
    }

    private RoundRecordResp buildRespFromRedis(Long roomId, Room room) {
        String rdk = roomDataKey(roomId);
        String roundIdVal = (String) redisTemplate.opsForHash().get(rdk, "round:id");
        if (roundIdVal == null) return null;

        int status = Integer.parseInt((String) redisTemplate.opsForHash().get(rdk, "round:status"));
        int inputMethod = Integer.parseInt((String) redisTemplate.opsForHash().get(rdk, "round:inputMethod"));
        int trustMode = Integer.parseInt((String) redisTemplate.opsForHash().get(rdk, "round:trustMode"));
        int zeroSum = Integer.parseInt((String) redisTemplate.opsForHash().get(rdk, "round:zeroSumRequired"));
        long createdBy = Long.parseLong((String) redisTemplate.opsForHash().get(rdk, "round:createdBy"));
        String totalScoreStr = (String) redisTemplate.opsForHash().get(rdk, "round:totalScore");
        int totalScore = totalScoreStr != null ? Integer.parseInt(totalScoreStr) : 0;
        long createdAtMs = Long.parseLong((String) redisTemplate.opsForHash().get(rdk, "round:createdAt"));

        String rejectedByStr = (String) redisTemplate.opsForHash().get(rdk, "round:rejectedBy");
        Long rejectedBy = rejectedByStr != null ? Long.parseLong(rejectedByStr) : null;

        // 从 round:data 读取 score: 和 confirm: 字段
        Map<String, String> scoreEntries = getScoreEntries(roomId);
        Set<String> confirmedUserIds = getConfirmedUserIds(roomId);

        // 获取房间所有成员
        List<RoomMember> allMembers = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
        Set<Long> memberUserIds = allMembers.stream().map(RoomMember::getUserId).collect(Collectors.toSet());

        // 批量加载用户信息
        Map<Long, String> nicknameMap = new HashMap<>();
        Map<Long, String> avatarUrlMap = new HashMap<>();
        for (Long uid : memberUserIds) {
            Object cached = redisTemplate.opsForHash().get("sr:user:" + uid, "info");
            if (cached != null) {
                JSONObject userObj = JSONUtil.parseObj((String) cached);
                nicknameMap.put(uid, userObj.getStr("nickname", ""));
                avatarUrlMap.put(uid, userObj.getStr("avatarUrl", ""));
            } else {
                User u = userMapper.selectById(uid);
                nicknameMap.put(uid, u != null ? u.getNickname() : "");
                avatarUrlMap.put(uid, u != null ? u.getAvatarUrl() : "");
            }
        }

        List<RoundRecordResp.DetailVO> detailVOs = new ArrayList<>();
        int memberSubmitted = 0;

        for (Long uid : memberUserIds) {
            String scoreStr = scoreEntries.get(String.valueOf(uid));
            Integer score = scoreStr != null ? Integer.parseInt(scoreStr) : null;
            boolean submitted = score != null;
            if (submitted) memberSubmitted++;

            Boolean confirmed = null;
            if (status == RoundRecordStatus.PENDING_CONFIRM.getCode()) {
                confirmed = confirmedUserIds.contains(String.valueOf(uid));
            }
            detailVOs.add(RoundRecordResp.DetailVO.builder()
                    .userId(uid)
                    .nickname(nicknameMap.getOrDefault(uid, ""))
                    .avatarUrl(avatarUrlMap.getOrDefault(uid, ""))
                    .score(score)
                    .submitted(submitted)
                    .confirmed(confirmed)
                    .build());
        }

        int confirmCount = confirmedUserIds.size();

        return RoundRecordResp.builder()
                .id(Long.parseLong(roundIdVal))
                .roomId(roomId)
                .status(status)
                .inputMethod(inputMethod)
                .trustMode(trustMode)
                .zeroSumRequired(zeroSum)
                .createdBy(createdBy)
                .totalScore(totalScore)
                .rejectedBy(rejectedBy)
                .details(detailVOs)
                .memberSubmitted(memberSubmitted)
                .memberTotal(memberUserIds.size())
                .confirmCount(confirmCount)
                .confirmTotal(memberUserIds.size())
                .createdAt(LocalDateTime.ofInstant(Instant.ofEpochMilli(createdAtMs), ZoneId.systemDefault()))
                .build();
    }

    // ===== round:data 辅助方法 =====

    /** 从 round:data 读取所有 score:{uid} 字段，去掉前缀返回 uid→score 映射 */
    private Map<String, String> getScoreEntries(Long roomId) {
        Map<Object, Object> all = redisTemplate.opsForHash().entries(roundDataKey(roomId));
        Map<String, String> result = new HashMap<>();
        for (Map.Entry<Object, Object> entry : all.entrySet()) {
            String key = (String) entry.getKey();
            if (key.startsWith(SCORE_PREFIX)) {
                result.put(key.substring(SCORE_PREFIX.length()), (String) entry.getValue());
            }
        }
        return result;
    }

    /** 统计 round:data 中 score: 字段数量 */
    private long countScoreEntries(Long roomId) {
        Map<Object, Object> all = redisTemplate.opsForHash().entries(roundDataKey(roomId));
        long count = 0;
        for (Object key : all.keySet()) {
            if (((String) key).startsWith(SCORE_PREFIX)) count++;
        }
        return count;
    }

    /** 从 round:data 读取所有 confirm:{uid} 字段，返回已确认的 userId 集合 */
    private Set<String> getConfirmedUserIds(Long roomId) {
        Map<Object, Object> all = redisTemplate.opsForHash().entries(roundDataKey(roomId));
        Set<String> result = new HashSet<>();
        for (Object key : all.keySet()) {
            String k = (String) key;
            if (k.startsWith(CONFIRM_PREFIX)) {
                result.add(k.substring(CONFIRM_PREFIX.length()));
            }
        }
        return result;
    }

    /** 统计 round:data 中 confirm: 字段数量 */
    private long countConfirmEntries(Long roomId) {
        Map<Object, Object> all = redisTemplate.opsForHash().entries(roundDataKey(roomId));
        long count = 0;
        for (Object key : all.keySet()) {
            if (((String) key).startsWith(CONFIRM_PREFIX)) count++;
        }
        return count;
    }
}
