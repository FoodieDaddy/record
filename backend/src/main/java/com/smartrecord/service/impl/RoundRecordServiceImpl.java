package com.smartrecord.service.impl;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.common.EmotionType;
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
    @Qualifier("asyncExecutor")
    private final Executor asyncExecutor;

    private static final String ROOM_PREFIX = "sr:room:";
    private static final int ROOM_EXPIRE_HOURS = 24;

    private String roundKey(Long roomId) { return ROOM_PREFIX + roomId + ":round"; }
    private String detailsKey(Long roomId) { return ROOM_PREFIX + roomId + ":round:details"; }
    private String membersKey(Long roomId) { return ROOM_PREFIX + roomId + ":round:members"; }
    private String confirmsKey(Long roomId) { return ROOM_PREFIX + roomId + ":round:confirms"; }
    private String configKey(Long roomId) { return ROOM_PREFIX + roomId + ":roundConfig"; }

    @Override
    public RoundRecordResp startRound(Long userId, Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) throw new BizException("空间不存在或已封存");
        if (ScoreMode.ROUND_RECORD.getCode() != (room.getScoreMode() != null ? room.getScoreMode() : 1)) {
            throw new BizException("自由流转空间不支持本局录");
        }
        if (!room.getOwnerId().equals(userId)) throw new BizException("仅主控可发起本局录");

        String lockKey = ROOM_PREFIX + roomId + ":lock";
        RLock lock = redissonClient.getLock(lockKey);
        try {
            if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                throw new BizException("系统繁忙，请稍后重试");
            }

            // 检查是否有待处理录
            if (Boolean.TRUE.equals(redisTemplate.hasKey(roundKey(roomId)))) {
                throw new BizException(4101, "当前已有一笔本局录待处理");
            }

            int inputMethod = room.getRoundInputMethod() != null ? room.getRoundInputMethod() : 1;
            int trustMode = room.getTrustMode() != null ? room.getTrustMode() : 1;
            int zeroSum = room.getZeroSumRequired() != null ? room.getZeroSumRequired() : 1;

            long roundId = idGenerator.nextId();
            int status;
            if (inputMethod == RoundInputMethod.HOST_FILL.getCode()) {
                // 房主填写：信任开启直接等待提交后生效，信任关闭等待确认
                status = trustMode == 1
                        ? RoundRecordStatus.PENDING_CONFIRM.getCode()  // 信任开启：提交后直接生效，但先等房主填分数
                        : RoundRecordStatus.PENDING_CONFIRM.getCode(); // 信任关闭：提交后等全员确认
            } else {
                // 成员自填
                status = RoundRecordStatus.PENDING_MEMBER_INPUT.getCode();
            }

            // 写入 round Hash
            Map<String, String> roundData = new HashMap<>();
            roundData.put("id", String.valueOf(roundId));
            roundData.put("status", String.valueOf(status));
            roundData.put("inputMethod", String.valueOf(inputMethod));
            roundData.put("trustMode", String.valueOf(trustMode));
            roundData.put("zeroSumRequired", String.valueOf(zeroSum));
            roundData.put("createdBy", String.valueOf(userId));
            roundData.put("totalScore", "0");
            roundData.put("createdAt", String.valueOf(System.currentTimeMillis()));

            // 从 roundConfig 读取超时设置
            String autoSeconds = (String) redisTemplate.opsForHash().get(configKey(roomId), "autoTimeoutSeconds");
            String autoAction = (String) redisTemplate.opsForHash().get(configKey(roomId), "autoTimeoutAction");
            roundData.put("autoTimeoutSeconds", autoSeconds != null ? autoSeconds : "30");
            roundData.put("autoTimeoutAction", autoAction != null ? autoAction : "1");

            redisTemplate.opsForHash().putAll(roundKey(roomId), roundData);
            redisTemplate.expire(roundKey(roomId), ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

            // 成员自填模式：初始化 members Hash
            if (inputMethod == RoundInputMethod.MEMBER_FILL.getCode()) {
                // 不预填，成员提交时写入
                redisTemplate.expire(membersKey(roomId), ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
            }

            // 广播 ROUND_STARTED
            RoundRecordResp resp = buildRespFromRedis(roomId, room);
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "ROUND_STARTED");
            pushData.put("round", resp);
            scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);

            // 信任关闭时启动超时监控
            if (trustMode == 0) {
                startTimeoutMonitor(roomId, roundId, status);
            }

            return resp;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException("操作被中断");
        } finally {
            if (lock.isHeldByCurrentThread()) lock.unlock();
        }
    }

    @Override
    public RoundRecordResp submitRound(Long userId, SubmitRoundReq req) {
        Long roomId = req.getRoomId();
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) throw new BizException("空间不存在或已封存");

        String lockKey = ROOM_PREFIX + roomId + ":lock";
        RLock lock = redissonClient.getLock(lockKey);
        try {
            if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                throw new BizException("系统繁忙，请稍后重试");
            }

            // 检查 round 存在
            Map<Object, Object> roundData = redisTemplate.opsForHash().entries(roundKey(roomId));
            if (roundData.isEmpty()) throw new BizException(4105, "该录已失效，请刷新空间");

            int status = Integer.parseInt((String) roundData.get("status"));
            int inputMethod = Integer.parseInt((String) roundData.get("inputMethod"));
            int trustMode = Integer.parseInt((String) roundData.get("trustMode"));
            int zeroSum = Integer.parseInt((String) roundData.get("zeroSumRequired"));
            long createdBy = Long.parseLong((String) roundData.get("createdBy"));

            if (inputMethod == RoundInputMethod.HOST_FILL.getCode()) {
                // 房主填写
                if (!room.getOwnerId().equals(userId)) throw new BizException("仅主控可填写");
                if (status != RoundRecordStatus.PENDING_CONFIRM.getCode()) {
                    throw new BizException("当前状态不允许填写");
                }

                // 写入 details
                int totalScore = 0;
                Map<String, String> details = new HashMap<>();
                for (SubmitRoundReq.PlayerScore ps : req.getScores()) {
                    details.put(String.valueOf(ps.getUserId()), String.valueOf(ps.getScore()));
                    totalScore += ps.getScore();
                }

                // 零和校验
                if (zeroSum == 1 && totalScore != 0) {
                    throw new BizException(4103, "积分变化总和必须为 0");
                }

                redisTemplate.opsForHash().putAll(detailsKey(roomId), details);
                redisTemplate.expire(detailsKey(roomId), ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
                redisTemplate.opsForHash().put(roundKey(roomId), "totalScore", String.valueOf(totalScore));

                if (trustMode == 1) {
                    // 信任开启：直接生效
                    return applyRound(roomId, room, roundData);
                } else {
                    // 信任关闭：广播等待确认
                    RoundRecordResp resp = buildRespFromRedis(roomId, room);
                    Map<String, Object> pushData = new HashMap<>();
                    pushData.put("type", "ROUND_STARTED");
                    pushData.put("round", resp);
                    scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
                    return resp;
                }

            } else {
                // 成员自填
                if (status != RoundRecordStatus.PENDING_MEMBER_INPUT.getCode()) {
                    throw new BizException("当前状态不允许填写");
                }

                // 校验用户是房间成员
                boolean isMember = roomMemberMapper.selectCount(
                        new LambdaQueryWrapper<RoomMember>()
                                .eq(RoomMember::getRoomId, roomId)
                                .eq(RoomMember::getUserId, userId)) > 0;
                if (!isMember) throw new BizException("您不是该空间舰员");

                // 成员只填自己的分数
                Integer myScore = null;
                for (SubmitRoundReq.PlayerScore ps : req.getScores()) {
                    if (ps.getUserId().equals(userId)) {
                        myScore = ps.getScore();
                        break;
                    }
                }
                if (myScore == null) throw new BizException("请填写自己的积分");

                // 写入 members Hash
                redisTemplate.opsForHash().put(membersKey(roomId), String.valueOf(userId), String.valueOf(myScore));

                // 检查是否全员提交
                long memberCount = roomMemberMapper.selectCount(
                        new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
                Map<Object, Object> submitted = redisTemplate.opsForHash().entries(membersKey(roomId));

                // 广播进度
                Map<String, Object> progressData = new HashMap<>();
                progressData.put("type", "ROUND_MEMBER_SUBMITTED");
                progressData.put("userId", String.valueOf(userId));
                progressData.put("submitted", submitted.size());
                progressData.put("total", memberCount);
                scoreWebSocket.pushToRoom(String.valueOf(roomId), progressData);

                if (submitted.size() < memberCount) {
                    // 还有人未提交
                    return buildRespFromRedis(roomId, room);
                }

                // 全员提交：汇总到 details
                int totalScore = 0;
                Map<String, String> details = new HashMap<>();
                for (Map.Entry<Object, Object> entry : submitted.entrySet()) {
                    int score = Integer.parseInt((String) entry.getValue());
                    details.put((String) entry.getKey(), String.valueOf(score));
                    totalScore += score;
                }

                // 零和校验
                if (zeroSum == 1 && totalScore != 0) {
                    throw new BizException(4103, "积分变化总和必须为 0");
                }

                redisTemplate.opsForHash().putAll(detailsKey(roomId), details);
                redisTemplate.expire(detailsKey(roomId), ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
                redisTemplate.opsForHash().put(roundKey(roomId), "totalScore", String.valueOf(totalScore));

                if (trustMode == 1) {
                    // 信任开启：直接生效
                    return applyRound(roomId, room, roundData);
                } else {
                    // 信任关闭：进入确认阶段
                    redisTemplate.opsForHash().put(roundKey(roomId), "status",
                            String.valueOf(RoundRecordStatus.PENDING_CONFIRM.getCode()));
                    RoundRecordResp resp = buildRespFromRedis(roomId, room);
                    Map<String, Object> pushData = new HashMap<>();
                    pushData.put("type", "ROUND_STARTED");
                    pushData.put("round", resp);
                    scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
                    return resp;
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException("操作被中断");
        } finally {
            if (lock.isHeldByCurrentThread()) lock.unlock();
        }
    }

    @Override
    public RoundRecordResp confirmRound(Long userId, ConfirmRoundReq req) {
        Long roomId = req.getRoomId();
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) throw new BizException("空间不存在或已封存");

        String lockKey = ROOM_PREFIX + roomId + ":lock";
        RLock lock = redissonClient.getLock(lockKey);
        try {
            if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                throw new BizException("系统繁忙，请稍后重试");
            }

            Map<Object, Object> roundData = redisTemplate.opsForHash().entries(roundKey(roomId));
            if (roundData.isEmpty()) throw new BizException(4105, "该录已失效");

            int status = Integer.parseInt((String) roundData.get("status"));
            if (status != RoundRecordStatus.PENDING_CONFIRM.getCode()) {
                throw new BizException("当前状态不允许确认");
            }

            // 校验用户是房间成员
            boolean isMember = roomMemberMapper.selectCount(
                    new LambdaQueryWrapper<RoomMember>()
                            .eq(RoomMember::getRoomId, roomId)
                            .eq(RoomMember::getUserId, userId)) > 0;
            if (!isMember) throw new BizException("您不是该空间舰员");

            if (Boolean.FALSE.equals(req.getAgree())) {
                // 驳回
                redisTemplate.opsForHash().put(roundKey(roomId), "status",
                        String.valueOf(RoundRecordStatus.REJECTED.getCode()));
                redisTemplate.opsForHash().put(roundKey(roomId), "rejectedBy", String.valueOf(userId));

                // 广播 ROUND_REJECTED
                Map<String, Object> pushData = new HashMap<>();
                pushData.put("type", "ROUND_REJECTED");
                pushData.put("roundId", roundData.get("id"));
                pushData.put("rejectedBy", String.valueOf(userId));
                scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);

                // 清理 round keys（延迟）
                scheduleRoundCleanup(roomId, 60);
                return buildRespFromRedis(roomId, room);
            }

            // 同意：记录确认
            redisTemplate.opsForSet().add(confirmsKey(roomId), String.valueOf(userId));
            redisTemplate.expire(confirmsKey(roomId), ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

            // 检查是否全员确认
            long memberCount = roomMemberMapper.selectCount(
                    new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
            Long confirmCount = redisTemplate.opsForSet().size(confirmsKey(roomId));

            // 广播确认进度
            Map<String, Object> progressData = new HashMap<>();
            progressData.put("type", "ROUND_CONFIRM_PROGRESS");
            progressData.put("userId", String.valueOf(userId));
            progressData.put("confirmCount", confirmCount != null ? confirmCount : 0);
            progressData.put("total", memberCount);
            scoreWebSocket.pushToRoom(String.valueOf(roomId), progressData);

            if (confirmCount != null && confirmCount >= memberCount) {
                // 全员确认：生效
                return applyRound(roomId, room, roundData);
            }

            return buildRespFromRedis(roomId, room);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException("操作被中断");
        } finally {
            if (lock.isHeldByCurrentThread()) lock.unlock();
        }
    }

    @Override
    public void cancelRound(Long userId, Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("空间不存在");
        if (!room.getOwnerId().equals(userId)) throw new BizException("仅主控可取消");

        String lockKey = ROOM_PREFIX + roomId + ":lock";
        RLock lock = redissonClient.getLock(lockKey);
        try {
            if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                throw new BizException("系统繁忙，请稍后重试");
            }

            if (!Boolean.TRUE.equals(redisTemplate.hasKey(roundKey(roomId)))) {
                throw new BizException(4105, "没有待处理的录入");
            }

            String roundId = (String) redisTemplate.opsForHash().get(roundKey(roomId), "id");
            deleteRoundKeys(roomId);

            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "ROUND_CANCELLED");
            pushData.put("roundId", roundId);
            scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException("操作被中断");
        } finally {
            if (lock.isHeldByCurrentThread()) lock.unlock();
        }
    }

    @Override
    public RoundRecordResp getPending(Long roomId) {
        if (!Boolean.TRUE.equals(redisTemplate.hasKey(roundKey(roomId)))) {
            return null;
        }
        Room room = roomMapper.selectById(roomId);
        if (room == null) return null;
        return buildRespFromRedis(roomId, room);
    }

    // ===== 内部方法 =====

    private RoundRecordResp applyRound(Long roomId, Room room, Map<Object, Object> roundData) {
        long roundId = Long.parseLong((String) roundData.get("id"));
        int inputMethod = Integer.parseInt((String) roundData.get("inputMethod"));
        int trustMode = Integer.parseInt((String) roundData.get("trustMode"));
        int zeroSum = Integer.parseInt((String) roundData.get("zeroSumRequired"));
        long createdBy = Long.parseLong((String) roundData.get("createdBy"));
        int totalScore = Integer.parseInt((String) roundData.get("totalScore"));
        long createdAtMs = Long.parseLong((String) roundData.get("createdAt"));

        // 读取 details
        Map<Object, Object> detailsMap = redisTemplate.opsForHash().entries(detailsKey(roomId));

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

        for (Map.Entry<Object, Object> entry : detailsMap.entrySet()) {
            RoundRecordDetail detail = new RoundRecordDetail();
            detail.setId(idGenerator.nextId());
            detail.setRoundRecordId(roundId);
            detail.setUserId(Long.parseLong((String) entry.getKey()));
            detail.setScore(Integer.parseInt((String) entry.getValue()));
            roundRecordDetailMapper.insert(detail);
        }

        // 更新 Redis 排行榜
        String scoresKey = ROOM_PREFIX + roomId + ":scores";
        for (Map.Entry<Object, Object> entry : detailsMap.entrySet()) {
            int score = Integer.parseInt((String) entry.getValue());
            if (score != 0) {
                redisTemplate.opsForZSet().incrementScore(scoresKey, (String) entry.getKey(), score);
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
        for (Map.Entry<Object, Object> entry : detailsMap.entrySet()) {
            long uid = Long.parseLong((String) entry.getKey());
            int score = Integer.parseInt((String) entry.getValue());
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
        redisTemplate.expire(ROOM_PREFIX + roomId + ":meta", ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
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
        List<String> keys = List.of(
                roundKey(roomId),
                detailsKey(roomId),
                membersKey(roomId),
                confirmsKey(roomId));
        redisTemplate.delete(keys);
    }

    private void scheduleRoundCleanup(Long roomId, int delaySeconds) {
        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(delaySeconds * 1000L);
                // 只清理 REJECTED 状态的，不清理已手动取消或已生效的
                String status = (String) redisTemplate.opsForHash().get(roundKey(roomId), "status");
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
        String secondsStr = (String) redisTemplate.opsForHash().get(roundKey(roomId), "autoTimeoutSeconds");
        String actionStr = (String) redisTemplate.opsForHash().get(roundKey(roomId), "autoTimeoutAction");
        int timeoutSeconds = secondsStr != null ? Integer.parseInt(secondsStr) : 30;
        int timeoutAction = actionStr != null ? Integer.parseInt(actionStr) : 1;

        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(timeoutSeconds * 1000L);

                // 原子检查状态
                String currentStatus = (String) redisTemplate.opsForHash().get(roundKey(roomId), "status");
                if (currentStatus == null) return; // 已被清理
                int status = Integer.parseInt(currentStatus);

                // 只处理 PENDING_MEMBER_INPUT 和 PENDING_CONFIRM
                if (status != RoundRecordStatus.PENDING_MEMBER_INPUT.getCode()
                        && status != RoundRecordStatus.PENDING_CONFIRM.getCode()) {
                    return;
                }

                Room room = roomMapper.selectById(roomId);
                if (room == null) return;

                Map<Object, Object> roundData = redisTemplate.opsForHash().entries(roundKey(roomId));
                if (roundData.isEmpty()) return;

                if (timeoutAction == 1) {
                    // 自动同意：仅在 PENDING_CONFIRM 且有 details 时生效
                    if (status == RoundRecordStatus.PENDING_CONFIRM.getCode()) {
                        Map<Object, Object> details = redisTemplate.opsForHash().entries(detailsKey(roomId));
                        if (!details.isEmpty()) {
                            applyRound(roomId, room, roundData);
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

    private RoundRecordResp buildRespFromRedis(Long roomId, Room room) {
        Map<Object, Object> roundData = redisTemplate.opsForHash().entries(roundKey(roomId));
        if (roundData.isEmpty()) return null;

        int status = Integer.parseInt((String) roundData.get("status"));
        int inputMethod = Integer.parseInt((String) roundData.get("inputMethod"));
        int trustMode = Integer.parseInt((String) roundData.get("trustMode"));
        int zeroSum = Integer.parseInt((String) roundData.get("zeroSumRequired"));
        long createdBy = Long.parseLong((String) roundData.get("createdBy"));
        int totalScore = Integer.parseInt((String) roundData.getOrDefault("totalScore", "0"));
        long createdAtMs = Long.parseLong((String) roundData.get("createdAt"));

        String rejectedByStr = (String) roundData.get("rejectedBy");
        Long rejectedBy = rejectedByStr != null ? Long.parseLong(rejectedByStr) : null;

        // 构建 details
        Map<Object, Object> detailsMap = redisTemplate.opsForHash().entries(detailsKey(roomId));
        Map<Object, Object> membersMap = redisTemplate.opsForHash().entries(membersKey(roomId));
        Set<String> confirmedSet = redisTemplate.opsForSet().members(confirmsKey(roomId));
        if (confirmedSet == null) confirmedSet = Collections.emptySet();

        // 获取房间所有成员
        List<RoomMember> allMembers = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
        Set<Long> memberUserIds = allMembers.stream().map(RoomMember::getUserId).collect(Collectors.toSet());

        // 批量加载用户信息
        Map<Long, String> nicknameMap = new HashMap<>();
        Map<Long, String> avatarUrlMap = new HashMap<>();
        for (Long uid : memberUserIds) {
            String userJson = redisTemplate.opsForValue().get("sr:user:" + uid);
            if (userJson != null) {
                JSONObject userObj = JSONUtil.parseObj(userJson);
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

        if (inputMethod == RoundInputMethod.HOST_FILL.getCode()) {
            // 房主填写：details 中有数据
            for (Long uid : memberUserIds) {
                String scoreStr = (String) detailsMap.get(String.valueOf(uid));
                Integer score = scoreStr != null ? Integer.parseInt(scoreStr) : null;
                Boolean confirmed = null;
                if (status == RoundRecordStatus.PENDING_CONFIRM.getCode()) {
                    confirmed = confirmedSet.contains(String.valueOf(uid));
                }
                detailVOs.add(RoundRecordResp.DetailVO.builder()
                        .userId(uid)
                        .nickname(nicknameMap.getOrDefault(uid, ""))
                        .avatarUrl(avatarUrlMap.getOrDefault(uid, ""))
                        .score(score)
                        .submitted(score != null)
                        .confirmed(confirmed)
                        .build());
            }
        } else {
            // 成员自填
            for (Long uid : memberUserIds) {
                String submittedScore = (String) membersMap.get(String.valueOf(uid));
                if (submittedScore != null) memberSubmitted++;

                String scoreStr = (String) detailsMap.get(String.valueOf(uid));
                Integer score = scoreStr != null ? Integer.parseInt(scoreStr) : (submittedScore != null ? Integer.parseInt(submittedScore) : null);
                Boolean confirmed = null;
                if (status == RoundRecordStatus.PENDING_CONFIRM.getCode()) {
                    confirmed = confirmedSet.contains(String.valueOf(uid));
                }
                detailVOs.add(RoundRecordResp.DetailVO.builder()
                        .userId(uid)
                        .nickname(nicknameMap.getOrDefault(uid, ""))
                        .avatarUrl(avatarUrlMap.getOrDefault(uid, ""))
                        .score(score)
                        .submitted(submittedScore != null)
                        .confirmed(confirmed)
                        .build());
            }
        }

        int confirmCount = confirmedSet.size();

        return RoundRecordResp.builder()
                .id(Long.parseLong((String) roundData.get("id")))
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
}
