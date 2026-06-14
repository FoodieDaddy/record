package com.smartrecord.service.impl;

import com.smartrecord.dto.mirror.MirrorStatsResp;
import com.smartrecord.dto.mirror.MirrorStatsResp.StatDimension;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.service.MirrorStatsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.alicp.jetcache.Cache;
import com.alicp.jetcache.anno.CreateCache;
import com.alicp.jetcache.anno.CacheType;
import com.alicp.jetcache.anno.Cached;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class MirrorStatsServiceImpl implements MirrorStatsService {

    private final RoomMemberMapper roomMemberMapper;
    private final RoomMapper roomMapper;
    private final ObjectMapper objectMapper;

    @SuppressWarnings("deprecation")
    @CreateCache(name = "sr:user:stats:", cacheType = CacheType.BOTH, expire = 1800)
    private Cache<Long, MirrorStatsResp> statsCache;

    @Override
    @Cached(name = "sr:user:stats:", key = "#userId", cacheType = CacheType.BOTH, expire = 1800)
    public MirrorStatsResp calculate(Long userId) {
        // 获取原始数据
        List<Map<String, Object>> trend = roomMemberMapper.selectTrendByUserId(userId, 20);
        List<Integer> netScores = new ArrayList<>();
        for (Map<String, Object> row : trend) {
            Object ns = row.get("netScore");
            if (ns instanceof Number) netScores.add(((Number) ns).intValue());
        }

        List<Map<String, Object>> recentDetails = getRecentScoreDetails(userId, 200);
        int totalRooms = roomMemberMapper.countSettledRooms(userId);

        // 计算五个维度
        int aggression = calcAggression(recentDetails);
        int stability = calcStability(netScores);
        int participation = calcParticipation(totalRooms);
        int comeback = calcComeback(netScores);
        int dominance = calcDominance(netScores);

        List<StatDimension> dimensions = List.of(
                StatDimension.builder().key("aggression").label("推进倾向").value(aggression)
                        .desc("基于主动计分次数与单次大额得分。").build(),
                StatDimension.builder().key("stability").label("舰体稳定").value(stability)
                        .desc("基于总得分波动率，波动越小越稳定。").build(),
                StatDimension.builder().key("participation").label("接入频率").value(participation)
                        .desc("基于历史对局参与轮次。").build(),
                StatDimension.builder().key("comeback").label("回稳能力").value(comeback)
                        .desc("基于低位波动后的修正能力。").build(),
                StatDimension.builder().key("dominance").label("场域控制").value(dominance)
                        .desc("基于单局最大得分占比。").build()
        );

        return MirrorStatsResp.builder()
                .dimensions(dimensions)
                .sampleSize(netScores.size())
                .calculatedAt(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")))
                .build();
    }

    /**
     * 从用户最近房间的 room.all_record JSON 中提取 per-batch score delta
     */
    private List<Map<String, Object>> getRecentScoreDetails(Long userId, int limit) {
        List<Long> roomIds = roomMemberMapper.selectUserRoomIds(userId, 30);
        List<Map<String, Object>> result = new ArrayList<>();

        for (Long roomId : roomIds) {
            if (result.size() >= limit) break;
            String json = roomMapper.selectAllRecordById(roomId);
            if (json == null || json.isBlank() || "null".equals(json)) continue;

            try {
                List<Object> records = objectMapper.readValue(json,
                        objectMapper.getTypeFactory().constructCollectionType(List.class, Object.class));
                for (Object obj : records) {
                    if (result.size() >= limit) break;
                    @SuppressWarnings("unchecked")
                    Map<String, Object> batch = (Map<String, Object>) obj;
                    List<?> scores = (List<?>) batch.get("scores");
                    if (scores == null) continue;
                    for (Object scoreObj : scores) {
                        if (result.size() >= limit) break;
                        @SuppressWarnings("unchecked")
                        Map<String, Object> ps = (Map<String, Object>) scoreObj;
                        Number uidNum = (Number) ps.get("userId");
                        if (uidNum != null && uidNum.longValue() == userId) {
                            Map<String, Object> detail = new java.util.HashMap<>();
                            detail.put("score", ((Number) ps.get("score")).intValue());
                            result.add(detail);
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("解析房间 all_record 失败: roomId={}", roomId);
            }
        }
        return result;
    }

    /**
     * 进攻性：单次大额得分频率 + 正向积分场次占比
     */
    private int calcAggression(List<Map<String, Object>> details) {
        if (details.isEmpty()) return 0;

        int positiveCount = 0;
        int largeCount = 0;
        int total = details.size();
        double sum = 0;

        for (Map<String, Object> row : details) {
            int s = ((Number) row.get("score")).intValue();
            sum += s;
            if (s > 0) positiveCount++;
        }

        double mean = sum / total;
        double threshold = Math.max(mean * 1.5, 10);

        for (Map<String, Object> row : details) {
            int s = ((Number) row.get("score")).intValue();
            if (s > threshold) largeCount++;
        }

        int ratioScore = (int) Math.round((double) positiveCount / total * 50);
        int largeScore = (int) Math.round(Math.min((double) largeCount / total * 3, 1.0) * 50);

        return clamp(ratioScore + largeScore);
    }

    /**
     * 稳定性：净积分标准差反向映射
     */
    private int calcStability(List<Integer> scores) {
        if (scores.size() <= 1) return 80;
        double stddev = stdDev(scores);
        return clamp((int) Math.round(100 - Math.min(stddev / 80.0, 1.0) * 100));
    }

    /**
     * 参局率：总参局数映射到 0-100
     */
    private int calcParticipation(int totalRooms) {
        return clamp((int) Math.round(Math.min(totalRooms / 50.0, 1.0) * 100));
    }

    /**
     * 回稳力：连续低位后回到正向反馈的场次占比
     * 分析最近 N 场的得分序列，找"先负后正"的模式
     */
    private int calcComeback(List<Integer> netScores) {
        if (netScores.size() < 3) return 50;

        int comebackCount = 0;
        int windowSize = 3;

        for (int i = 0; i <= netScores.size() - windowSize; i++) {
            // 滑动窗口：前半段亏损，后半段盈利
            int firstHalf = 0;
            int secondHalf = 0;
            int half = windowSize / 2;

            for (int j = i; j < i + half; j++) {
                firstHalf += netScores.get(j);
            }
            for (int j = i + half; j < i + windowSize; j++) {
                secondHalf += netScores.get(j);
            }

            if (firstHalf < 0 && secondHalf > 0) {
                comebackCount++;
            }
        }

        int windows = netScores.size() - windowSize + 1;
        return clamp((int) Math.round((double) comebackCount / Math.max(windows, 1) * 100));
    }

    /**
     * 控场力：净积分绝对值的均值映射
     * 净积分越高说明对局面控制力越强
     */
    private int calcDominance(List<Integer> netScores) {
        if (netScores.isEmpty()) return 0;

        double avgAbs = netScores.stream()
                .mapToInt(Integer::intValue)
                .map(Math::abs)
                .average()
                .orElse(0);

        // avgAbs=0 → 0, avgAbs>=50 → 100
        return clamp((int) Math.round(Math.min(avgAbs / 50.0, 1.0) * 100));
    }

    // ---- 工具方法 ----

    private double stdDev(List<Integer> values) {
        if (values.size() <= 1) return 0;
        double mean = values.stream().mapToInt(Integer::intValue).average().orElse(0);
        double sumSq = 0;
        for (int v : values) sumSq += (v - mean) * (v - mean);
        return Math.sqrt(sumSq / values.size());
    }

    private int clamp(int val) {
        return Math.max(0, Math.min(100, val));
    }

    @Override
    public void clearStatsCache(Long userId) {
        if (userId == null) {
            return;
        }
        try {
            statsCache.remove(userId);
            log.info("成功清除五维战力缓存: userId={}", userId);
        } catch (Exception e) {
            log.warn("清除五维战力缓存失败: userId={}", userId, e);
        }
    }
}
