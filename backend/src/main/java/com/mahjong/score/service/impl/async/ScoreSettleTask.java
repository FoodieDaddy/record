package com.mahjong.score.service.impl.async;

import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mahjong.score.entity.RoomMember;
import com.mahjong.score.entity.Score;
import com.mahjong.score.entity.ScoreImage;
import com.mahjong.score.mapper.RoomMemberMapper;
import com.mahjong.score.mapper.ScoreImageMapper;
import com.mahjong.score.mapper.ScoreMapper;
import com.mahjong.score.mapper.SessionMapper;
import com.mahjong.score.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 异步落库任务：场次结算时将 Redis 数据批量写入 MySQL
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ScoreSettleTask {

    private final ScoreMapper scoreMapper;
    private final ScoreImageMapper scoreImageMapper;
    private final SessionMapper sessionMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final StringRedisTemplate redisTemplate;

    private static final String SESSION_PREFIX = "mj:session:";

    @Async
    public void asyncSettle(Long sessionId) {
        log.info("开始异步落库: sessionId={}", sessionId);
        try {
            doSettle(sessionId);
            // 清理 Redis key
            cleanupRedis(sessionId);
            log.info("异步落库完成: sessionId={}", sessionId);
        } catch (Exception e) {
            log.error("异步落库失败: sessionId={}", sessionId, e);
        }
    }

    private void doSettle(Long sessionId) {
        // 1. 读取所有批次时间戳
        String batchesKey = SESSION_PREFIX + sessionId + ":batches";
        List<String> batchTsList = redisTemplate.opsForList().range(batchesKey, 0, -1);
        if (batchTsList == null || batchTsList.isEmpty()) {
            log.info("场次无记分数据: sessionId={}", sessionId);
            return;
        }

        // 2. 获取场次信息
        var session = sessionMapper.selectById(sessionId);
        Long roomId = session.getRoomId();

        // 3. 读取排行榜总分，用于回填 room_member.total_score
        String scoresKey = SESSION_PREFIX + sessionId + ":scores";
        Set<ZSetOperations.TypedTuple<String>> rankings =
                redisTemplate.opsForZSet().reverseRangeWithScores(scoresKey, 0, -1);

        // 4. 批量读取每个批次的得分明细
        List<Score> allScores = new ArrayList<>();
        for (String ts : batchTsList) {
            String batchKey = SESSION_PREFIX + sessionId + ":batch:" + ts;
            Map<Object, Object> entries = redisTemplate.opsForHash().entries(batchKey);
            if (entries.isEmpty()) continue;

            long tsMs = Long.parseLong(ts);
            LocalDateTime batchTime = Instant.ofEpochMilli(tsMs).atZone(ZoneId.systemDefault()).toLocalDateTime();

            for (Map.Entry<Object, Object> e : entries.entrySet()) {
                Long userId = Long.parseLong(e.getKey().toString());
                int score = Integer.parseInt(e.getValue().toString());

                Score s = new Score();
                s.setId(idGenerator.nextId());
                s.setSessionId(sessionId);
                s.setRoomId(roomId);
                s.setUserId(userId);
                s.setScore(score);
                s.setCreatedBy(userId); // 简化，实际可从 batch 中获取
                s.setCreatedAt(batchTime);
                allScores.add(s);
            }
        }

        // 5. 批量插入 score 表（分批，每批 500 条）
        if (!allScores.isEmpty()) {
            for (int i = 0; i < allScores.size(); i += 500) {
                List<Score> batch = allScores.subList(i, Math.min(i + 500, allScores.size()));
                for (Score s : batch) {
                    scoreMapper.insert(s);
                }
            }
        }

        // 6. 读取并落库图片
        String imagesKey = SESSION_PREFIX + sessionId + ":images";
        List<String> imageUrls = redisTemplate.opsForList().range(imagesKey, 0, -1);
        if (imageUrls != null && !imageUrls.isEmpty()) {
            for (int i = 0; i < imageUrls.size(); i++) {
                ScoreImage img = new ScoreImage();
                img.setId(idGenerator.nextId());
                img.setSessionId(sessionId);
                img.setRoomId(roomId);
                img.setUserId(0L); // 简化，实际可记录上传者
                img.setImageUrl(imageUrls.get(i));
                img.setSortOrder(i);
                scoreImageMapper.insert(img);
            }
        }

        // 7. 回填 room_member.total_score（从排行榜）
        if (rankings != null) {
            for (ZSetOperations.TypedTuple<String> t : rankings) {
                String uid = t.getValue();
                if (uid == null || "init".equals(uid)) continue;
                Long userId = Long.parseLong(uid);
                int totalScore = t.getScore().intValue();

                RoomMember rm = roomMemberMapper.selectOne(
                        new LambdaQueryWrapper<RoomMember>()
                                .eq(RoomMember::getRoomId, roomId)
                                .eq(RoomMember::getUserId, userId));
                // room_member 表没有 total_score 字段（已去掉），如需可扩展
            }
        }
    }

    private void cleanupRedis(Long sessionId) {
        String prefix = SESSION_PREFIX + sessionId + ":";
        List<String> keysToDelete = new ArrayList<>();

        // 批次列表
        String batchesKey = prefix + "batches";
        List<String> batchTs = redisTemplate.opsForList().range(batchesKey, 0, -1);
        if (batchTs != null) {
            keysToDelete.add(batchesKey);
            for (String ts : batchTs) {
                keysToDelete.add(prefix + "batch:" + ts);
            }
        }

        // 排行榜
        keysToDelete.add(prefix + "scores");
        // 图片
        keysToDelete.add(prefix + "images");

        redisTemplate.delete(keysToDelete);
        log.info("清理 Redis key 完成: sessionId={}, count={}", sessionId, keysToDelete.size());
    }
}
