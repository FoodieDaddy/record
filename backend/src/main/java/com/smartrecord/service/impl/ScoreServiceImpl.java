package com.smartrecord.service.impl;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.common.ErrorCode;
import com.smartrecord.common.EmotionType;
import com.smartrecord.common.PageResult;
import com.smartrecord.dto.room.RoomResp;
import com.smartrecord.dto.score.*;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.entity.RoundRecord;
import com.smartrecord.entity.RoundRecordDetail;
import com.smartrecord.entity.User;
import com.smartrecord.enums.RoundRecordStatus;
import com.smartrecord.enums.ScoreMode;
import com.smartrecord.mapper.*;
import com.smartrecord.service.EmotionAudioPool;
import com.smartrecord.service.IdentityLevelService;
import com.smartrecord.service.OverviewService;
import com.smartrecord.service.RoomService;
import com.smartrecord.service.ScoreService;
import com.smartrecord.service.impl.ws.ScoreWebSocket;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScoreServiceImpl implements ScoreService {

    private final RoomMapper roomMapper;
    private final UserMapper userMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final RoundRecordMapper roundRecordMapper;
    private final RoundRecordDetailMapper roundRecordDetailMapper;
    private final StringRedisTemplate redisTemplate;
    private final RedissonClient redissonClient;
    private final ScoreWebSocket scoreWebSocket;
    private final EmotionAudioPool emotionAudioPool;
    private final OverviewService overviewService;
    private final IdentityLevelService identityLevelService;
    private final RoomService roomService;
    @Qualifier("asyncExecutor")
    private final Executor asyncExecutor;

    private static final String ROOM_PREFIX = "sr:room:";
    private static final int ROOM_EXPIRE_HOURS = 24;
    private final ConcurrentHashMap<Long, Long> lastTtlRefresh = new ConcurrentHashMap<>();

    private String dataKey(Long roomId) { return ROOM_PREFIX + roomId + ":data"; }

    private static final String TRANSFER_LUA = """
            local scoresKey = KEYS[1]
            local fromUser = ARGV[1]
            local toUser = ARGV[2]
            local amount = tonumber(ARGV[3])
            -- 已结算空间 key 已删除，拒绝操作防止重建脏数据
            if redis.call('EXISTS', scoresKey) == 0 then
                return 0
            end
            redis.call('ZINCRBY', scoresKey, -amount, fromUser)
            redis.call('ZINCRBY', scoresKey, amount, toUser)
            return 1
            """;

    private static final DefaultRedisScript<Long> TRANSFER_SCRIPT = new DefaultRedisScript<>(TRANSFER_LUA, Long.class);

    @Override
    public ScoreSubmitResp submitScore(Long userId, SubmitScoreReq req) {
        Long roomId = req.getRoomId();
        if (roomId == null) throw new BizException(ErrorCode.BAD_REQUEST, "编队 ID 不能为空");

        // 验证房间存在且活跃
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) {
            throw new BizException(ErrorCode.ROOM_NOT_FOUND);
        }

        if (!isActiveRoomMember(roomId, userId)) {
            throw new BizException(ErrorCode.NOT_ROOM_MEMBER);
        }
        for (SubmitScoreReq.PlayerScore ps : req.getScores()) {
            if (!isActiveRoomMember(roomId, ps.getUserId())) {
                throw new BizException(ErrorCode.SCORE_ONLY_ROOM_MEMBERS);
            }
        }
        // 验证提交者是房间成员（DB 兜底）
        RoomMember submitter = roomMemberMapper.selectOne(
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getRoomId, roomId)
                        .eq(RoomMember::getUserId, userId));
        if (submitter == null) throw new BizException(ErrorCode.NOT_ROOM_MEMBER);

        // 提交者本人的分数变动（用于情绪音频）
        int submitterScoreChange = 0;
        for (SubmitScoreReq.PlayerScore ps : req.getScores()) {
            if (ps.getUserId().equals(userId)) {
                submitterScoreChange = ps.getScore();
                break;
            }
        }

        // Redisson 分布式锁
        String lockKey = ROOM_PREFIX + roomId + ":lock";
        RLock lock = redissonClient.getLock(lockKey);
        try {
            if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                throw new BizException(ErrorCode.SYSTEM_BUSY);
            }
            // 加锁后二次检查房间状态，防止结算期间提交脏数据
            Room freshRoom = roomMapper.selectById(roomId);
            if (freshRoom != null && freshRoom.getStatus() != 0) {
                throw new BizException(ErrorCode.SCORE_ROOM_ARCHIVED);
            }

            long batchTs = System.currentTimeMillis();
            String scoresKey = ROOM_PREFIX + roomId + ":scores";

            // 1. 更新排行榜 Sorted Set
            for (SubmitScoreReq.PlayerScore ps : req.getScores()) {
                redisTemplate.opsForZSet().incrementScore(scoresKey, String.valueOf(ps.getUserId()), ps.getScore());
            }

            // 4. 为每个玩家生成情绪音频 URL
            List<Map<String, Object>> scoreWithEmotion = new ArrayList<>();
            for (SubmitScoreReq.PlayerScore ps : req.getScores()) {
                Map<String, Object> entry = new HashMap<>();
                entry.put("userId", ps.getUserId());
                entry.put("score", ps.getScore());
                EmotionType playerEmotion = ps.getScore() > 0 ? EmotionType.WIN
                        : ps.getScore() < 0 ? EmotionType.LOSE : null;
                if (playerEmotion != null) {
                    entry.put("emotionAudioUrl", emotionAudioPool.randomUrl(playerEmotion));
                }
                scoreWithEmotion.add(entry);
            }

            // 6. WebSocket 推送给房间内所有玩家
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "SCORE_UPDATE");
            pushData.put("batchTime", batchTs);
            pushData.put("scores", scoreWithEmotion);
            scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);

            // 7. 更新最后活跃时间 + 滑动刷新 TTL
            refreshRoomTtl(roomId);
            touchActiveRoom(roomId);

            // 8. 异步更新总览缓存
            overviewService.computeOverview(roomId);

            // 9. 为提交者返回情绪音频
            String submitterAudioUrl = null;
            if (submitterScoreChange > 0) {
                submitterAudioUrl = emotionAudioPool.randomUrl(EmotionType.WIN);
            } else if (submitterScoreChange < 0) {
                submitterAudioUrl = emotionAudioPool.randomUrl(EmotionType.LOSE);
            }

            return ScoreSubmitResp.builder()
                    .emotionAudioUrl(submitterAudioUrl)
                    .build();

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException(ErrorCode.OPERATION_INTERRUPTED);
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    @Override
    public List<ScoreBatchResp.PlayerScoreVO> getRoomRanking(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException(ErrorCode.ROOM_NOT_FOUND);

        Map<Long, Integer> totals;
        if (room.getStatus() == 0) {
            // 进行中 → Redis
            totals = getPlayerTotalsFromRedis(roomId);
            // 从 data Hash 的 a: 前缀字段补齐 0 分成员
            Map<Object, Object> allData = redisTemplate.opsForHash().entries(dataKey(roomId));
            if (allData != null) {
                for (Object key : allData.keySet()) {
                    String f = (String) key;
                    if (f.startsWith("a:")) {
                        try {
                            Long uid = Long.parseLong(f.substring(2));
                            totals.putIfAbsent(uid, 0);
                        } catch (NumberFormatException ignored) {}
                    }
                }
            }
        } else {
            // 已结算 → MySQL
            totals = getPlayerTotalsFromMySQL(roomId);
        }

        Set<Long> userIds = totals.keySet();
        Map<Long, String> nicknameMap = new HashMap<>();
        for (Long uid : userIds) {
            Object cached = redisTemplate.opsForHash().get("sr:user:" + uid, "info");
            if (cached != null) {
                JSONObject userObj = JSONUtil.parseObj((String) cached);
                nicknameMap.put(uid, userObj.getStr("nickname", ""));
            } else {
                User u = userMapper.selectById(uid);
                nicknameMap.put(uid, u != null ? u.getNickname() : "");
            }
        }

        return totals.entrySet().stream()
                .sorted(Map.Entry.<Long, Integer>comparingByValue().reversed())
                .map(e -> ScoreBatchResp.PlayerScoreVO.builder()
                        .userId(e.getKey())
                        .nickname(nicknameMap.getOrDefault(e.getKey(), ""))
                        .score(e.getValue())
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    public List<ScoreBatchResp> getRoomRecentScores(Long roomId, Integer count) {
        String eventsKey = ROOM_PREFIX + roomId + ":events";
        int limit = count != null && count > 0 ? count : 20;
        Set<ZSetOperations.TypedTuple<String>> tuples =
                redisTemplate.opsForZSet().reverseRangeWithScores(eventsKey, 0, limit - 1);
        if (tuples == null || tuples.isEmpty()) return Collections.emptyList();

        List<ScoreBatchResp> result = new ArrayList<>();
        for (ZSetOperations.TypedTuple<String> tuple : tuples) {
            try {
                JSONObject event = JSONUtil.parseObj(tuple.getValue());
                long fromId = event.getLong("from");
                long toId = event.getLong("to");
                int amount = event.getInt("amount");
                long time = event.getLong("time");
                String remark = event.getStr("remark");

                // 加载昵称
                String fromName = getUserNickname(fromId);
                String toName = getUserNickname(toId);

                List<ScoreBatchResp.PlayerScoreVO> scores = new ArrayList<>();
                scores.add(ScoreBatchResp.PlayerScoreVO.builder()
                        .userId(fromId).nickname(fromName).score(-amount).build());
                scores.add(ScoreBatchResp.PlayerScoreVO.builder()
                        .userId(toId).nickname(toName).score(amount).build());

                result.add(ScoreBatchResp.builder()
                        .batchTime(Instant.ofEpochMilli(time).atZone(ZoneId.systemDefault()).toLocalDateTime())
                        .scores(scores)
                        .remark(remark)
                        .build());
            } catch (Exception ignored) {}
        }
        return result;
    }

    private String getUserNickname(Long userId) {
        Object cached = redisTemplate.opsForHash().get("sr:user:" + userId, "info");
        if (cached != null) {
            return JSONUtil.parseObj((String) cached).getStr("nickname", "");
        }
        User u = userMapper.selectById(userId);
        return u != null ? u.getNickname() : "";
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public SettleResp settleRoom(Long userId, Long roomId, boolean autoSettled) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException(ErrorCode.ROOM_NOT_FOUND);
        if (!autoSettled && !room.getOwnerId().equals(userId)) throw new BizException(ErrorCode.NOT_OWNER_SEAL);
        if (room.getStatus() != 0) throw new BizException(ErrorCode.ROOM_ARCHIVED);

        // 分布式锁：防止结算期间并发记分丢数据
        String lockKey = ROOM_PREFIX + roomId + ":lock";
        RLock lock = redissonClient.getLock(lockKey);
        try {
            if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                throw new BizException(ErrorCode.SYSTEM_BUSY);
            }
            // 加锁后二次检查，防止并发重复结算
            Room freshRoom = roomMapper.selectById(roomId);
            if (freshRoom != null && freshRoom.getStatus() != 0) {
                throw new BizException(ErrorCode.ROOM_ALREADY_ARCHIVED);
            }
            return doSettleRoom(userId, roomId, room, autoSettled);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException(ErrorCode.OPERATION_INTERRUPTED);
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    private SettleResp doSettleRoom(Long userId, Long roomId, Room room, boolean autoSettled) {
        String roomPrefix = ROOM_PREFIX + roomId + ":";

        // 本局录模式：从 MySQL 读取已生效的 round records
        if (ScoreMode.ROUND_RECORD.getCode() == (room.getScoreMode() != null ? room.getScoreMode() : 1)) {
            return doSettleRoundRecordRoom(userId, roomId, room, autoSettled, roomPrefix);
        }

        // 0. 读取归档成员快照（data Hash 的 r: 前缀字段）
        Map<Object, Object> allData = redisTemplate.opsForHash().entries(dataKey(roomId));
        Map<Long, JSONObject> memberMetaMap = new HashMap<>();
        if (allData != null) {
            for (Map.Entry<Object, Object> e : allData.entrySet()) {
                String f = (String) e.getKey();
                if (!f.startsWith("r:")) continue;
                JSONObject obj = JSONUtil.parseObj((String) e.getValue());
                memberMetaMap.put(obj.getLong("userId"), obj);
            }
        }

        // 1. 从 scores ZSet 读取最终分数
        Map<Long, Integer> playerTotalMap = new HashMap<>();
        Set<ZSetOperations.TypedTuple<String>> scoreMembers =
                redisTemplate.opsForZSet().rangeWithScores(roomPrefix + "scores", 0, -1);
        if (scoreMembers != null) {
            for (ZSetOperations.TypedTuple<String> tuple : scoreMembers) {
                String val = tuple.getValue();
                if ("init".equals(val)) continue;
                Long uid = Long.parseLong(val);
                int score = tuple.getScore() != null ? tuple.getScore().intValue() : 0;
                playerTotalMap.put(uid, score);
            }
        }
        // 确保所有房间成员都在 playerTotalMap 中（包括 0 分成员）
        for (Long memberId : memberMetaMap.keySet()) {
            playerTotalMap.putIfAbsent(memberId, 0);
        }

        // 2. 收集 events 中出现的用户 ID，三源合并
        Set<Long> eventUserIds = new HashSet<>();
        Set<String> eventJsonSetForMerge = redisTemplate.opsForZSet().range(roomPrefix + "events", 0, -1);
        if (eventJsonSetForMerge != null) {
            for (String json : eventJsonSetForMerge) {
                try {
                    JSONObject obj = JSONUtil.parseObj(json);
                    eventUserIds.add(obj.getLong("from"));
                    eventUserIds.add(obj.getLong("to"));
                } catch (Exception ignored) {}
            }
        }
        Set<Long> allMemberIds = collectArchiveUserIdsForSettle(roomId, playerTotalMap, eventUserIds);
        for (Long uid : allMemberIds) {
            playerTotalMap.putIfAbsent(uid, 0);
        }

        // 3. 从 events ZSet 构建 allRecord
        List<Map<String, Object>> allRecord = new ArrayList<>();
        Set<ZSetOperations.TypedTuple<String>> eventTuples =
                redisTemplate.opsForZSet().rangeWithScores(roomPrefix + "events", 0, -1);
        if (eventTuples != null && !eventTuples.isEmpty()) {
            List<JSONObject> eventList = new ArrayList<>();
            for (ZSetOperations.TypedTuple<String> tuple : eventTuples) {
                String json = tuple.getValue();
                if (json == null) continue;
                try {
                    eventList.add(JSONUtil.parseObj(json));
                } catch (Exception ignored) {}
            }
            eventList.sort(Comparator.comparingLong(o -> o.getLong("time", 0L)));

            for (JSONObject event : eventList) {
                long time = event.getLong("time", 0L);
                long fromId = event.getLong("from");
                long toId = event.getLong("to");
                int amount = event.getInt("amount");

                Map<String, Object> snapshot = new HashMap<>();
                snapshot.put("batchTime", time);
                List<Map<String, Object>> psList = new ArrayList<>();
                Map<String, Object> fromPs = new HashMap<>();
                fromPs.put("userId", fromId);
                fromPs.put("score", -amount);
                JSONObject fromMeta = memberMetaMap.get(fromId);
                fromPs.put("name", fromMeta != null ? fromMeta.getStr("nickname") : "");
                fromPs.put("avatar", fromMeta != null ? fromMeta.getStr("avatarUrl") : "");
                psList.add(fromPs);
                Map<String, Object> toPs = new HashMap<>();
                toPs.put("userId", toId);
                toPs.put("score", amount);
                JSONObject toMeta = memberMetaMap.get(toId);
                toPs.put("name", toMeta != null ? toMeta.getStr("nickname") : "");
                toPs.put("avatar", toMeta != null ? toMeta.getStr("avatarUrl") : "");
                psList.add(toPs);
                snapshot.put("scores", psList);
                allRecord.add(snapshot);
            }
        }

        // 2. 持久化归档元数据到 all_record
        Map<String, Object> recordMeta = new HashMap<>();
        Set<String> eventJsonSet = redisTemplate.opsForZSet().range(roomPrefix + "events", 0, -1);
        List<String> eventJsonList = eventJsonSet != null ? new ArrayList<>(eventJsonSet) : Collections.emptyList();
        if (eventJsonList != null && !eventJsonList.isEmpty()) {
            List<Map<String, Object>> events = new ArrayList<>();
            for (String eventJson : eventJsonList) {
                try {
                    events.add(JSONUtil.parseObj(eventJson));
                } catch (Exception e) {
                    log.warn("解析 transfer event 失败: {}", eventJson, e);
                }
            }
            recordMeta.put("transferEvents", events);
        }
        List<Map<String, Object>> membersSnapshot = buildMemberSnapshot(memberMetaMap, playerTotalMap.keySet());
        if (!membersSnapshot.isEmpty()) {
            recordMeta.put("membersSnapshot", membersSnapshot);
        }
        if (!recordMeta.isEmpty()) {
            allRecord.add(recordMeta);
        }

        // 5. 更新 room.all_record 并标记已归档（JSON 字段使用显式 SQL，避免 Wrapper 绕过 TypeHandler）
        room.setAllRecord(allRecord);
        room.setStatus(1);
        roomMapper.archiveRoomRecord(roomId, 1, JSONUtil.toJsonStr(allRecord));

        // 5. 更新 room_member.final_score 和 quit_time
        LocalDateTime now = LocalDateTime.now();
        for (Map.Entry<Long, Integer> entry : playerTotalMap.entrySet()) {
            roomMemberMapper.update(null,
                    new LambdaUpdateWrapper<RoomMember>()
                            .eq(RoomMember::getRoomId, roomId)
                            .eq(RoomMember::getUserId, entry.getKey())
                            .set(RoomMember::getFinalScore, entry.getValue())
                            .set(RoomMember::getQuitTime, now));
        }
        log.info("更新房间 {} 成员最终分数，共 {} 人", roomId, playerTotalMap.size());

        // 6. 清理 Redis
        List<String> keysToDelete = new ArrayList<>();
        keysToDelete.add(dataKey(roomId));
        keysToDelete.add(roomPrefix + "scores");
        keysToDelete.add(roomPrefix + "events");
        redisTemplate.delete(keysToDelete);
        log.info("清理房间 {} Redis 键 {} 个", roomId, keysToDelete.size());
        // 结算后清理房间号映射，防止再次接入
        redisTemplate.delete("sr:room_no:" + room.getRoomNo());
        for (Long memberId : playerTotalMap.keySet()) {
            redisTemplate.opsForSet().remove("sr:user:rooms:" + memberId, String.valueOf(roomId));
        }

        // 7. WebSocket 通知
        scoreWebSocket.pushToRoom(String.valueOf(roomId), Map.of("type", "SETTLE"));

        // 8. 构建结算响应
        // 8.1 加载用户信息（昵称 + 头像）
        List<Long> userIdList = new ArrayList<>(playerTotalMap.keySet());
        Map<Long, User> userMap = batchLoadUsersByIds(new HashSet<>(userIdList));

        // 8.2 构建 memberScores
        List<SettleResp.MemberScore> memberScores = userIdList.stream()
                .map(uid -> {
                    User u = userMap.get(uid);
                    return SettleResp.MemberScore.builder()
                            .userId(uid)
                            .nickname(u != null ? u.getNickname() : "玩家")
                            .avatarUrl(u != null ? u.getAvatarUrl() : "")
                            .finalScore(playerTotalMap.get(uid))
                            .build();
                })
                .sorted(Comparator.comparingInt(SettleResp.MemberScore::getFinalScore).reversed())
                .collect(Collectors.toList());

        // 8.3 构建 timestamps 和 series（从 allRecord 提取）
        List<Long> timestamps = new ArrayList<>();
        Map<Long, List<Integer>> userScoreSequences = new HashMap<>();
        userIdList.forEach(uid -> userScoreSequences.put(uid, new ArrayList<>()));
        Map<Long, Integer> cumulative = new HashMap<>();
        userIdList.forEach(uid -> cumulative.put(uid, 0));

        // 收集全部用户 ID（allRecord 中可能有更多用户）
        Set<Long> allUserIds = new LinkedHashSet<>(userIdList);
        for (Map<String, Object> batch : allRecord) {
            List<Map<String, Object>> scores = (List<Map<String, Object>>) batch.get("scores");
            if (scores != null) {
                for (Map<String, Object> ps : scores) {
                    allUserIds.add(((Number) ps.get("userId")).longValue());
                }
            }
        }
        List<Long> chartUserIds = new ArrayList<>(allUserIds);
        // 确保序列 map 包含所有用户
        for (Long uid : chartUserIds) {
            userScoreSequences.putIfAbsent(uid, new ArrayList<>());
            cumulative.putIfAbsent(uid, 0);
        }

        for (Map<String, Object> batch : allRecord) {
            Object batchTimeObj = batch.get("batchTime");
            if (batchTimeObj == null) continue;
            long batchTime = ((Number) batchTimeObj).longValue();
            timestamps.add(batchTime);

            List<Map<String, Object>> scores = (List<Map<String, Object>>) batch.get("scores");
            if (scores != null) {
                for (Map<String, Object> ps : scores) {
                    long uid = ((Number) ps.get("userId")).longValue();
                    int score = ((Number) ps.get("score")).intValue();
                    cumulative.merge(uid, score, Integer::sum);
                }
            }

            for (Long uid : chartUserIds) {
                userScoreSequences.get(uid).add(cumulative.getOrDefault(uid, 0));
            }
        }

        Map<Long, String> nicknameMap = new HashMap<>();
        for (Long uid : chartUserIds) {
            User u = userMap.get(uid);
            if (u != null) {
                nicknameMap.put(uid, u.getNickname());
            }
        }
        // 补充可能缺失的用户
        Set<Long> missingUsers = chartUserIds.stream()
                .filter(uid -> !nicknameMap.containsKey(uid))
                .collect(Collectors.toSet());
        if (!missingUsers.isEmpty()) {
            Map<Long, User> extraUsers = batchLoadUsersByIds(missingUsers);
            for (Map.Entry<Long, User> entry : extraUsers.entrySet()) {
                nicknameMap.put(entry.getKey(), entry.getValue().getNickname());
            }
        }

        List<ChartDataResp.Series> seriesList = chartUserIds.stream()
                .map(uid -> ChartDataResp.Series.builder()
                        .userId(uid)
                        .nickname(nicknameMap.getOrDefault(uid, "玩家"))
                        .scores(userScoreSequences.get(uid))
                        .build())
                .collect(Collectors.toList());

        lastTtlRefresh.remove(roomId);

        // 异步重算身份等级 + 清理封存相关缓存（非关键路径）
        final var settledUserIds = new ArrayList<>(playerTotalMap.keySet());
        asyncExecutor.execute(() -> {
            String today = java.time.LocalDate.now().toString();
            for (Long uid : settledUserIds) {
                try {
                    identityLevelService.recalculate(uid);
                } catch (Exception e) {
                    log.warn("异步重算身份等级失败: userId={}", uid, e);
                }
                // 清理镜像缓存，下次访问重新计算
                try {
                    redisTemplate.delete("sr:mirror:stats:" + uid);
                    redisTemplate.delete("sr:mirror:profile:" + uid);
                } catch (Exception e) {
                    log.warn("清理镜像缓存失败: userId={}", uid, e);
                }
                // 清理今日策略缓存，下次访问使用新样本
                try {
                    redisTemplate.delete("sr:fortune:" + uid + ":" + today);
                } catch (Exception e) {
                    log.warn("清理策略缓存失败: userId={}", uid, e);
                }
            }
        });

        return SettleResp.builder()
                .roomId(roomId)
                .roomNo(room.getRoomNo())
                .timestamps(timestamps)
                .series(seriesList)
                .memberScores(memberScores)
                .autoSettled(autoSettled)
                .build();
    }

    /**
     * 本局录模式结算：从 MySQL round_record 表读取已生效记录
     */
    private SettleResp doSettleRoundRecordRoom(Long userId, Long roomId, Room room, boolean autoSettled, String roomPrefix) {
        // 1. 读取所有已生效的 round records
        List<RoundRecord> records = roundRecordMapper.selectList(
                new LambdaQueryWrapper<RoundRecord>()
                        .eq(RoundRecord::getRoomId, roomId)
                        .eq(RoundRecord::getStatus, RoundRecordStatus.APPLIED.getCode())
                        .orderByAsc(RoundRecord::getCreatedAt));

        List<Map<String, Object>> allRecord = new ArrayList<>();
        Map<Long, Integer> playerTotalMap = new HashMap<>();

        for (RoundRecord record : records) {
            List<RoundRecordDetail> details = roundRecordDetailMapper.selectList(
                    new LambdaQueryWrapper<RoundRecordDetail>()
                            .eq(RoundRecordDetail::getRoundRecordId, record.getId()));

            Map<String, Object> batchRecord = new HashMap<>();
            batchRecord.put("type", "ROUND_RECORD");
            batchRecord.put("batchTime", record.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli());
            batchRecord.put("roundId", record.getId());
            batchRecord.put("inputMethod", record.getInputMethod());
            batchRecord.put("trustMode", record.getTrustMode());
            batchRecord.put("zeroSumRequired", record.getZeroSumRequired());

            List<Map<String, Object>> playerScores = new ArrayList<>();
            for (RoundRecordDetail detail : details) {
                playerTotalMap.merge(detail.getUserId(), detail.getScore(), Integer::sum);

                Map<String, Object> ps = new HashMap<>();
                ps.put("userId", detail.getUserId());
                ps.put("score", detail.getScore());
                playerScores.add(ps);
            }
            batchRecord.put("scores", playerScores);
            batchRecord.put("totalScore", record.getTotalScore());
            allRecord.add(batchRecord);
        }

        // 2. 确保所有归档成员都在 playerTotalMap 中
        Map<Object, Object> allData = redisTemplate.opsForHash().entries(dataKey(roomId));
        Map<Long, JSONObject> memberMetaMap = new HashMap<>();
        if (allData != null) {
            for (Map.Entry<Object, Object> e : allData.entrySet()) {
                String f = (String) e.getKey();
                if (!f.startsWith("r:")) continue;
                JSONObject obj = JSONUtil.parseObj((String) e.getValue());
                Long memberId = obj.getLong("userId");
                memberMetaMap.put(memberId, obj);
                playerTotalMap.putIfAbsent(memberId, 0);
            }
        } else {
            // 兼容降级：从 DB 读取
            List<RoomMember> members = roomMemberMapper.selectList(
                    new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
            for (RoomMember m : members) {
                playerTotalMap.putIfAbsent(m.getUserId(), 0);
            }
        }

        List<Map<String, Object>> membersSnapshot = buildMemberSnapshot(memberMetaMap, playerTotalMap.keySet());
        if (!membersSnapshot.isEmpty()) {
            Map<String, Object> recordMeta = new HashMap<>();
            recordMeta.put("membersSnapshot", membersSnapshot);
            allRecord.add(recordMeta);
        }

        // 3. 更新 room.all_record 并标记已归档（JSON 字段使用显式 SQL，避免 Wrapper 绕过 TypeHandler）
        room.setAllRecord(allRecord);
        room.setStatus(1);
        roomMapper.archiveRoomRecord(roomId, 1, JSONUtil.toJsonStr(allRecord));

        // 4. 更新 room_member.final_score 和 quit_time
        LocalDateTime now = LocalDateTime.now();
        for (Map.Entry<Long, Integer> entry : playerTotalMap.entrySet()) {
            roomMemberMapper.update(null,
                    new LambdaUpdateWrapper<RoomMember>()
                            .eq(RoomMember::getRoomId, roomId)
                            .eq(RoomMember::getUserId, entry.getKey())
                            .set(RoomMember::getFinalScore, entry.getValue())
                            .set(RoomMember::getQuitTime, now));
        }

        // 5. 清理 Redis
        List<String> keysToDelete = new ArrayList<>(List.of(
                dataKey(roomId), roomPrefix + "round:data",
                roomPrefix + "scores", roomPrefix + "events"));
        redisTemplate.delete(keysToDelete);
        // 结算后清理房间号映射，防止再次接入
        redisTemplate.delete("sr:room_no:" + room.getRoomNo());
        for (Long memberId : playerTotalMap.keySet()) {
            redisTemplate.opsForSet().remove("sr:user:rooms:" + memberId, String.valueOf(roomId));
        }

        // 6. WebSocket 通知
        scoreWebSocket.pushToRoom(String.valueOf(roomId), Map.of("type", "SETTLE"));

        // 7. 构建结算响应
        List<SettleResp.MemberScore> memberScores = new ArrayList<>();
        List<Long> userIdList = new ArrayList<>(playerTotalMap.keySet());
        Map<Long, String> nicknameMap = new HashMap<>();
        Map<Long, String> avatarUrlMap = new HashMap<>();
        for (Long uid : userIdList) {
            Object userJsonRaw = redisTemplate.opsForHash().get("sr:user:" + uid, "info");
            String userJson = userJsonRaw != null ? (String) userJsonRaw : null;
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
        for (Map.Entry<Long, Integer> entry : playerTotalMap.entrySet()) {
            memberScores.add(SettleResp.MemberScore.builder()
                    .userId(entry.getKey())
                    .nickname(nicknameMap.getOrDefault(entry.getKey(), ""))
                    .avatarUrl(avatarUrlMap.getOrDefault(entry.getKey(), ""))
                    .finalScore(entry.getValue())
                    .build());
        }
        memberScores.sort((a, b) -> Integer.compare(b.getFinalScore(), a.getFinalScore()));

        // 构建图表数据
        List<Long> timestamps = new ArrayList<>();
        Map<Long, List<Integer>> userScoreSequences = new HashMap<>();
        Map<Long, Integer> cumulative = new HashMap<>();
        for (Long uid : userIdList) {
            userScoreSequences.put(uid, new ArrayList<>());
            cumulative.put(uid, 0);
        }
        for (Map<String, Object> batch : allRecord) {
            Object batchTimeObj = batch.get("batchTime");
            if (batchTimeObj == null) continue;
            timestamps.add(((Number) batchTimeObj).longValue());
            List<Map<String, Object>> scores = (List<Map<String, Object>>) batch.get("scores");
            if (scores != null) {
                for (Map<String, Object> ps : scores) {
                    long uid = ((Number) ps.get("userId")).longValue();
                    int score = ((Number) ps.get("score")).intValue();
                    cumulative.merge(uid, score, Integer::sum);
                }
            }
            for (Long uid : userIdList) {
                userScoreSequences.get(uid).add(cumulative.getOrDefault(uid, 0));
            }
        }
        List<ChartDataResp.Series> seriesList = userIdList.stream()
                .map(uid -> ChartDataResp.Series.builder()
                        .userId(uid)
                        .nickname(nicknameMap.getOrDefault(uid, "玩家"))
                        .scores(userScoreSequences.get(uid))
                        .build())
                .collect(Collectors.toList());

        lastTtlRefresh.remove(roomId);

        // 异步重算身份等级 + 清理封存相关缓存（非关键路径）
        final var settledUserIds2 = new ArrayList<>(playerTotalMap.keySet());
        asyncExecutor.execute(() -> {
            String today = java.time.LocalDate.now().toString();
            for (Long uid : settledUserIds2) {
                try {
                    identityLevelService.recalculate(uid);
                } catch (Exception e) {
                    log.warn("异步重算身份等级失败: userId={}", uid, e);
                }
                // 清理镜像缓存，下次访问重新计算
                try {
                    redisTemplate.delete("sr:mirror:stats:" + uid);
                    redisTemplate.delete("sr:mirror:profile:" + uid);
                } catch (Exception e) {
                    log.warn("清理镜像缓存失败: userId={}", uid, e);
                }
                // 清理今日策略缓存，下次访问使用新样本
                try {
                    redisTemplate.delete("sr:fortune:" + uid + ":" + today);
                } catch (Exception e) {
                    log.warn("清理策略缓存失败: userId={}", uid, e);
                }
            }
        });

        return SettleResp.builder()
                .roomId(roomId)
                .roomNo(room.getRoomNo())
                .timestamps(timestamps)
                .series(seriesList)
                .memberScores(memberScores)
                .autoSettled(autoSettled)
                .build();
    }

    @Override
    public ChartDataResp getChartData(Long roomId) {
        return overviewService.getChartData(roomId);
    }

    @Override
    public TrendResp getTrend(Long userId, int limit) {
        List<Map<String, Object>> rows = roomMemberMapper.selectTrendByUserId(userId, limit);
        if (rows.isEmpty()) {
            return TrendResp.builder().points(Collections.emptyList()).build();
        }

        // 反转为时间正序（查询返回倒序）
        List<TrendResp.Point> points = new ArrayList<>();
        for (int i = rows.size() - 1; i >= 0; i--) {
            Map<String, Object> row = rows.get(i);
            Long roomId = ((Number) row.get("roomId")).longValue();
            Integer netScore = ((Number) row.get("netScore")).intValue();
            Object latestAt = row.get("latestAt");
            String date = "";
            if (latestAt instanceof java.sql.Timestamp) {
                date = ((java.sql.Timestamp) latestAt).toLocalDateTime()
                        .toLocalDate().toString();
            } else if (latestAt != null) {
                date = latestAt.toString().substring(0, 10);
            }
            points.add(TrendResp.Point.builder()
                    .roomId(roomId)
                    .date(date)
                    .netScore(netScore)
                    .build());
        }

        return TrendResp.builder().points(points).build();
    }

    @Override
    public YieldLogResp getYieldLog(Long userId) {
        // 1. 获取趋势数据
        List<Map<String, Object>> trendRows = roomMemberMapper.selectTrendByUserId(userId, 20);

        int netYield = 0;
        List<YieldLogResp.CurvePoint> curvePoints = new ArrayList<>();
        for (int i = trendRows.size() - 1; i >= 0; i--) {
            Map<String, Object> row = trendRows.get(i);
            Integer netScore = ((Number) row.get("netScore")).intValue();
            netYield += netScore;

            Long roomId = ((Number) row.get("roomId")).longValue();
            Object latestAt = row.get("latestAt");
            String date = "";
            if (latestAt instanceof java.sql.Timestamp) {
                date = ((java.sql.Timestamp) latestAt).toLocalDateTime().toLocalDate().toString();
            } else if (latestAt != null) {
                date = latestAt.toString().substring(0, 10);
            }
            curvePoints.add(YieldLogResp.CurvePoint.builder()
                    .roomId(roomId)
                    .date(date)
                    .netScore(netScore)
                    .build());
        }

        // 2. 获取历史房间
        List<RoomResp> historyRooms = roomService.getHistory(userId);

        List<YieldLogResp.Record> records = new ArrayList<>();
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm");
        for (RoomResp room : historyRooms) {
            String settledAt = room.getCreatedAt() != null ? room.getCreatedAt().format(fmt) : "";

            int myScore = 0;
            int myRank = 1;
            int memberCount = room.getMembers() != null ? room.getMembers().size() : 0;
            // 收集全员分数用于排名计算
            List<Integer> allScores = new ArrayList<>();
            for (RoomResp.MemberVO member : room.getMembers()) {
                int score = member.getFinalScore() != null ? member.getFinalScore() : 0;
                allScores.add(score);
                if (member.getUserId().equals(userId)) {
                    myScore = score;
                }
            }
            // 排名：分数高于当前用户的人数 + 1
            for (int s : allScores) {
                if (s > myScore) myRank++;
            }

            records.add(YieldLogResp.Record.builder()
                    .roomId(room.getRoomId())
                    .roomNo(room.getRoomNo())
                    .settledAt(settledAt)
                    .myScore(myScore)
                    .myRank(myRank)
                    .memberCount(memberCount)
                    .build());
        }

        return YieldLogResp.builder()
                .netYield(netYield)
                .sampleCount(trendRows.size())
                .curveUnlockCount(2)
                .curveData(curvePoints)
                .records(records)
                .build();
    }

    @Override
    public RoomInsightResp getRoomInsight(Long roomId) {
        String eventsKey = ROOM_PREFIX + roomId + ":events";
        Set<String> events = redisTemplate.opsForZSet().range(eventsKey, 0, -1);
        if (events == null || events.isEmpty()) {
            // Redis 无数据，尝试从 MySQL allRecord 回退
            return getRoomInsightFromDb(roomId);
        }

        int totalTransfer = 0;
        int maxSingle = 0;
        Map<Long, Integer> userCount = new HashMap<>();

        for (String json : events) {
            JSONObject obj = JSONUtil.parseObj(json);
            long from = obj.getLong("from", 0L);
            long to = obj.getLong("to", 0L);
            int amount = obj.getInt("amount", 0);

            totalTransfer += amount;
            if (amount > maxSingle) maxSingle = amount;
            userCount.merge(from, 1, Integer::sum);
            userCount.merge(to, 1, Integer::sum);
        }

        // 最活跃用户
        RoomInsightResp.ActiveUser activeUser = null;
        if (!userCount.isEmpty()) {
            Map.Entry<Long, Integer> top = Collections.max(userCount.entrySet(), Map.Entry.comparingByValue());
            User user = userMapper.selectById(top.getKey());
            activeUser = RoomInsightResp.ActiveUser.builder()
                    .userId(top.getKey())
                    .nickname(user != null ? user.getNickname() : "未知")
                    .avatarUrl(user != null ? user.getAvatarUrl() : null)
                    .count(top.getValue())
                    .build();
        }

        // 互动密度：用事件中实际参与的用户数，排除 ZSet 中的 init 哨兵
        int n = userCount.size();
        double density = (n > 1) ? (double) events.size() / (n * (n - 1)) : 0;
        String densityLevel = density > 0.3 ? "HIGH" : density > 0.1 ? "MEDIUM" : "LOW";

        return RoomInsightResp.builder()
                .totalTransfer(totalTransfer)
                .maxSingleTransfer(maxSingle)
                .mostActiveUser(activeUser)
                .transferCount(events.size())
                .networkDensity(densityLevel)
                .build();
    }

    @Override
    public RoomNetworkResp getRoomNetwork(Long roomId) {
        String eventsKey = ROOM_PREFIX + roomId + ":events";
        Set<String> events = redisTemplate.opsForZSet().range(eventsKey, 0, -1);

        // 获取排行榜（当前分数）
        String scoresKey = ROOM_PREFIX + roomId + ":scores";
        Set<ZSetOperations.TypedTuple<String>> scoreSet =
                redisTemplate.opsForZSet().reverseRangeWithScores(scoresKey, 0, -1);

        // Redis 无数据，尝试从 MySQL allRecord 回退
        boolean noEvents = (events == null || events.isEmpty());
        boolean noScores = (scoreSet == null || scoreSet.isEmpty());
        if (noEvents && noScores) {
            return getRoomNetworkFromDb(roomId);
        }

        // 构建 nodes
        List<RoomNetworkResp.Node> nodes = new ArrayList<>();
        if (scoreSet != null) {
            for (ZSetOperations.TypedTuple<String> tuple : scoreSet) {
                String rawUserId = tuple.getValue();
                if (rawUserId == null || "init".equals(rawUserId)) continue;
                Long userId = Long.valueOf(rawUserId);
                Double score = tuple.getScore();
                User user = userMapper.selectById(userId);
                nodes.add(RoomNetworkResp.Node.builder()
                        .userId(userId)
                        .nickname(user != null ? user.getNickname() : "未知")
                        .avatarUrl(user != null ? user.getAvatarUrl() : null)
                        .score(score != null ? score.intValue() : 0)
                        .build());
            }
        }

        // 构建 links
        Map<String, int[]> pairMap = new HashMap<>();
        if (events != null) {
            for (String json : events) {
                JSONObject obj = JSONUtil.parseObj(json);
                long from = obj.getLong("from", 0L);
                long to = obj.getLong("to", 0L);
                int amount = obj.getInt("amount", 0);

                String key = from + ":" + to;
                pairMap.merge(key, new int[]{amount, 1}, (a, b) -> {
                    a[0] += b[0];
                    a[1] += b[1];
                    return a;
                });
            }
        }

        List<RoomNetworkResp.Link> links = new ArrayList<>();
        for (Map.Entry<String, int[]> entry : pairMap.entrySet()) {
            String[] parts = entry.getKey().split(":");
            long from = Long.parseLong(parts[0]);
            long to = Long.parseLong(parts[1]);
            links.add(RoomNetworkResp.Link.builder()
                    .from(from)
                    .to(to)
                    .netAmount(entry.getValue()[0])
                    .count(entry.getValue()[1])
                    .build());
        }

        return RoomNetworkResp.builder()
                .nodes(nodes)
                .links(links)
                .build();
    }

    /**
     * 从 MySQL allRecord 回退计算战局洞察（settle 后 Redis 已清理的场景）
     */
    private RoomInsightResp getRoomInsightFromDb(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getAllRecord() == null || room.getAllRecord().isEmpty()) {
            return RoomInsightResp.builder()
                    .totalTransfer(0).maxSingleTransfer(0)
                    .mostActiveUser(null).transferCount(0)
                    .networkDensity("LOW").build();
        }

        int totalTransfer = 0;
        int maxSingle = 0;
        Map<Long, Integer> userCount = new HashMap<>();

        for (Map<String, Object> record : room.getAllRecord()) {
            Object te = record.get("transferEvents");
            if (!(te instanceof List)) continue;
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> transfers = (List<Map<String, Object>>) te;
            for (Map<String, Object> evt : transfers) {
                long from = ((Number) evt.get("from")).longValue();
                long to = ((Number) evt.get("to")).longValue();
                int amount = ((Number) evt.get("amount")).intValue();
                totalTransfer += amount;
                if (amount > maxSingle) maxSingle = amount;
                userCount.merge(from, 1, Integer::sum);
                userCount.merge(to, 1, Integer::sum);
            }
        }

        // 最活跃用户
        RoomInsightResp.ActiveUser activeUser = null;
        if (!userCount.isEmpty()) {
            Map.Entry<Long, Integer> top = Collections.max(userCount.entrySet(), Map.Entry.comparingByValue());
            User user = userMapper.selectById(top.getKey());
            activeUser = RoomInsightResp.ActiveUser.builder()
                    .userId(top.getKey())
                    .nickname(user != null ? user.getNickname() : "未知")
                    .avatarUrl(user != null ? user.getAvatarUrl() : null)
                    .count(top.getValue()).build();
        }

        // 互动密度：从 scores 收集唯一成员数
        Set<Long> memberIds = new HashSet<>();
        for (Map<String, Object> record : room.getAllRecord()) {
            Object scoresObj = record.get("scores");
            if (!(scoresObj instanceof List)) continue;
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> scores = (List<Map<String, Object>>) scoresObj;
            for (Map<String, Object> s : scores) {
                memberIds.add(((Number) s.get("userId")).longValue());
            }
        }
        int n = memberIds.size();
        int eventCount = userCount.values().stream().mapToInt(Integer::intValue).sum() / 2;
        double density = (n > 1) ? (double) eventCount / (n * (n - 1)) : 0;
        String densityLevel = density > 0.3 ? "HIGH" : density > 0.1 ? "MEDIUM" : "LOW";

        return RoomInsightResp.builder()
                .totalTransfer(totalTransfer)
                .maxSingleTransfer(maxSingle)
                .mostActiveUser(activeUser)
                .transferCount(eventCount)
                .networkDensity(densityLevel).build();
    }

    /**
     * 从 MySQL allRecord 回退计算积分关系网络（settle 后 Redis 已清理的场景）
     */
    private RoomNetworkResp getRoomNetworkFromDb(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getAllRecord() == null || room.getAllRecord().isEmpty()) {
            return RoomNetworkResp.builder().nodes(List.of()).links(List.of()).build();
        }

        // 从 allRecord 聚合最终得分
        Map<Long, Integer> finalScores = new LinkedHashMap<>();
        Map<Long, String> nicknames = new LinkedHashMap<>();
        for (Map<String, Object> record : room.getAllRecord()) {
            Object scoresObj = record.get("scores");
            if (!(scoresObj instanceof List)) continue;
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> scores = (List<Map<String, Object>>) scoresObj;
            for (Map<String, Object> s : scores) {
                long uid = ((Number) s.get("userId")).longValue();
                int score = ((Number) s.get("score")).intValue();
                finalScores.merge(uid, score, Integer::sum);
                String name = (String) s.get("name");
                if (name != null) nicknames.putIfAbsent(uid, name);
            }
        }

        // 构建 nodes
        List<RoomNetworkResp.Node> nodes = new ArrayList<>();
        for (Map.Entry<Long, Integer> e : finalScores.entrySet()) {
            User user = userMapper.selectById(e.getKey());
            nodes.add(RoomNetworkResp.Node.builder()
                    .userId(e.getKey())
                    .nickname(user != null ? user.getNickname() : nicknames.getOrDefault(e.getKey(), "未知"))
                    .avatarUrl(user != null ? user.getAvatarUrl() : null)
                    .score(e.getValue()).build());
        }

        // 构建 links
        Map<String, int[]> pairMap = new HashMap<>();
        for (Map<String, Object> record : room.getAllRecord()) {
            Object te = record.get("transferEvents");
            if (!(te instanceof List)) continue;
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> transfers = (List<Map<String, Object>>) te;
            for (Map<String, Object> evt : transfers) {
                long from = ((Number) evt.get("from")).longValue();
                long to = ((Number) evt.get("to")).longValue();
                int amount = ((Number) evt.get("amount")).intValue();
                String key = from + ":" + to;
                pairMap.merge(key, new int[]{amount, 1}, (a, b) -> {
                    a[0] += b[0];
                    a[1] += b[1];
                    return a;
                });
            }
        }

        List<RoomNetworkResp.Link> links = new ArrayList<>();
        for (Map.Entry<String, int[]> e : pairMap.entrySet()) {
            String[] parts = e.getKey().split(":");
            links.add(RoomNetworkResp.Link.builder()
                    .from(Long.parseLong(parts[0]))
                    .to(Long.parseLong(parts[1]))
                    .netAmount(e.getValue()[0])
                    .count(e.getValue()[1]).build());
        }

        return RoomNetworkResp.builder().nodes(nodes).links(links).build();
    }

    // ===== 私有方法 =====

    private Map<Long, Integer> getPlayerTotalsFromRedis(Long roomId) {
        String scoresKey = ROOM_PREFIX + roomId + ":scores";
        Set<ZSetOperations.TypedTuple<String>> tuples =
                redisTemplate.opsForZSet().reverseRangeWithScores(scoresKey, 0, -1);

        Map<Long, Integer> result = new HashMap<>();
        if (tuples != null) {
            for (ZSetOperations.TypedTuple<String> t : tuples) {
                String uid = t.getValue();
                if (uid != null && !"init".equals(uid)) {
                    result.put(Long.parseLong(uid), t.getScore().intValue());
                }
            }
        }
        return result;
    }

    private Map<Long, Integer> getPlayerTotalsFromMySQL(Long roomId) {
        List<Map<String, Object>> rows = roomMemberMapper.selectFinalScoresByRoomId(roomId);
        Map<Long, Integer> result = new HashMap<>();
        for (Map<String, Object> row : rows) {
            Long userId = ((Number) row.get("user_id")).longValue();
            Integer total = ((Number) row.get("total")).intValue();
            result.put(userId, total);
        }
        return result;
    }

    @Override
    public TransferScoreResp transferScore(Long userId, TransferScoreReq req) {
        if (userId.equals(req.getToUserId())) {
            throw new BizException(ErrorCode.SCORE_SELF_TRANSFER);
        }

        Long roomId = req.getRoomId();

        // 验证房间存在且活跃
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) {
            throw new BizException(ErrorCode.ROOM_NOT_FOUND);
        }

        if (!isActiveRoomMember(roomId, userId) || !isActiveRoomMember(roomId, req.getToUserId())) {
            throw new BizException(ErrorCode.SCORE_NOT_ROOM_MEMBER);
        }

        // 执行 Lua 脚本：原子完成 扣分 + 加分
        String scoresKey = ROOM_PREFIX + roomId + ":scores";
        try {
            Long result = redisTemplate.execute(TRANSFER_SCRIPT,
                    List.of(scoresKey),
                    String.valueOf(userId),
                    String.valueOf(req.getToUserId()),
                    String.valueOf(req.getAmount()));
            if (result == null || result == 0) {
                throw new BizException(ErrorCode.ROOM_ARCHIVED_OR_FAILED);
            }
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lua 计分执行异常: roomId={}, from={}, to={}, amount={}",
                    roomId, userId, req.getToUserId(), req.getAmount(), e);
            throw new BizException(ErrorCode.SYSTEM_BUSY);
        }

        // 节流刷新 TTL（每房间最多 30 秒一次，避免每次计分执行 11+ 次 EXPIRE）
        long now = System.currentTimeMillis();
        boolean shouldRefresh = lastTtlRefresh.compute(roomId, (k, last) ->
                (last == null || now - last > 30_000) ? now : last) == now;
        if (shouldRefresh) {
            refreshRoomTtl(roomId);
        }

        // 异步更新最后活跃时间（非关键路径，不阻塞响应）
        asyncExecutor.execute(() -> {
            try {
                touchActiveRoom(roomId);
            } catch (Exception e) {
                log.warn("异步更新 lastActiveAt 失败: roomId={}", roomId, e);
            }
        });

        // 记录流水到 Redis events Sorted Set（timestamp 为 score，支持分页）
        Map<String, Object> event = new HashMap<>();
        event.put("from", userId);
        event.put("to", req.getToUserId());
        event.put("amount", req.getAmount());
        event.put("time", now);
        if (req.getRemark() != null) event.put("remark", req.getRemark());
        redisTemplate.opsForZSet().add(
                ROOM_PREFIX + roomId + ":events", JSONUtil.toJsonStr(event), now);
        redisTemplate.expire(ROOM_PREFIX + roomId + ":events", ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
        recordTransferAmountRank(roomId, userId, req.getAmount());

        // 读取双方最新分数（一次 Redis 调用，附加到 WS 推送供观察者本地更新）
        Double fromScore = redisTemplate.opsForZSet().score(scoresKey, String.valueOf(userId));
        Double toScore = redisTemplate.opsForZSet().score(scoresKey, String.valueOf(req.getToUserId()));

        // 异步 WebSocket 推送（含最新分数，避免慢客户端阻塞响应）
        String roomIdStr = String.valueOf(roomId);
        Map<String, Object> pushData = new HashMap<>();
        pushData.put("type", "TRANSFER");
        pushData.put("roomId", roomIdStr);
        pushData.put("fromUserId", String.valueOf(userId));
        pushData.put("toUserId", String.valueOf(req.getToUserId()));
        pushData.put("amount", req.getAmount());
        pushData.put("fromNewScore", fromScore != null ? fromScore.intValue() : 0);
        pushData.put("toNewScore", toScore != null ? toScore.intValue() : 0);
        asyncExecutor.execute(() -> {
            try {
                scoreWebSocket.pushToRoom(roomIdStr, pushData);
            } catch (Exception e) {
                log.warn("异步 WebSocket 推送失败: roomId={}", roomId, e);
            }
        });

        // 异步更新总览缓存
        overviewService.computeOverview(roomId);

        return TransferScoreResp.builder()
                .id(now)
                .fromUser(TransferScoreResp.UserInfo.builder().userId(userId).build())
                .toUser(TransferScoreResp.UserInfo.builder().userId(req.getToUserId()).build())
                .amount(req.getAmount())
                .amountDisplay(String.format("%.2f", req.getAmount() / 100.0))
                .remark(req.getRemark())
                .createdAt(LocalDateTime.now())
                .build();
    }

    private void recordTransferAmountRank(Long roomId, Long userId, Integer amount) {
        if (roomId == null || userId == null || amount == null || amount <= 0) return;
        try {
            String key = ROOM_PREFIX + roomId + ":transfer:amount";
            String member = String.valueOf(amount);
            redisTemplate.opsForZSet().incrementScore(key, "u:" + userId + ":" + member, 1);
            redisTemplate.opsForZSet().incrementScore(key, "all:" + member, 1);
            redisTemplate.expire(key, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
        } catch (Exception e) {
            log.warn("更新常用转出金额排行失败: roomId={}, userId={}", roomId, userId, e);
        }
    }

    @Override
    public TransferAmountSuggestionResp getTransferAmountSuggestions(Long userId, Long roomId) {
        if (roomId == null) throw new BizException(ErrorCode.BAD_REQUEST, "编队 ID 不能为空");

        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) {
            throw new BizException(ErrorCode.ROOM_NOT_FOUND);
        }
        if (!isActiveRoomMember(roomId, userId)) {
            throw new BizException(ErrorCode.NOT_ROOM_MEMBER);
        }

        List<TransferAmountSuggestionResp.Item> items = new ArrayList<>(6);
        Set<Integer> used = new LinkedHashSet<>();

        String transferKey = ROOM_PREFIX + roomId + ":transfer:amount";
        appendAmountRankItems(items, used, transferKey, "u:" + userId + ":", "crew", "常发", 3);
        appendAmountRankItems(items, used, transferKey, "all:", "space", "编队", 3);

        boolean fallback = items.size() < 6;
        appendFallbackAmountItems(items, used, roomId, userId);

        return TransferAmountSuggestionResp.builder()
                .fallback(fallback)
                .items(items.size() > 6 ? items.subList(0, 6) : items)
                .build();
    }

    private void appendAmountRankItems(List<TransferAmountSuggestionResp.Item> items,
                                       Set<Integer> used,
                                       String key,
                                       String memberPrefix,
                                       String source,
                                       String label,
                                       int limit) {
        Set<ZSetOperations.TypedTuple<String>> tuples = redisTemplate.opsForZSet()
                .reverseRangeWithScores(key, 0, -1);
        if (tuples == null || tuples.isEmpty()) return;

        int added = 0;
        for (ZSetOperations.TypedTuple<String> tuple : tuples) {
            if (added >= limit || items.size() >= 6) break;
            String member = tuple.getValue();
            if (!member.startsWith(memberPrefix)) continue;
            Integer amount = parsePositiveAmount(member.substring(memberPrefix.length()));
            if (amount == null || !used.add(amount)) continue;
            items.add(TransferAmountSuggestionResp.Item.builder()
                    .amount(amount)
                    .source(source)
                    .label(label)
                    .build());
            added++;
        }
    }

    private void appendFallbackAmountItems(List<TransferAmountSuggestionResp.Item> items,
                                           Set<Integer> used,
                                           Long roomId,
                                           Long userId) {
        List<Integer> pool = new ArrayList<>(List.of(1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30, 50, 66, 88, 100));
        Collections.shuffle(pool, new Random(Objects.hash(roomId, userId, LocalDate.now())));
        for (Integer amount : pool) {
            if (items.size() >= 6) break;
            if (!used.add(amount)) continue;
            items.add(TransferAmountSuggestionResp.Item.builder()
                    .amount(amount)
                    .source("random")
                    .label("推荐")
                    .build());
        }
    }

    private Integer parsePositiveAmount(String value) {
        if (value == null) return null;
        try {
            int amount = Integer.parseInt(value);
            return amount > 0 ? amount : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void touchActiveRoom(Long roomId) {
        roomMapper.update(null, new LambdaUpdateWrapper<Room>()
                .eq(Room::getId, roomId)
                .eq(Room::getStatus, 0)
                .set(Room::getLastActiveAt, LocalDateTime.now()));
    }

    @Override
    public PageResult<TransferScoreResp> getRoomTransfers(Long roomId, int page, int size) {
        String eventsKey = ROOM_PREFIX + roomId + ":events";

        // 使用 Sorted Set 分页查询（按 score 倒序，即时间倒序）
        Long total = redisTemplate.opsForZSet().zCard(eventsKey);
        if (total == null || total == 0) {
            return PageResult.of(0, List.of());
        }

        long start = (long) (page - 1) * size;
        if (start >= total) {
            return PageResult.of(total, List.of());
        }

        Set<String> rawEvents = redisTemplate.opsForZSet().reverseRange(eventsKey, start, start + size - 1);
        if (rawEvents == null || rawEvents.isEmpty()) {
            return PageResult.of(total, List.of());
        }

        List<JSONObject> pageEvents = new ArrayList<>();
        for (String raw : rawEvents) {
            try {
                pageEvents.add(JSONUtil.parseObj(raw));
            } catch (Exception e) {
                log.warn("解析计分流水失败: {}", raw, e);
            }
        }

        // 批量加载用户信息
        Set<Long> userIds = new HashSet<>();
        for (JSONObject e : pageEvents) {
            userIds.add(e.getLong("from"));
            userIds.add(e.getLong("to"));
        }
        Map<Long, User> userMap = batchLoadUsersByIds(userIds);

        // 组装响应
        List<TransferScoreResp> records = pageEvents.stream().map(e -> {
            Long fromId = e.getLong("from");
            Long toId = e.getLong("to");
            User fromUser = userMap.get(fromId);
            User toUser = userMap.get(toId);
            int amount = e.getInt("amount");
            long ts = e.getLong("time", 0L);
            return TransferScoreResp.builder()
                    .id(ts)
                    .fromUser(TransferScoreResp.UserInfo.builder()
                            .userId(fromId)
                            .nickname(fromUser != null ? fromUser.getNickname() : "")
                            .avatarUrl(fromUser != null ? fromUser.getAvatarUrl() : "")
                            .build())
                    .toUser(TransferScoreResp.UserInfo.builder()
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

    private Map<Long, User> batchLoadUsersByIds(Set<Long> userIds) {
        if (userIds.isEmpty()) return Collections.emptyMap();

        Map<Long, User> userMap = new HashMap<>();
        List<Long> missedIds = new ArrayList<>();
        List<Long> idList = new ArrayList<>(userIds);

        for (int i = 0; i < idList.size(); i++) {
            Long uid = idList.get(i);
            Object cached = redisTemplate.opsForHash().get("sr:user:" + uid, "info");
            if (cached != null) {
                JSONObject obj = JSONUtil.parseObj((String) cached);
                User u = new User();
                u.setId(uid);
                u.setNickname(obj.getStr("nickname", ""));
                u.setAvatarUrl(obj.getStr("avatarUrl", ""));
                userMap.put(uid, u);
            } else {
                missedIds.add(uid);
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

    private Map<Long, String> loadNicknameMap(List<Long> userIds) {
        if (userIds.isEmpty()) return Collections.emptyMap();

        Map<Long, String> map = new HashMap<>();
        List<Long> missedIds = new ArrayList<>();
        for (Long uid : userIds) {
            Object cached = redisTemplate.opsForHash().get("sr:user:" + uid, "info");
            if (cached != null) {
                JSONObject userObj = JSONUtil.parseObj((String) cached);
                map.put(uid, userObj.getStr("nickname", "玩家"));
            } else {
                missedIds.add(uid);
            }
        }

        // 降级查数据库并回写缓存
        if (!missedIds.isEmpty()) {
            List<User> users = userMapper.selectBatchIds(missedIds);
            for (User user : users) {
                map.put(user.getId(), user.getNickname());
                String createdAtStr = user.getCreatedAt() != null
                        ? user.getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                        : "";
                String json = JSONUtil.toJsonStr(Map.of(
                        "userId", user.getId(),
                        "nickname", user.getNickname() != null ? user.getNickname() : "",
                        "avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : "",
                        "status", user.getStatus() != null ? user.getStatus() : 0,
                        "createdAt", createdAtStr));
                redisTemplate.opsForHash().put("sr:user:" + user.getId(), "info", json);
            }
            for (Long uid : missedIds) {
                map.putIfAbsent(uid, "玩家");
            }
        }
        return map;
    }

    /**
     * 结算时三源合并收集用户 ID：archive + playerTotalMap + eventUserIds
     */
    private Set<Long> collectArchiveUserIdsForSettle(Long roomId, Map<Long, Integer> playerTotalMap, Set<Long> eventUserIds) {
        Set<Long> userIds = new HashSet<>();
        // 1. 归档成员（data Hash 的 r: 前缀字段）
        Map<Object, Object> allData = redisTemplate.opsForHash().entries(dataKey(roomId));
        if (allData != null) {
            for (Object key : allData.keySet()) {
                String f = (String) key;
                if (f.startsWith("r:")) {
                    try {
                        userIds.add(Long.parseLong(f.substring(2)));
                    } catch (NumberFormatException ignored) {}
                }
            }
        }
        // 2. 分数记录中的用户
        if (playerTotalMap != null) {
            userIds.addAll(playerTotalMap.keySet());
        }
        // 3. 事件记录中的用户
        if (eventUserIds != null) {
            userIds.addAll(eventUserIds);
        }
        return userIds;
    }

    /**
     * 判断用户是否仍在实时成员组
     */
    private boolean isActiveRoomMember(Long roomId, Long userId) {
        return Boolean.TRUE.equals(redisTemplate.opsForHash().hasKey(dataKey(roomId), "a:" + userId));
    }

    /**
     * 构建封存成员快照：优先使用 archive 中的昵称头像，缺失时从用户表兜底。
     */
    private List<Map<String, Object>> buildMemberSnapshot(Map<Long, JSONObject> memberMetaMap, Collection<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Collections.emptyList();
        }
        Set<Long> orderedIds = new LinkedHashSet<>(userIds);
        Map<Long, User> userMap = batchLoadUsersByIds(orderedIds);
        List<Map<String, Object>> snapshot = new ArrayList<>();
        for (Long uid : orderedIds) {
            JSONObject meta = memberMetaMap != null ? memberMetaMap.get(uid) : null;
            User user = userMap.get(uid);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("userId", uid);
            item.put("nickname", meta != null ? meta.getStr("nickname", "") : user != null ? user.getNickname() : "");
            item.put("avatarUrl", meta != null ? meta.getStr("avatarUrl", "") : user != null ? user.getAvatarUrl() : "");
            if (meta != null) {
                Object firstJoinedAt = meta.get("firstJoinedAt");
                Object lastSeenAt = meta.get("lastSeenAt");
                if (firstJoinedAt != null) item.put("firstJoinedAt", firstJoinedAt);
                if (lastSeenAt != null) item.put("lastSeenAt", lastSeenAt);
            }
            snapshot.add(item);
        }
        return snapshot;
    }

    /**
     * 滑动刷新房间所有 Redis key 的 TTL，统一 24 小时
     */
    private void refreshRoomTtl(Long roomId) {
        String prefix = ROOM_PREFIX + roomId + ":";
        long ttl = 24;
        TimeUnit unit = TimeUnit.HOURS;
        List<String> keys = List.of(
                dataKey(roomId),
                prefix + "scores",
                prefix + "events");
        for (String key : keys) {
            redisTemplate.expire(key, ttl, unit);
        }
        // 用户房间映射也刷新（从 data Hash 提取活跃成员 ID）
        Map<Object, Object> dataEntries = redisTemplate.opsForHash().entries(dataKey(roomId));
        if (dataEntries != null) {
            for (Object field : dataEntries.keySet()) {
                String f = (String) field;
                if (f.startsWith("a:")) {
                    redisTemplate.expire("sr:user:rooms:" + f.substring(2), ttl, unit);
                }
            }
        }
    }
}
