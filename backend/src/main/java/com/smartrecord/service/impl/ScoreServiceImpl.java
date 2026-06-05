package com.smartrecord.service.impl;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.common.EmotionType;
import com.smartrecord.common.PageResult;
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
    @Qualifier("asyncExecutor")
    private final Executor asyncExecutor;

    private static final String ROOM_PREFIX = "sr:room:";
    private final ConcurrentHashMap<Long, Long> lastTtlRefresh = new ConcurrentHashMap<>();

    private static final String TRANSFER_LUA = """
            local scoresKey = KEYS[1]
            local fromUser = ARGV[1]
            local toUser = ARGV[2]
            local amount = tonumber(ARGV[3])
            redis.call('ZINCRBY', scoresKey, -amount, fromUser)
            redis.call('ZINCRBY', scoresKey, amount, toUser)
            return 1
            """;

    private static final DefaultRedisScript<Long> TRANSFER_SCRIPT = new DefaultRedisScript<>(TRANSFER_LUA, Long.class);

    @Override
    public ScoreSubmitResp submitScore(Long userId, SubmitScoreReq req) {
        Long roomId = req.getRoomId();
        if (roomId == null) throw new BizException("房间 ID 不能为空");

        // 验证房间存在且活跃
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) {
            throw new BizException("房间不存在或已结束");
        }

        // 验证提交者是房间成员
        RoomMember submitter = roomMemberMapper.selectOne(
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getRoomId, roomId)
                        .eq(RoomMember::getUserId, userId));
        if (submitter == null) throw new BizException("您不是该房间成员");

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
                throw new BizException("系统繁忙，请稍后重试");
            }

            long batchTs = System.currentTimeMillis();
            String batchKey = ROOM_PREFIX + roomId + ":batch:" + batchTs;
            String scoresKey = ROOM_PREFIX + roomId + ":scores";
            String batchesKey = ROOM_PREFIX + roomId + ":batches";

            // 1. 写入批次得分 Hash
            for (SubmitScoreReq.PlayerScore ps : req.getScores()) {
                redisTemplate.opsForHash().put(batchKey, String.valueOf(ps.getUserId()), String.valueOf(ps.getScore()));
                // 2. 更新排行榜 Sorted Set
                redisTemplate.opsForZSet().incrementScore(scoresKey, String.valueOf(ps.getUserId()), ps.getScore());
            }
            // 记录提交者
            redisTemplate.opsForHash().put(batchKey, "_created_by", String.valueOf(userId));
            redisTemplate.expire(batchKey, 24, TimeUnit.HOURS);

            // 3. 记录批次时间戳
            redisTemplate.opsForList().rightPush(batchesKey, String.valueOf(batchTs));
            redisTemplate.expire(batchesKey, 24, TimeUnit.HOURS);

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
            room.setLastActiveAt(LocalDateTime.now());
            roomMapper.updateById(room);

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
            throw new BizException("操作被中断");
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    @Override
    public List<ScoreBatchResp.PlayerScoreVO> getRoomRanking(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("房间不存在");

        Map<Long, Integer> totals;
        if (room.getStatus() == 0) {
            // 进行中 → Redis
            totals = getPlayerTotalsFromRedis(roomId);
        } else {
            // 已结算 → MySQL
            totals = getPlayerTotalsFromMySQL(roomId);
        }

        Set<Long> userIds = totals.keySet();
        Map<Long, String> nicknameMap = new HashMap<>();
        for (Long uid : userIds) {
            String userKey = "sr:user:" + uid;
            String userJson = redisTemplate.opsForValue().get(userKey);
            if (userJson != null) {
                JSONObject userObj = JSONUtil.parseObj(userJson);
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
        return getBatchesFromRedis(roomId, count);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public SettleResp settleRoom(Long userId, Long roomId, boolean autoSettled) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("房间不存在");
        if (!autoSettled && !room.getOwnerId().equals(userId)) throw new BizException("仅房主可结束对局");
        if (room.getStatus() != 0) throw new BizException("房间已结束");

        // 分布式锁：防止结算期间并发记分丢数据
        String lockKey = ROOM_PREFIX + roomId + ":lock";
        RLock lock = redissonClient.getLock(lockKey);
        try {
            if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                throw new BizException("系统繁忙，请稍后重试");
            }
            return doSettleRoom(userId, roomId, room, autoSettled);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException("操作被中断");
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

        // 0. 读取成员元数据快照（结档前，Redis 清理前）
        String metaKey = roomPrefix + "meta";
        Map<Object, Object> metaFields = redisTemplate.opsForHash().entries(metaKey);
        Map<Long, JSONObject> memberMetaMap = new HashMap<>();
        for (Object key : metaFields.keySet()) {
            String k = (String) key;
            if (k.startsWith("m:")) {
                JSONObject memberObj = JSONUtil.parseObj((String) metaFields.get(k));
                memberMetaMap.put(memberObj.getLong("userId"), memberObj);
            }
        }

        // 1. 读取所有批次时间戳
        List<String> batchTsList = redisTemplate.opsForList().range(roomPrefix + "batches", 0, -1);

        Map<Long, Integer> playerTotalMap = new HashMap<>();
        List<Map<String, Object>> allRecord = new ArrayList<>();

        // 自由流转模式：batchTsList 为空时，从 scores ZSet 和 events ZSet 构建数据
        if (batchTsList == null || batchTsList.isEmpty()) {
            // 从 scores ZSet 读取最终分数
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
            Map<Object, Object> metaEntries = redisTemplate.opsForHash().entries(roomPrefix + "meta");
            for (Object key : metaEntries.keySet()) {
                String k = (String) key;
                if (k.startsWith("m:")) {
                    Long uid = Long.parseLong(k.substring(2));
                    playerTotalMap.putIfAbsent(uid, 0);
                }
            }

            // 从 events ZSet 构建图表数据（每个 event 作为一个数据点）
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

                    // 存增量（delta），buildChartFromAllRecord 会自行累加
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
        } else {
            for (String tsStr : batchTsList) {
                String batchKey = roomPrefix + "batch:" + tsStr;
                Map<Object, Object> batchEntries = redisTemplate.opsForHash().entries(batchKey);
                if (batchEntries.isEmpty()) continue;

                long createdBy = 0L;
                String createdByStr = (String) batchEntries.remove("_created_by");
                if (createdByStr != null) {
                    createdBy = Long.parseLong(createdByStr);
                }

                long batchTimeMs = Long.parseLong(tsStr);
                LocalDateTime createdAt = LocalDateTime.ofInstant(
                        Instant.ofEpochMilli(batchTimeMs), ZoneId.systemDefault());

                Map<String, Object> batchRecord = new HashMap<>();
                batchRecord.put("batchTime", batchTimeMs);
                batchRecord.put("createdBy", createdBy);
                List<Map<String, Object>> playerScores = new ArrayList<>();

                for (Map.Entry<Object, Object> entry : batchEntries.entrySet()) {
                    Long uid = Long.parseLong((String) entry.getKey());
                    int scoreVal = Integer.parseInt((String) entry.getValue());

                    playerTotalMap.merge(uid, scoreVal, Integer::sum);

                    Map<String, Object> ps = new HashMap<>();
                    ps.put("userId", uid);
                    ps.put("score", scoreVal);
                    JSONObject meta = memberMetaMap.get(uid);
                    ps.put("name", meta != null ? meta.getStr("nickname") : "");
                    ps.put("avatar", meta != null ? meta.getStr("avatarUrl") : "");
                    playerScores.add(ps);
                }
                batchRecord.put("scores", playerScores);
                allRecord.add(batchRecord);
            }
        }

        // 2. 持久化 transfer events 到 all_record
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
            Map<String, Object> recordMeta = new HashMap<>();
            recordMeta.put("transferEvents", events);
            allRecord.add(recordMeta);
        }

        // 5. 更新 room.all_record
        room.setAllRecord(allRecord);
        roomMapper.updateById(room);

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
        keysToDelete.add(roomPrefix + "scores");
        keysToDelete.add(roomPrefix + "batches");
        keysToDelete.add(roomPrefix + "events");
        keysToDelete.add(roomPrefix + "overview");
        if (batchTsList != null) {
            for (String ts : batchTsList) {
                keysToDelete.add(roomPrefix + "batch:" + ts);
            }
        }
        redisTemplate.delete(keysToDelete);
        log.info("清理房间 {} Redis 键 {} 个", roomId, keysToDelete.size());

        // 清理成员缓存 + 每个成员的 user:rooms 映射
        redisTemplate.delete(roomPrefix + "meta");
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

        // 异步重算身份等级（非关键路径）
        final var settledUserIds = new ArrayList<>(playerTotalMap.keySet());
        asyncExecutor.execute(() -> {
            for (Long uid : settledUserIds) {
                try {
                    identityLevelService.recalculate(uid);
                } catch (Exception e) {
                    log.warn("异步重算身份等级失败: userId={}", uid, e);
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

        // 2. 确保所有房间成员都在 playerTotalMap 中
        List<RoomMember> members = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
        for (RoomMember m : members) {
            playerTotalMap.putIfAbsent(m.getUserId(), 0);
        }

        // 3. 更新 room.all_record
        room.setAllRecord(allRecord);
        roomMapper.updateById(room);

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

        // 5. 清理 Redis（round 相关 key + 房间基础 key）
        List<String> keysToDelete = new ArrayList<>(List.of(
                roomPrefix + "round", roomPrefix + "round:details",
                roomPrefix + "round:members", roomPrefix + "round:confirms",
                roomPrefix + "roundConfig", roomPrefix + "scores",
                roomPrefix + "meta", roomPrefix + "overview"));
        redisTemplate.delete(keysToDelete);
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

        // 异步重算身份等级（非关键路径）
        final var settledUserIds2 = new ArrayList<>(playerTotalMap.keySet());
        asyncExecutor.execute(() -> {
            for (Long uid : settledUserIds2) {
                try {
                    identityLevelService.recalculate(uid);
                } catch (Exception e) {
                    log.warn("异步重算身份等级失败: userId={}", uid, e);
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

    private List<ScoreBatchResp> getBatchesFromRedis(Long roomId, int count) {
        String batchesKey = ROOM_PREFIX + roomId + ":batches";
        List<String> batchTsList;
        if (count > 0) {
            Long size = redisTemplate.opsForList().size(batchesKey);
            if (size == null || size == 0) return Collections.emptyList();
            long start = Math.max(0, size - count);
            batchTsList = redisTemplate.opsForList().range(batchesKey, start, size - 1);
        } else {
            batchTsList = redisTemplate.opsForList().range(batchesKey, 0, -1);
        }
        if (batchTsList == null || batchTsList.isEmpty()) return Collections.emptyList();

        List<ScoreBatchResp> result = new ArrayList<>();
        for (int i = batchTsList.size() - 1; i >= 0; i--) {
            String ts = batchTsList.get(i);
            String batchKey = ROOM_PREFIX + roomId + ":batch:" + ts;
            Map<Object, Object> entries = redisTemplate.opsForHash().entries(batchKey);
            if (entries.isEmpty()) continue;

            List<ScoreBatchResp.PlayerScoreVO> scoreVOs = new ArrayList<>();
            Set<Long> uids = new HashSet<>();
            for (Object v : entries.keySet()) {
                String k = v.toString();
                if ("_created_by".equals(k)) continue;
                uids.add(Long.parseLong(k));
            }

            Map<Long, String> nicknameMap = new HashMap<>();
            for (Long uid : uids) {
                String userKey = "sr:user:" + uid;
                String userJson = redisTemplate.opsForValue().get(userKey);
                if (userJson != null) {
                    JSONObject userObj = JSONUtil.parseObj(userJson);
                    nicknameMap.put(uid, userObj.getStr("nickname", ""));
                } else {
                    User u = userMapper.selectById(uid);
                    nicknameMap.put(uid, u != null ? u.getNickname() : "");
                }
            }

            for (Map.Entry<Object, Object> e : entries.entrySet()) {
                Long uid = Long.parseLong(e.getKey().toString());
                String nickname = nicknameMap.getOrDefault(uid, "");
                scoreVOs.add(ScoreBatchResp.PlayerScoreVO.builder()
                        .userId(uid)
                        .nickname(nickname)
                        .score(Integer.parseInt(e.getValue().toString()))
                        .build());
            }

            long tsMs = Long.parseLong(ts);
            LocalDateTime batchTime = Instant.ofEpochMilli(tsMs).atZone(ZoneId.systemDefault()).toLocalDateTime();

            result.add(ScoreBatchResp.builder()
                    .batchTime(batchTime)
                    .scores(scoreVOs)
                    .build());
        }
        return result;
    }

    @Override
    public TransferScoreResp transferScore(Long userId, TransferScoreReq req) {
        if (userId.equals(req.getToUserId())) {
            throw new BizException("不能给自己计分");
        }

        Long roomId = req.getRoomId();

        // 验证房间存在且活跃
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) {
            throw new BizException("房间不存在或已结束");
        }

        // 从 Redis 缓存验证双方都是房间成员
        String metaKey = ROOM_PREFIX + roomId + ":meta";
        Boolean isFromMember = redisTemplate.opsForHash().hasKey(metaKey, "m:" + userId);
        Boolean isToMember = redisTemplate.opsForHash().hasKey(metaKey, "m:" + req.getToUserId());

        if (!Boolean.TRUE.equals(isFromMember) || !Boolean.TRUE.equals(isToMember)) {
            throw new BizException("双方必须都是房间成员");
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
                throw new BizException("计分失败，请重试");
            }
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lua 计分执行异常: roomId={}, from={}, to={}, amount={}",
                    roomId, userId, req.getToUserId(), req.getAmount(), e);
            throw new BizException("系统繁忙，请稍后重试");
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
                room.setLastActiveAt(LocalDateTime.now());
                roomMapper.updateById(room);
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
        redisTemplate.expire(ROOM_PREFIX + roomId + ":events", 48, TimeUnit.HOURS);

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

    private Map<Long, String> loadNicknameMap(List<Long> userIds) {
        if (userIds.isEmpty()) return Collections.emptyMap();

        // 批量从 Redis 加载
        List<String> keys = userIds.stream()
                .map(uid -> "sr:user:" + uid)
                .collect(Collectors.toList());
        List<String> cached = redisTemplate.opsForValue().multiGet(keys);

        Map<Long, String> map = new HashMap<>();
        List<Long> missedIds = new ArrayList<>();
        for (int i = 0; i < userIds.size(); i++) {
            String json = cached != null ? cached.get(i) : null;
            if (json != null) {
                JSONObject userObj = JSONUtil.parseObj(json);
                map.put(userIds.get(i), userObj.getStr("nickname", "玩家"));
            } else {
                missedIds.add(userIds.get(i));
            }
        }

        // 降级查数据库并回写缓存
        if (!missedIds.isEmpty()) {
            List<User> users = userMapper.selectBatchIds(missedIds);
            for (User user : users) {
                map.put(user.getId(), user.getNickname());
                String json = JSONUtil.toJsonStr(Map.of(
                        "userId", user.getId(),
                        "nickname", user.getNickname(),
                        "avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : ""));
                redisTemplate.opsForValue().set("sr:user:" + user.getId(), json, 24, TimeUnit.HOURS);
            }
            for (Long uid : missedIds) {
                map.putIfAbsent(uid, "玩家");
            }
        }
        return map;
    }

    /**
     * 滑动刷新房间所有 Redis key 的 TTL，统一 24 小时
     */
    private void refreshRoomTtl(Long roomId) {
        String prefix = ROOM_PREFIX + roomId + ":";
        long ttl = 24;
        TimeUnit unit = TimeUnit.HOURS;
        List<String> keys = List.of(
                prefix + "meta",
                prefix + "scores",
                prefix + "batches",
                prefix + "events");
        for (String key : keys) {
            redisTemplate.expire(key, ttl, unit);
        }
        // 用户房间映射也刷新（从 meta 中提取 m: 前缀的成员字段）
        Set<Object> metaFields = redisTemplate.opsForHash().keys(prefix + "meta");
        if (metaFields != null) {
            for (Object field : metaFields) {
                String key = (String) field;
                if (key.startsWith("m:")) {
                    redisTemplate.expire("sr:user:rooms:" + key.substring(2), ttl, unit);
                }
            }
        }
    }
}
