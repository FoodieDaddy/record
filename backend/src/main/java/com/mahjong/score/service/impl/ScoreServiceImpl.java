package com.mahjong.score.service.impl;

import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mahjong.score.common.BizException;
import com.mahjong.score.common.EmotionType;
import com.mahjong.score.dto.score.ScoreBatchResp;
import com.mahjong.score.dto.score.ScoreSubmitResp;
import com.mahjong.score.dto.score.SessionScoreResp;
import com.mahjong.score.dto.score.SubmitScoreReq;
import com.mahjong.score.entity.Room;
import com.mahjong.score.entity.RoomMember;
import com.mahjong.score.entity.ScoreImage;
import com.mahjong.score.entity.Session;
import com.mahjong.score.entity.User;
import com.mahjong.score.mapper.RoomMapper;
import com.mahjong.score.mapper.RoomMemberMapper;
import com.mahjong.score.mapper.ScoreImageMapper;
import com.mahjong.score.mapper.SessionMapper;
import com.mahjong.score.mapper.UserMapper;
import com.mahjong.score.service.EmotionAudioPool;
import com.mahjong.score.service.ScoreService;
import com.mahjong.score.service.impl.ws.ScoreWebSocket;
import com.mahjong.score.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
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
    private final ScoreImageMapper scoreImageMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final StringRedisTemplate redisTemplate;
    private final RedissonClient redissonClient;
    private final ScoreWebSocket scoreWebSocket;
    private final EmotionAudioPool emotionAudioPool;

    private static final String SESSION_PREFIX = "mj:session:";

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

            // 8. 为提交者返回情绪音频
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

        // 查询用户信息
        Set<Long> userIds = totals.keySet();
        Map<Long, User> userMap = userIds.isEmpty() ? Collections.emptyMap()
                : userMapper.selectBatchIds(userIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        return totals.entrySet().stream()
                .sorted(Map.Entry.<Long, Integer>comparingByValue().reversed())
                .map(e -> {
                    User u = userMap.get(e.getKey());
                    return ScoreBatchResp.PlayerScoreVO.builder()
                            .userId(e.getKey())
                            .nickname(u != null ? u.getNickname() : "")
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

        // 查询用户信息（批量）
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
            Map<Long, User> userMap = uids.isEmpty() ? Collections.emptyMap()
                    : userMapper.selectBatchIds(uids).stream()
                            .collect(Collectors.toMap(User::getId, u -> u));

            for (Map.Entry<Object, Object> e : entries.entrySet()) {
                Long uid = Long.parseLong(e.getKey().toString());
                User u = userMap.get(uid);
                scoreVOs.add(ScoreBatchResp.PlayerScoreVO.builder()
                        .userId(uid)
                        .nickname(u != null ? u.getNickname() : "")
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
        // 从 MySQL score 表查询，按 created_at 分组
        List<com.mahjong.score.entity.Score> scores = sessionMapper.selectScoreBySessionId(sessionId);
        if (scores.isEmpty()) return Collections.emptyList();

        // 按秒级时间戳分组
        Map<LocalDateTime, List<com.mahjong.score.entity.Score>> grouped = scores.stream()
                .collect(Collectors.groupingBy(com.mahjong.score.entity.Score::getCreatedAt));

        // 查询用户信息
        Set<Long> allUserIds = scores.stream().map(com.mahjong.score.entity.Score::getUserId).collect(Collectors.toSet());
        Map<Long, User> userMap = allUserIds.isEmpty() ? Collections.emptyMap()
                : userMapper.selectBatchIds(allUserIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        // 查询图片
        List<ScoreImage> images = scoreImageMapper.selectList(
                new LambdaQueryWrapper<ScoreImage>().eq(ScoreImage::getSessionId, sessionId));

        return grouped.entrySet().stream()
                .sorted(Map.Entry.<LocalDateTime, List<com.mahjong.score.entity.Score>>comparingByKey().reversed())
                .map(e -> {
                    List<ScoreBatchResp.PlayerScoreVO> scoreVOs = e.getValue().stream()
                            .map(s -> {
                                User u = userMap.get(s.getUserId());
                                return ScoreBatchResp.PlayerScoreVO.builder()
                                        .userId(s.getUserId())
                                        .nickname(u != null ? u.getNickname() : "")
                                        .score(s.getScore())
                                        .build();
                            })
                            .collect(Collectors.toList());

                    return ScoreBatchResp.builder()
                            .batchTime(e.getKey())
                            .createdBy(e.getValue().get(0).getCreatedBy())
                            .scores(scoreVOs)
                            .imageUrls(images.stream()
                                    .map(ScoreImage::getImageUrl)
                                    .collect(Collectors.toList()))
                            .build();
                })
                .collect(Collectors.toList());
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
