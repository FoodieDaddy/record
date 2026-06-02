package com.mahjong.score.service.impl;

import cn.hutool.json.JSONUtil;
import com.mahjong.score.dto.score.ChartDataResp;
import com.mahjong.score.service.OverviewService;
import com.mahjong.score.service.ScoreService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class OverviewServiceImpl implements OverviewService {

    private final ScoreService scoreService;
    private final StringRedisTemplate redisTemplate;

    private static final String OVERVIEW_KEY_PREFIX = "mj:room:";
    private static final String OVERVIEW_KEY_SUFFIX = ":overview";
    private static final String USER_CACHE_PREFIX = "mj:user:";

    @Override
    @Async
    public void computeOverview(Long roomId) {
        try {
            ChartDataResp chartData = scoreService.getChartData(roomId);
            String json = JSONUtil.toJsonStr(chartData);
            String key = OVERVIEW_KEY_PREFIX + roomId + OVERVIEW_KEY_SUFFIX;
            redisTemplate.opsForValue().set(key, json, 24, TimeUnit.HOURS);
            log.info("异步计算房间 {} 总览数据完成", roomId);
        } catch (Exception e) {
            log.error("异步计算房间 {} 总览数据失败", roomId, e);
        }
    }

    @Override
    public String getCachedOverview(Long roomId) {
        String key = OVERVIEW_KEY_PREFIX + roomId + OVERVIEW_KEY_SUFFIX;
        String cached = redisTemplate.opsForValue().get(key);
        if (cached != null) return cached;

        // 缓存 miss，同步计算
        ChartDataResp chartData = scoreService.getChartData(roomId);
        String json = JSONUtil.toJsonStr(chartData);
        redisTemplate.opsForValue().set(key, json, 24, TimeUnit.HOURS);
        return json;
    }
}
