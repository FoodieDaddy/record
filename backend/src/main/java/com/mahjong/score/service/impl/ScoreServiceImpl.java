package com.mahjong.score.service.impl;

import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mahjong.score.common.BizException;
import com.mahjong.score.dto.score.ScoreBatchResp;
import com.mahjong.score.dto.score.SessionScoreResp;
import com.mahjong.score.dto.score.SubmitScoreReq;
import com.mahjong.score.entity.RoomMember;
import com.mahjong.score.entity.ScoreImage;
import com.mahjong.score.entity.Session;
import com.mahjong.score.entity.User;
import com.mahjong.score.mapper.RoomMemberMapper;
import com.mahjong.score.mapper.ScoreImageMapper;
import com.mahjong.score.mapper.SessionMapper;
import com.mahjong.score.mapper.UserMapper;
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
    private final UserMapper userMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final ScoreImageMapper scoreImageMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final StringRedisTemplate redisTemplate;
    private final RedissonClient redissonClient;
    private final ScoreWebSocket scoreWebSocket;

    private static final String SESSION_PREFIX = "mj:session:";

    @Override
    public void submitScore(Long userId, SubmitScoreReq req) {
        Session session = sessionMapper.selectById(req.getSessionId());
        if (session == null || session.getStatus() != 0) {
            throw new BizException("场次不存在或已结算");
        }

        // 验证提交者是房间成员
        RoomMember submitter = roomMemberMapper.selectOne(
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getRoomId, session.getRoomId())
                        .eq(RoomMember::getUserId, userId));
        if (submitter == null) throw new BizException("您不是该房间成员");

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

            // 6. WebSocket 推送给房间内所有玩家
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "SCORE_UPDATE");
            pushData.put("sessionId", session.getId());
            pushData.put("batchTime", batchTs);
            pushData.put("scores", req.getScores());
            scoreWebSocket.pushToRoom(String.valueOf(session.getRoomId()), pushData);

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

    @Override
    public List<ScoreBatchResp> getRecentScores(Long sessionId, Integer count) {
        return getBatchesFromRedis(sessionId, count);
    }

    @Override
    public List<ScoreBatchResp.PlayerScoreVO> getRanking(Long sessionId) {
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
        Map<Long, User> userMap = userMapper.selectBatchIds(userIds).stream()
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
            Map<Long, User> userMap = userMapper.selectBatchIds(uids).stream()
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
        Map<Long, User> userMap = userMapper.selectBatchIds(allUserIds).stream()
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
}
