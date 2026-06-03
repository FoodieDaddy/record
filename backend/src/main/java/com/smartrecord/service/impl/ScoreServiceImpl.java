package com.smartrecord.service.impl;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.common.EmotionType;
import com.smartrecord.dto.score.ChartDataResp;
import com.smartrecord.dto.score.ScoreBatchResp;
import com.smartrecord.dto.score.ScoreSubmitResp;
import com.smartrecord.dto.score.SessionScoreResp;
import com.smartrecord.dto.score.SubmitScoreReq;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.entity.Score;
import com.smartrecord.entity.ScoreImage;
import com.smartrecord.entity.Session;
import com.smartrecord.entity.SessionEventLog;
import com.smartrecord.entity.SessionRecord;
import com.smartrecord.entity.Transfer;
import com.smartrecord.entity.User;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.ScoreImageMapper;
import com.smartrecord.mapper.ScoreMapper;
import com.smartrecord.mapper.SessionEventLogMapper;
import com.smartrecord.mapper.SessionMapper;
import com.smartrecord.mapper.SessionRecordMapper;
import com.smartrecord.mapper.TransferMapper;
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

    private final SessionMapper sessionMapper;
    private final RoomMapper roomMapper;
    private final UserMapper userMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final ScoreMapper scoreMapper;
    private final ScoreImageMapper scoreImageMapper;
    private final SessionRecordMapper sessionRecordMapper;
    private final SessionEventLogMapper sessionEventLogMapper;
    private final TransferMapper transferMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final StringRedisTemplate redisTemplate;
    private final RedissonClient redissonClient;
    private final ScoreWebSocket scoreWebSocket;
    private final EmotionAudioPool emotionAudioPool;

    @Lazy
    @Autowired
    private OverviewService overviewService;

    private static final String SESSION_PREFIX = "sr:session:";

    @Override
    public ScoreSubmitResp submitScore(Long userId, SubmitScoreReq req) {
        // 支持 sessionId 或 roomId（二选一）
        Session session;
        if (req.getSessionId() != null) {
            session = sessionMapper.selectById(req.getSessionId());
        } else if (req.getRoomId() != null) {
            session = getActiveSession(req.getRoomId());
        } else {
            throw new BizException("sessionId 或 roomId 不能为空");
        }
        if (session == null || session.getStatus() != 0) {
            throw new BizException("场次不存在或已结算");
        }

        // 验证提交者是房间成员
        RoomMember submitter = roomMemberMapper.selectOne(
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getRoomId, session.getRoomId())
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
        String lockKey = SESSION_PREFIX + session.getId() + ":lock";
        RLock lock = redissonClient.getLock(lockKey);
        try {
            if (!lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                throw new BizException("系统繁忙，请稍后重试");
            }

            long batchTs = System.currentTimeMillis();
            String batchKey = SESSION_PREFIX + session.getId() + ":batch:" + batchTs;
            String scoresKey = SESSION_PREFIX + session.getId() + ":scores";
            String batchesKey = SESSION_PREFIX + session.getId() + ":batches";

            // 1. 写入批次得分 Hash
            for (SubmitScoreReq.PlayerScore ps : req.getScores()) {
                redisTemplate.opsForHash().put(batchKey, String.valueOf(ps.getUserId()), String.valueOf(ps.getScore()));
                // 2. 更新排行榜 Sorted Set
                redisTemplate.opsForZSet().incrementScore(scoresKey, String.valueOf(ps.getUserId()), ps.getScore());
            }
            // 记录提交者（用于后续持久化）
            redisTemplate.opsForHash().put(batchKey, "_created_by", String.valueOf(userId));
            redisTemplate.expire(batchKey, 24, TimeUnit.HOURS);

            // 3. 记录批次时间戳
            redisTemplate.opsForList().rightPush(batchesKey, String.valueOf(batchTs));
            redisTemplate.expire(batchesKey, 24, TimeUnit.HOURS);

            // 4. 存储图片 URL
            if (req.getImageUrls() != null && !req.getImageUrls().isEmpty()) {
                String imagesKey = SESSION_PREFIX + session.getId() + ":images";
                for (String url : req.getImageUrls()) {
                    redisTemplate.opsForList().rightPush(imagesKey, url);
                }
                redisTemplate.expire(imagesKey, 24, TimeUnit.HOURS);
            }

            // 5. 更新场次记分笔数
            session.setScoreCount(session.getScoreCount() + 1);
            sessionMapper.updateById(session);

            // 6. 为每个玩家生成情绪音频 URL
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

            // 7. WebSocket 推送给房间内所有玩家（含情绪音频）
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "SCORE_UPDATE");
            pushData.put("sessionId", session.getId());
            pushData.put("batchTime", batchTs);
            pushData.put("scores", scoreWithEmotion);
            scoreWebSocket.pushToRoom(String.valueOf(session.getRoomId()), pushData);

            // 8. 更新最后活跃时间
            redisTemplate.opsForValue().set(
                    SESSION_PREFIX + session.getId() + ":last_active",
                    LocalDateTime.now().toString(), 48, TimeUnit.HOURS);

            // 9. 异步更新总览缓存
            overviewService.computeOverview(session.getRoomId());

            // 10. 为提交者返回情绪音频
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
    public SessionScoreResp getSessionScores(Long sessionId) {
        Session session = sessionMapper.selectById(sessionId);
        if (session == null) throw new BizException("场次不存在");

        Map<Long, Integer> playerTotals;
        List<ScoreBatchResp> batches;

        if (session.getStatus() == 0) {
            // 进行中 → Redis
            playerTotals = getPlayerTotalsFromRedis(sessionId);
            batches = getBatchesFromRedis(sessionId, -1);
        } else {
            // 已结算 → MySQL
            playerTotals = sessionMapper.getPlayerTotalsBySessionId(sessionId);
            batches = getBatchesFromMySQL(sessionId);
        }

        return SessionScoreResp.builder()
                .sessionId(sessionId)
                .status(session.getStatus())
                .playerTotals(playerTotals)
                .batches(batches)
                .build();
    }

    private List<ScoreBatchResp> getRecentScores(Long sessionId, Integer count) {
        return getBatchesFromRedis(sessionId, count);
    }

    private List<ScoreBatchResp.PlayerScoreVO> getRanking(Long sessionId) {
        Session session = sessionMapper.selectById(sessionId);
        if (session == null) throw new BizException("场次不存在");

        Map<Long, Integer> totals;
        if (session.getStatus() == 0) {
            totals = getPlayerTotalsFromRedis(sessionId);
        } else {
            totals = sessionMapper.getPlayerTotalsBySessionId(sessionId);
        }

        // 从 Redis 缓存获取用户信息
        Set<Long> userIds = totals.keySet();
        Map<Long, String> nicknameMap = new HashMap<>();
        for (Long uid : userIds) {
            String userKey = "sr:user:" + uid;
            String userJson = redisTemplate.opsForValue().get(userKey);
            if (userJson != null) {
                JSONObject userObj = JSONUtil.parseObj(userJson);
                nicknameMap.put(uid, userObj.getStr("nickname", ""));
            } else {
                // 降级查数据库
                User u = userMapper.selectById(uid);
                nicknameMap.put(uid, u != null ? u.getNickname() : "");
            }
        }

        return totals.entrySet().stream()
                .sorted(Map.Entry.<Long, Integer>comparingByValue().reversed())
                .map(e -> {
                    String nickname = nicknameMap.getOrDefault(e.getKey(), "");
                    return ScoreBatchResp.PlayerScoreVO.builder()
                            .userId(e.getKey())
                            .nickname(nickname)
                            .score(e.getValue())
                            .build();
                })
                .collect(Collectors.toList());
    }

    // ===== 私有方法 =====

    private Map<Long, Integer> getPlayerTotalsFromRedis(Long sessionId) {
        String scoresKey = SESSION_PREFIX + sessionId + ":scores";
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

    private List<ScoreBatchResp> getBatchesFromRedis(Long sessionId, int count) {
        String batchesKey = SESSION_PREFIX + sessionId + ":batches";
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

        // 查询用户信息（从 Redis 缓存）
        List<ScoreBatchResp> result = new ArrayList<>();
        for (int i = batchTsList.size() - 1; i >= 0; i--) {
            String ts = batchTsList.get(i);
            String batchKey = SESSION_PREFIX + sessionId + ":batch:" + ts;
            Map<Object, Object> entries = redisTemplate.opsForHash().entries(batchKey);
            if (entries.isEmpty()) continue;

            List<ScoreBatchResp.PlayerScoreVO> scoreVOs = new ArrayList<>();
            Set<Long> uids = new HashSet<>();
            for (Object v : entries.keySet()) {
                uids.add(Long.parseLong(v.toString()));
            }

            // 从 Redis 缓存获取用户信息
            Map<Long, String> nicknameMap = new HashMap<>();
            for (Long uid : uids) {
                String userKey = "sr:user:" + uid;
                String userJson = redisTemplate.opsForValue().get(userKey);
                if (userJson != null) {
                    JSONObject userObj = JSONUtil.parseObj(userJson);
                    nicknameMap.put(uid, userObj.getStr("nickname", ""));
                } else {
                    // 降级查数据库
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

    private List<ScoreBatchResp> getBatchesFromMySQL(Long sessionId) {
        // 从 session_event_log 读取流水 JSON
        String eventsJson = sessionMapper.selectEventsDataBySessionId(sessionId);
        if (eventsJson == null || eventsJson.isEmpty()) return Collections.emptyList();

        List<SessionEventLog.BatchEvent> events = JSONUtil.toList(eventsJson, SessionEventLog.BatchEvent.class);
        if (events.isEmpty()) return Collections.emptyList();

        // 收集所有 userId 用于查询昵称
        Set<Long> allUserIds = events.stream()
                .flatMap(e -> e.getScores().stream())
                .map(SessionEventLog.PlayerScore::getUserId)
                .collect(Collectors.toSet());

        Map<Long, String> nicknameMap = new HashMap<>();
        for (Long uid : allUserIds) {
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

        // 查询图片
        List<ScoreImage> images = scoreImageMapper.selectList(
                new LambdaQueryWrapper<ScoreImage>().eq(ScoreImage::getSessionId, sessionId));

        // 按 batchTime 倒序构建响应
        List<ScoreBatchResp> result = new ArrayList<>();
        for (int i = events.size() - 1; i >= 0; i--) {
            SessionEventLog.BatchEvent event = events.get(i);
            List<ScoreBatchResp.PlayerScoreVO> scoreVOs = event.getScores().stream()
                    .map(ps -> ScoreBatchResp.PlayerScoreVO.builder()
                            .userId(ps.getUserId())
                            .nickname(nicknameMap.getOrDefault(ps.getUserId(), ""))
                            .score(ps.getScore())
                            .build())
                    .collect(Collectors.toList());

            LocalDateTime batchTime = LocalDateTime.ofInstant(
                    Instant.ofEpochMilli(event.getBatchTime()), ZoneId.systemDefault());

            result.add(ScoreBatchResp.builder()
                    .batchTime(batchTime)
                    .createdBy(event.getCreatedBy())
                    .scores(scoreVOs)
                    .imageUrls(images.stream()
                            .map(ScoreImage::getImageUrl)
                            .collect(Collectors.toList()))
                    .build());
        }
        return result;
    }

    @Override
    public ChartDataResp getChartData(Long roomId) {
        Session session = getActiveSession(roomId);
        Long sessionId = session.getId();
        String sessionPrefix = SESSION_PREFIX + sessionId + ":";

        // 获取批次时间戳
        List<String> batchTsList = redisTemplate.opsForList().range(sessionPrefix + "batches", 0, -1);

        // Redis 无批次数据时，从 transfer 表回填（兼容历史数据）
        if (batchTsList == null || batchTsList.isEmpty()) {
            return buildChartFromTransfers(roomId);
        }

        // 获取所有成员 userId（从 sorted set）
        Set<ZSetOperations.TypedTuple<String>> members =
                redisTemplate.opsForZSet().rangeWithScores(sessionPrefix + "scores", 0, -1);
        if (members == null || members.isEmpty()) {
            return ChartDataResp.builder().timestamps(List.of()).series(List.of()).build();
        }

        // 过滤掉 "init" 哨兵值
        List<Long> userIds = members.stream()
                .map(ZSetOperations.TypedTuple::getValue)
                .filter(v -> !"init".equals(v))
                .map(Long::parseLong)
                .collect(Collectors.toList());

        // 从 Redis 缓存加载用户昵称
        Map<Long, String> nicknameMap = loadNicknameMap(userIds);

        // 遍历批次，累加每个用户的积分
        List<Long> timestamps = new ArrayList<>();
        Map<Long, List<Integer>> userScores = new HashMap<>();
        userIds.forEach(uid -> userScores.put(uid, new ArrayList<>()));

        Map<Long, Integer> cumulative = new HashMap<>();
        userIds.forEach(uid -> cumulative.put(uid, 0));

        for (String tsStr : batchTsList) {
            long ts = Long.parseLong(tsStr);
            timestamps.add(ts);

            String batchKey = sessionPrefix + "batch:" + tsStr;
            Map<Object, Object> batchEntries = redisTemplate.opsForHash().entries(batchKey);

            for (Map.Entry<Object, Object> entry : batchEntries.entrySet()) {
                String key = (String) entry.getKey();
                if ("_created_by".equals(key)) continue;
                long uid = Long.parseLong(key);
                int score = Integer.parseInt((String) entry.getValue());
                cumulative.merge(uid, score, Integer::sum);
            }

            // 记录当前时间点各用户的累计分
            for (Long uid : userIds) {
                userScores.get(uid).add(cumulative.getOrDefault(uid, 0));
            }
        }

        // 构建 series
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

    /**
     * 从 transfer 表回填图表数据（Redis 无批次时的 fallback）
     */
    private ChartDataResp buildChartFromTransfers(Long roomId) {
        List<Transfer> transfers = transferMapper.selectList(
                new LambdaQueryWrapper<Transfer>()
                        .eq(Transfer::getRoomId, roomId)
                        .eq(Transfer::getStatus, 0)
                        .orderByAsc(Transfer::getCreatedAt));

        if (transfers.isEmpty()) {
            return ChartDataResp.builder().timestamps(List.of()).series(List.of()).build();
        }

        // 收集所有涉及的 userId
        Set<Long> userIdSet = new LinkedHashSet<>();
        transfers.forEach(t -> {
            userIdSet.add(t.getFromUserId());
            userIdSet.add(t.getToUserId());
        });
        List<Long> userIds = new ArrayList<>(userIdSet);

        Map<Long, String> nicknameMap = loadNicknameMap(userIds);

        // 按时间累加
        List<Long> timestamps = new ArrayList<>();
        Map<Long, List<Integer>> userScores = new HashMap<>();
        userIds.forEach(uid -> userScores.put(uid, new ArrayList<>()));

        Map<Long, Integer> cumulative = new HashMap<>();
        userIds.forEach(uid -> cumulative.put(uid, 0));

        for (Transfer t : transfers) {
            timestamps.add(t.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli());
            cumulative.merge(t.getFromUserId(), -t.getAmount(), Integer::sum);
            cumulative.merge(t.getToUserId(), t.getAmount(), Integer::sum);
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

    // ===== 房间级接口 =====

    @Override
    public List<ScoreBatchResp.PlayerScoreVO> getRoomRanking(Long roomId) {
        Session session = getActiveSession(roomId);
        return getRanking(session.getId());
    }

    @Override
    public List<ScoreBatchResp> getRoomRecentScores(Long roomId, Integer count) {
        Session session = getActiveSession(roomId);
        return getRecentScores(session.getId(), count);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void settleRoom(Long userId, Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("房间不存在");
        if (!room.getOwnerId().equals(userId)) throw new BizException("仅房主可结束本轮");

        Session session = getActiveSession(roomId);

        // 结算当前场次
        session.setStatus(1);
        session.setSettledAt(LocalDateTime.now());
        sessionMapper.updateById(session);

        // 持久化 Redis 数据到 MySQL
        persistSessionToMySQL(session);

        // 房间轮次+1
        room.setRoundCount(room.getRoundCount() + 1);
        roomMapper.updateById(room);

        // 创建新一轮场次
        Session newSession = new Session();
        newSession.setId(idGenerator.nextId());
        newSession.setRoomId(roomId);
        newSession.setSessionNo(room.getRoundCount());
        newSession.setTitle("第" + room.getRoundCount() + "轮");
        newSession.setStatus(0);
        newSession.setScoreCount(0);
        newSession.setCreatedBy(userId);
        sessionMapper.insert(newSession);

        // 初始化新场次 Redis
        String sessionPrefix = SESSION_PREFIX + newSession.getId() + ":";
        redisTemplate.opsForZSet().add(sessionPrefix + "scores", "init", 0);
        redisTemplate.expire(sessionPrefix + "scores", 24, TimeUnit.HOURS);

        // 更新活跃场次缓存
        String activeSessionKey = "sr:room:" + roomId + ":active_session";
        redisTemplate.opsForValue().set(activeSessionKey, String.valueOf(newSession.getId()), 24, TimeUnit.HOURS);

        // WebSocket 通知房间内所有客户端刷新
        scoreWebSocket.pushToRoom(String.valueOf(roomId), Map.of("type", "SETTLE"));
    }

    @Override
    public void forceSettleSession(Long sessionId) {
        Session session = sessionMapper.selectById(sessionId);
        if (session == null || session.getStatus() != 0) {
            log.warn("[ForceSettle] 场次不存在或已结算: sessionId={}", sessionId);
            return;
        }

        log.info("[ForceSettle] 强制结算场次: sessionId={}, roomId={}", sessionId, session.getRoomId());

        // 标记已结算
        session.setStatus(1);
        session.setSettledAt(LocalDateTime.now());
        sessionMapper.updateById(session);

        // 持久化 Redis 数据到 MySQL
        persistSessionToMySQL(session);

        // 清理活跃场次缓存
        String activeSessionKey = "sr:room:" + session.getRoomId() + ":active_session";
        String cachedSessionId = redisTemplate.opsForValue().get(activeSessionKey);
        if (String.valueOf(sessionId).equals(cachedSessionId)) {
            redisTemplate.delete(activeSessionKey);
        }

        // 清理最后活跃时间
        redisTemplate.delete(SESSION_PREFIX + sessionId + ":last_active");

        log.info("[ForceSettle] 场次 {} 强制结算完成", sessionId);
    }

    /**
     * 将 Redis 中的场次数据持久化到 MySQL
     */
    private void persistSessionToMySQL(Session session) {
        Long sessionId = session.getId();
        Long roomId = session.getRoomId();
        Integer roundNo = session.getSessionNo();
        String sessionPrefix = SESSION_PREFIX + sessionId + ":";

        // 1. 读取所有批次时间戳
        List<String> batchTsList = redisTemplate.opsForList().range(sessionPrefix + "batches", 0, -1);
        if (batchTsList == null || batchTsList.isEmpty()) return;

        List<Score> allScores = new ArrayList<>();
        Map<Long, Integer> playerTotalMap = new HashMap<>();
        List<SessionEventLog.BatchEvent> eventsData = new ArrayList<>();

        for (String tsStr : batchTsList) {
            String batchKey = sessionPrefix + "batch:" + tsStr;
            Map<Object, Object> batchEntries = redisTemplate.opsForHash().entries(batchKey);
            if (batchEntries.isEmpty()) continue;

            // 提取提交者
            long createdBy = 0L;
            String createdByStr = (String) batchEntries.remove("_created_by");
            if (createdByStr != null) {
                createdBy = Long.parseLong(createdByStr);
            }

            long batchTimeMs = Long.parseLong(tsStr);
            LocalDateTime createdAt = LocalDateTime.ofInstant(
                    Instant.ofEpochMilli(batchTimeMs), ZoneId.systemDefault());

            // 构建批次事件
            SessionEventLog.BatchEvent batchEvent = new SessionEventLog.BatchEvent();
            batchEvent.setBatchTime(batchTimeMs);
            batchEvent.setCreatedBy(createdBy);
            List<SessionEventLog.PlayerScore> playerScores = new ArrayList<>();

            for (Map.Entry<Object, Object> entry : batchEntries.entrySet()) {
                Long uid = Long.parseLong((String) entry.getKey());
                int scoreVal = Integer.parseInt((String) entry.getValue());

                // score 表
                Score score = new Score();
                score.setId(idGenerator.nextId());
                score.setSessionId(sessionId);
                score.setRoomId(roomId);
                score.setRoundNo(roundNo);
                score.setUserId(uid);
                score.setScore(scoreVal);
                score.setCreatedBy(createdBy);
                score.setCreatedAt(createdAt);
                allScores.add(score);

                // 累加玩家总分
                playerTotalMap.merge(uid, scoreVal, Integer::sum);

                // 事件明细
                SessionEventLog.PlayerScore ps = new SessionEventLog.PlayerScore();
                ps.setUserId(uid);
                ps.setScore(scoreVal);
                playerScores.add(ps);
            }
            batchEvent.setScores(playerScores);
            eventsData.add(batchEvent);
        }

        if (!allScores.isEmpty()) {
            // 分批插入，每批 500 条
            for (int i = 0; i < allScores.size(); i += 500) {
                List<Score> batch = allScores.subList(i, Math.min(i + 500, allScores.size()));
                scoreMapper.insertBatch(batch);
            }
            log.info("持久化场次 {} 得分记录 {} 条", sessionId, allScores.size());
        }

        // 2. 持久化 session_record（玩家汇总）
        if (!playerTotalMap.isEmpty()) {
            List<SessionRecord> records = new ArrayList<>();
            for (Map.Entry<Long, Integer> e : playerTotalMap.entrySet()) {
                SessionRecord record = new SessionRecord();
                record.setId(idGenerator.nextId());
                record.setSessionId(sessionId);
                record.setUserId(e.getKey());
                record.setTotalScore(e.getValue());
                record.setCreatedAt(session.getSettledAt());
                records.add(record);
            }
            for (int i = 0; i < records.size(); i += 500) {
                List<SessionRecord> batch = records.subList(i, Math.min(i + 500, records.size()));
                sessionRecordMapper.insertBatch(batch);
            }
            log.info("持久化场次 {} 汇总记录 {} 条", sessionId, records.size());
        }

        // 3. 持久化 session_event_log（流水明细）
        if (!eventsData.isEmpty()) {
            SessionEventLog eventLog = new SessionEventLog();
            eventLog.setId(idGenerator.nextId());
            eventLog.setSessionId(sessionId);
            eventLog.setEventsData(eventsData);
            eventLog.setCreatedAt(session.getSettledAt());
            sessionEventLogMapper.insert(eventLog);
            log.info("持久化场次 {} 流水明细，共 {} 个批次", sessionId, eventsData.size());
        }

        // 4. 持久化图片
        List<String> imageUrls = redisTemplate.opsForList().range(sessionPrefix + "images", 0, -1);
        if (imageUrls != null && !imageUrls.isEmpty()) {
            List<ScoreImage> images = new ArrayList<>();
            for (int i = 0; i < imageUrls.size(); i++) {
                ScoreImage img = new ScoreImage();
                img.setId(idGenerator.nextId());
                img.setSessionId(sessionId);
                img.setRoomId(roomId);
                img.setRoundNo(roundNo);
                img.setUserId(0L);
                img.setImageUrl(imageUrls.get(i));
                img.setSortOrder(i);
                img.setCreatedAt(session.getSettledAt());
                images.add(img);
            }
            scoreImageMapper.insertBatch(images);
            log.info("持久化场次 {} 图片 {} 张", sessionId, imageUrls.size());
        }

        // 5. 持久化 Lua 转账流水到 transfer 表
        persistTransferEvents(sessionId, roomId, session.getSettledAt());

        // 6. 清理 Redis 键
        cleanupSessionRedisKeys(sessionId, sessionPrefix, batchTsList);
    }

    /**
     * 清理场次相关的 Redis 键
     */
    /**
     * 从 Redis events 列表读取 Lua 转账流水，持久化到 MySQL transfer 表
     */
    private void persistTransferEvents(Long sessionId, Long roomId, LocalDateTime settledAt) {
        String eventsKey = SESSION_PREFIX + sessionId + ":events";
        List<String> events = redisTemplate.opsForList().range(eventsKey, 0, -1);
        if (events == null || events.isEmpty()) return;

        List<Transfer> transfers = new ArrayList<>();
        for (String eventJson : events) {
            try {
                JSONObject obj = JSONUtil.parseObj(eventJson);
                Transfer t = new Transfer();
                t.setId(idGenerator.nextId());
                t.setRoomId(roomId);
                t.setSessionId(sessionId);
                t.setFromUserId(obj.getLong("from"));
                t.setToUserId(obj.getLong("to"));
                t.setAmount(obj.getInt("amount"));
                t.setRemark(obj.getStr("remark", ""));
                t.setStatus(0);
                transfers.add(t);
            } catch (Exception e) {
                log.warn("解析转账流水失败: {}", eventJson, e);
            }
        }

        if (!transfers.isEmpty()) {
            for (Transfer t : transfers) {
                transferMapper.insert(t);
            }
            log.info("持久化场次 {} 转账流水 {} 条", sessionId, transfers.size());
        }
    }

    private void cleanupSessionRedisKeys(Long sessionId, String sessionPrefix, List<String> batchTsList) {
        List<String> keysToDelete = new ArrayList<>();
        keysToDelete.add(sessionPrefix + "scores");
        keysToDelete.add(sessionPrefix + "batches");
        keysToDelete.add(sessionPrefix + "images");
        keysToDelete.add(sessionPrefix + "events");
        for (String ts : batchTsList) {
            keysToDelete.add(sessionPrefix + "batch:" + ts);
        }
        redisTemplate.delete(keysToDelete);
        log.info("清理场次 {} Redis 键 {} 个", sessionId, keysToDelete.size());
    }

    private Session getActiveSession(Long roomId) {
        Session session = sessionMapper.selectOne(
                new LambdaQueryWrapper<Session>()
                        .eq(Session::getRoomId, roomId)
                        .eq(Session::getStatus, 0)
                        .last("LIMIT 1"));
        if (session == null) throw new BizException("当前没有进行中的轮次");
        return session;
    }
}
