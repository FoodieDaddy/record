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
import com.smartrecord.entity.Score;
import com.smartrecord.entity.ScoreImage;
import com.smartrecord.entity.User;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.ScoreImageMapper;
import com.smartrecord.mapper.ScoreMapper;
import com.smartrecord.mapper.UserMapper;
import com.smartrecord.service.EmotionAudioPool;
import com.smartrecord.service.OverviewService;
import com.smartrecord.service.ScoreService;
import com.smartrecord.service.impl.ws.ScoreWebSocket;
import com.smartrecord.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
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
public class ScoreServiceImpl implements ScoreService {

    private final RoomMapper roomMapper;
    private final UserMapper userMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final ScoreMapper scoreMapper;
    private final ScoreImageMapper scoreImageMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final StringRedisTemplate redisTemplate;
    private final RedissonClient redissonClient;
    private final ScoreWebSocket scoreWebSocket;
    private final EmotionAudioPool emotionAudioPool;

    @Lazy
    @Autowired
    private OverviewService overviewService;

    private static final String ROOM_PREFIX = "sr:room:";

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

            // 4. 存储图片 URL
            if (req.getImageUrls() != null && !req.getImageUrls().isEmpty()) {
                String imagesKey = ROOM_PREFIX + roomId + ":images";
                for (String url : req.getImageUrls()) {
                    redisTemplate.opsForList().rightPush(imagesKey, url);
                }
                redisTemplate.expire(imagesKey, 24, TimeUnit.HOURS);
            }

            // 5. 为每个玩家生成情绪音频 URL
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

            // 7. 更新最后活跃时间
            redisTemplate.opsForValue().set(
                    ROOM_PREFIX + roomId + ":last_active",
                    LocalDateTime.now().toString(), 48, TimeUnit.HOURS);

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
    public void settleRoom(Long userId, Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("房间不存在");
        if (!room.getOwnerId().equals(userId)) throw new BizException("仅房主可结束对局");
        if (room.getStatus() != 0) throw new BizException("房间已结束");

        String roomPrefix = ROOM_PREFIX + roomId + ":";

        // 1. 读取所有批次时间戳
        List<String> batchTsList = redisTemplate.opsForList().range(roomPrefix + "batches", 0, -1);

        List<Score> allScores = new ArrayList<>();
        Map<Long, Integer> playerTotalMap = new HashMap<>();
        List<Map<String, Object>> allRecord = new ArrayList<>();

        if (batchTsList != null && !batchTsList.isEmpty()) {
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

                    Score score = new Score();
                    score.setId(idGenerator.nextId());
                    score.setRoomId(roomId);
                    score.setUserId(uid);
                    score.setScore(scoreVal);
                    score.setCreatedBy(createdBy);
                    score.setCreatedAt(createdAt);
                    allScores.add(score);

                    playerTotalMap.merge(uid, scoreVal, Integer::sum);

                    Map<String, Object> ps = new HashMap<>();
                    ps.put("userId", uid);
                    ps.put("score", scoreVal);
                    playerScores.add(ps);
                }
                batchRecord.put("scores", playerScores);
                allRecord.add(batchRecord);
            }
        }

        // 2. 写入 score 表
        if (!allScores.isEmpty()) {
            for (int i = 0; i < allScores.size(); i += 500) {
                List<Score> batch = allScores.subList(i, Math.min(i + 500, allScores.size()));
                scoreMapper.insertBatch(batch);
            }
            log.info("持久化房间 {} 得分记录 {} 条", roomId, allScores.size());
        }

        // 3. 写入 score_image 表
        List<String> imageUrls = redisTemplate.opsForList().range(roomPrefix + "images", 0, -1);
        if (imageUrls != null && !imageUrls.isEmpty()) {
            List<ScoreImage> images = new ArrayList<>();
            for (int i = 0; i < imageUrls.size(); i++) {
                ScoreImage img = new ScoreImage();
                img.setId(idGenerator.nextId());
                img.setRoomId(roomId);
                img.setUserId(0L);
                img.setImageUrl(imageUrls.get(i));
                img.setSortOrder(i);
                images.add(img);
            }
            scoreImageMapper.insertBatch(images);
            log.info("持久化房间 {} 图片 {} 张", roomId, imageUrls.size());
        }

        // 4. 更新 room.all_record
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
        keysToDelete.add(roomPrefix + "images");
        keysToDelete.add(roomPrefix + "last_active");
        if (batchTsList != null) {
            for (String ts : batchTsList) {
                keysToDelete.add(roomPrefix + "batch:" + ts);
            }
        }
        redisTemplate.delete(keysToDelete);
        log.info("清理房间 {} Redis 键 {} 个", roomId, keysToDelete.size());

        // 7. WebSocket 通知
        scoreWebSocket.pushToRoom(String.valueOf(roomId), Map.of("type", "SETTLE"));
    }

    @Override
    public ChartDataResp getChartData(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("房间不存在");

        String roomPrefix = ROOM_PREFIX + roomId + ":";

        if (room.getStatus() == 0) {
            // 进行中 → 从 Redis 构建
            return buildChartFromRedis(roomId, roomPrefix);
        } else {
            // 已结算 → 从 all_record 构建
            return buildChartFromAllRecord(room);
        }
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
        List<Map<String, Object>> rows = scoreMapper.selectAggregatedScores(roomId);
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
                uids.add(Long.parseLong(v.toString()));
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

    private ChartDataResp buildChartFromRedis(Long roomId, String roomPrefix) {
        List<String> batchTsList = redisTemplate.opsForList().range(roomPrefix + "batches", 0, -1);
        if (batchTsList == null || batchTsList.isEmpty()) {
            return ChartDataResp.builder().timestamps(List.of()).series(List.of()).build();
        }

        Set<ZSetOperations.TypedTuple<String>> members =
                redisTemplate.opsForZSet().rangeWithScores(roomPrefix + "scores", 0, -1);
        if (members == null || members.isEmpty()) {
            return ChartDataResp.builder().timestamps(List.of()).series(List.of()).build();
        }

        List<Long> userIds = members.stream()
                .map(ZSetOperations.TypedTuple::getValue)
                .filter(v -> !"init".equals(v))
                .map(Long::parseLong)
                .collect(Collectors.toList());

        Map<Long, String> nicknameMap = loadNicknameMap(userIds);

        List<Long> timestamps = new ArrayList<>();
        Map<Long, List<Integer>> userScores = new HashMap<>();
        userIds.forEach(uid -> userScores.put(uid, new ArrayList<>()));

        Map<Long, Integer> cumulative = new HashMap<>();
        userIds.forEach(uid -> cumulative.put(uid, 0));

        for (String tsStr : batchTsList) {
            long ts = Long.parseLong(tsStr);
            timestamps.add(ts);

            String batchKey = roomPrefix + "batch:" + tsStr;
            Map<Object, Object> batchEntries = redisTemplate.opsForHash().entries(batchKey);

            for (Map.Entry<Object, Object> entry : batchEntries.entrySet()) {
                String key = (String) entry.getKey();
                if ("_created_by".equals(key)) continue;
                long uid = Long.parseLong(key);
                int score = Integer.parseInt((String) entry.getValue());
                cumulative.merge(uid, score, Integer::sum);
            }

            for (Long uid : userIds) {
                userScores.get(uid).add(cumulative.getOrDefault(uid, 0));
            }
        }

        List<ChartDataResp.Series> seriesList = userIds.stream()
                .map(uid -> ChartDataResp.Series.builder()
                        .userId(uid)
                        .nickname(nicknameMap.getOrDefault(uid, "玩家"))
                        .scores(userScores.get(uid))
                        .build())
                .collect(Collectors.toList());

        return ChartDataResp.builder()
                .timestamps(timestamps)
                .series(seriesList)
                .build();
    }

    private ChartDataResp buildChartFromAllRecord(Room room) {
        List<Map<String, Object>> allRecord = room.getAllRecord();
        if (allRecord == null || allRecord.isEmpty()) {
            return ChartDataResp.builder().timestamps(List.of()).series(List.of()).build();
        }

        // 收集所有 userId
        Set<Long> userIdSet = new LinkedHashSet<>();
        for (Map<String, Object> batch : allRecord) {
            List<Map<String, Object>> scores = (List<Map<String, Object>>) batch.get("scores");
            if (scores != null) {
                for (Map<String, Object> ps : scores) {
                    userIdSet.add(((Number) ps.get("userId")).longValue());
                }
            }
        }
        List<Long> userIds = new ArrayList<>(userIdSet);
        Map<Long, String> nicknameMap = loadNicknameMap(userIds);

        List<Long> timestamps = new ArrayList<>();
        Map<Long, List<Integer>> userScores = new HashMap<>();
        userIds.forEach(uid -> userScores.put(uid, new ArrayList<>()));

        Map<Long, Integer> cumulative = new HashMap<>();
        userIds.forEach(uid -> cumulative.put(uid, 0));

        for (Map<String, Object> batch : allRecord) {
            long batchTime = ((Number) batch.get("batchTime")).longValue();
            timestamps.add(batchTime);

            List<Map<String, Object>> scores = (List<Map<String, Object>>) batch.get("scores");
            if (scores != null) {
                for (Map<String, Object> ps : scores) {
                    long uid = ((Number) ps.get("userId")).longValue();
                    int score = ((Number) ps.get("score")).intValue();
                    cumulative.merge(uid, score, Integer::sum);
                }
            }

            for (Long uid : userIds) {
                userScores.get(uid).add(cumulative.getOrDefault(uid, 0));
            }
        }

        List<ChartDataResp.Series> seriesList = userIds.stream()
                .map(uid -> ChartDataResp.Series.builder()
                        .userId(uid)
                        .nickname(nicknameMap.getOrDefault(uid, "玩家"))
                        .scores(userScores.get(uid))
                        .build())
                .collect(Collectors.toList());

        return ChartDataResp.builder()
                .timestamps(timestamps)
                .series(seriesList)
                .build();
    }

    @Override
    public List<String> getRoomImages(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("房间不存在");

        List<String> images = new ArrayList<>();

        if (room.getStatus() == 0) {
            // 活跃房间：从 Redis 读取
            String imagesKey = ROOM_PREFIX + roomId + ":images";
            List<String> redisImages = redisTemplate.opsForList().range(imagesKey, 0, -1);
            if (redisImages != null) images.addAll(redisImages);
        }

        // 从 MySQL 读取（已归档的图片）
        List<ScoreImage> dbImages = scoreImageMapper.selectList(
                new LambdaQueryWrapper<ScoreImage>()
                        .eq(ScoreImage::getRoomId, roomId)
                        .orderByAsc(ScoreImage::getCreatedAt));
        for (ScoreImage img : dbImages) {
            if (!images.contains(img.getImageUrl())) {
                images.add(img.getImageUrl());
            }
        }

        return images;
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
        String membersKey = ROOM_PREFIX + roomId + ":members";
        Boolean isFromMember = redisTemplate.opsForHash().hasKey(membersKey, String.valueOf(userId));
        Boolean isToMember = redisTemplate.opsForHash().hasKey(membersKey, String.valueOf(req.getToUserId()));

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

        // 更新最后活跃时间
        redisTemplate.opsForValue().set(
                ROOM_PREFIX + roomId + ":last_active",
                LocalDateTime.now().toString(), 48, TimeUnit.HOURS);

        // 记录流水到 Redis events 列表
        long now = System.currentTimeMillis();
        Map<String, Object> event = new HashMap<>();
        event.put("from", userId);
        event.put("to", req.getToUserId());
        event.put("amount", req.getAmount());
        event.put("time", now);
        if (req.getRemark() != null) event.put("remark", req.getRemark());
        redisTemplate.opsForList().rightPush(
                ROOM_PREFIX + roomId + ":events", JSONUtil.toJsonStr(event));
        redisTemplate.expire(ROOM_PREFIX + roomId + ":events", 48, TimeUnit.HOURS);

        // WebSocket 推送
        Map<String, Object> pushData = new HashMap<>();
        pushData.put("type", "TRANSFER");
        pushData.put("roomId", String.valueOf(roomId));
        pushData.put("fromUserId", String.valueOf(userId));
        pushData.put("toUserId", String.valueOf(req.getToUserId()));
        pushData.put("amount", req.getAmount());
        scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);

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
        List<String> rawEvents = redisTemplate.opsForList().range(eventsKey, 0, -1);
        if (rawEvents == null || rawEvents.isEmpty()) {
            return PageResult.of(0, List.of());
        }

        List<JSONObject> allEvents = new ArrayList<>();
        for (String raw : rawEvents) {
            try {
                allEvents.add(JSONUtil.parseObj(raw));
            } catch (Exception e) {
                log.warn("解析计分流水失败: {}", raw, e);
            }
        }

        // 按时间倒序
        allEvents.sort((a, b) -> Long.compare(
                b.getLong("time", 0L), a.getLong("time", 0L)));

        long total = allEvents.size();

        // 分页截取
        int from = (page - 1) * size;
        int to = Math.min(from + size, allEvents.size());
        List<JSONObject> pageEvents = from < allEvents.size()
                ? allEvents.subList(from, to) : List.of();

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
        Map<Long, String> map = new HashMap<>();
        for (Long uid : userIds) {
            String userKey = "sr:user:" + uid;
            String userJson = redisTemplate.opsForValue().get(userKey);
            if (userJson != null) {
                JSONObject userObj = JSONUtil.parseObj(userJson);
                map.put(uid, userObj.getStr("nickname", "玩家"));
            } else {
                User user = userMapper.selectById(uid);
                map.put(uid, user != null ? user.getNickname() : "玩家");
                if (user != null) {
                    String json = JSONUtil.toJsonStr(Map.of(
                            "userId", user.getId(),
                            "nickname", user.getNickname(),
                            "avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : ""));
                    redisTemplate.opsForValue().set(userKey, json, 24, TimeUnit.HOURS);
                }
            }
        }
        return map;
    }
}
