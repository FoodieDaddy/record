package com.smartrecord.service.impl;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.smartrecord.dto.behavior.BehaviorReportReq;
import com.smartrecord.dto.admin.BehaviorDashboardResp;
import com.smartrecord.entity.BehaviorLog;
import com.smartrecord.mapper.BehaviorLogMapper;
import com.smartrecord.service.BehaviorLogService;
import com.smartrecord.util.SnowflakeIdGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 前端行为日志服务实现类
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BehaviorLogServiceImpl implements BehaviorLogService {

    private final BehaviorLogMapper behaviorLogMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void saveBatchLogs(Long userId, String ip, String userAgent, List<BehaviorReportReq> reports) {
        if (reports == null || reports.isEmpty()) {
            return;
        }
        log.info("开始执行前端日志异步保存: userId={}, 数量={}", userId, reports.size());
        for (BehaviorReportReq req : reports) {
            BehaviorLog logEntity = new BehaviorLog();
            logEntity.setId(idGenerator.nextId());
            logEntity.setUserId(userId);
            logEntity.setActionType(req.getActionType());
            logEntity.setPagePath(req.getPagePath());
            logEntity.setPayload(req.getPayload());
            logEntity.setIp(ip);
            logEntity.setUserAgent(userAgent);
            logEntity.setCreatedAt(LocalDateTime.now());
            behaviorLogMapper.insert(logEntity);
        }
        log.info("前端日志异步保存成功: userId={}, 实际插入={}", userId, reports.size());
    }

    @Override
    public Page<BehaviorLog> getPageLogs(int page, int size, String actionType, Long userId, String keyword, String startTime, String endTime) {
        Page<BehaviorLog> pageParam = new Page<>(page, size);
        LambdaQueryWrapper<BehaviorLog> queryWrapper = new LambdaQueryWrapper<>();

        queryWrapper.eq(StringUtils.hasText(actionType), BehaviorLog::getActionType, actionType)
                .eq(userId != null, BehaviorLog::getUserId, userId);

        if (StringUtils.hasText(keyword)) {
            queryWrapper.and(wrapper -> wrapper.like(BehaviorLog::getPagePath, keyword)
                    .or()
                    .like(BehaviorLog::getPayload, keyword));
        }

        if (StringUtils.hasText(startTime)) {
            try {
                DateTimeFormatter dtf = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
                queryWrapper.ge(BehaviorLog::getCreatedAt, LocalDateTime.parse(startTime, dtf));
            } catch (Exception e) {
                queryWrapper.ge(BehaviorLog::getCreatedAt, startTime);
            }
        }

        if (StringUtils.hasText(endTime)) {
            try {
                DateTimeFormatter dtf = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
                queryWrapper.le(BehaviorLog::getCreatedAt, LocalDateTime.parse(endTime, dtf));
            } catch (Exception e) {
                queryWrapper.le(BehaviorLog::getCreatedAt, endTime);
            }
        }

        queryWrapper.orderByDesc(BehaviorLog::getCreatedAt);
        return behaviorLogMapper.selectPage(pageParam, queryWrapper);
    }

    @Override
    public BehaviorDashboardResp getBehaviorDashboardStats() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startRange = now.minusDays(6).withHour(0).withMinute(0).withSecond(0);

        // 1. 系统异常趋势 (近 7 天)
        List<Map<String, Object>> errorList = behaviorLogMapper.selectMaps(
                new QueryWrapper<BehaviorLog>()
                        .select("DATE_FORMAT(created_at, '%m-%d') as dateStr", "action_type as actionType", "count(*) as cnt")
                        .ge("created_at", startRange)
                        .in("action_type", List.of("JS_ERROR", "NETWORK_ERROR"))
                        .groupBy("dateStr", "actionType")
        );

        List<String> dates = new ArrayList<>();
        DateTimeFormatter displayFmt = DateTimeFormatter.ofPattern("MM-dd");
        for (int i = 6; i >= 0; i--) {
            dates.add(now.minusDays(i).format(displayFmt));
        }

        List<Long> jsErrors = new ArrayList<>();
        List<Long> networkErrors = new ArrayList<>();
        Map<String, Long> jsMap = new HashMap<>();
        Map<String, Long> netMap = new HashMap<>();

        if (errorList != null) {
            for (Map<String, Object> map : errorList) {
                String dateStr = String.valueOf(map.get("dateStr"));
                String actionType = String.valueOf(map.get("actionType"));
                Long cnt = ((Number) map.get("cnt")).longValue();
                if ("JS_ERROR".equals(actionType)) {
                    jsMap.put(dateStr, cnt);
                } else if ("NETWORK_ERROR".equals(actionType)) {
                    netMap.put(dateStr, cnt);
                }
            }
        }

        for (String d : dates) {
            jsErrors.add(jsMap.getOrDefault(d, 0L));
            networkErrors.add(netMap.getOrDefault(d, 0L));
        }

        BehaviorDashboardResp.ErrorTrend errorTrend = BehaviorDashboardResp.ErrorTrend.builder()
                .dates(dates)
                .jsErrors(jsErrors)
                .networkErrors(networkErrors)
                .build();

        // 2. 慢接口响应时间排行 (近 7 天, 平均耗时前10)
        List<BehaviorLog> slowLogs = behaviorLogMapper.selectList(
                new LambdaQueryWrapper<BehaviorLog>()
                        .eq(BehaviorLog::getActionType, "SLOW_REQUEST")
                        .ge(BehaviorLog::getCreatedAt, startRange)
        );

        Map<String, List<Double>> urlDurations = new HashMap<>();
        Map<String, String> urlMethods = new HashMap<>();

        if (slowLogs != null) {
            for (BehaviorLog logItem : slowLogs) {
                try {
                    String payload = logItem.getPayload();
                    if (StringUtils.hasText(payload)) {
                        Map<?, ?> map = objectMapper.readValue(payload, Map.class);
                        String url = String.valueOf(map.get("url"));
                        String method = String.valueOf(map.get("method"));
                        Number durationNum = (Number) map.get("duration");
                        if (url != null && durationNum != null) {
                            String key = method + " " + url;
                            urlDurations.computeIfAbsent(key, k -> new ArrayList<>()).add(durationNum.doubleValue());
                            urlMethods.put(key, method);
                        }
                    }
                } catch (Exception e) {
                    log.warn("解析慢请求日志 payload 异常, id={}", logItem.getId(), e);
                }
            }
        }

        List<BehaviorDashboardResp.SlowRequestRank> slowRankList = urlDurations.entrySet().stream()
                .map(entry -> {
                    String key = entry.getKey();
                    String method = urlMethods.get(key);
                    String url = key.substring(method.length() + 1);
                    List<Double> durs = entry.getValue();
                    double avg = durs.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
                    return BehaviorDashboardResp.SlowRequestRank.builder()
                            .url(url)
                            .method(method)
                            .avgDuration(Math.round(avg * 100.0) / 100.0) // 保留两位小数
                            .count(durs.size())
                            .build();
                })
                .sorted((a, b) -> Double.compare(b.getAvgDuration(), a.getAvgDuration())) // 按平均响应耗时降序
                .limit(10)
                .collect(Collectors.toList());

        // 3. 行为类型分布
        List<Map<String, Object>> distList = behaviorLogMapper.selectMaps(
                new QueryWrapper<BehaviorLog>()
                        .select("action_type as actionType", "count(*) as cnt")
                        .groupBy("actionType")
                        .orderByDesc("cnt")
        );

        List<BehaviorDashboardResp.ActionDist> dists = new ArrayList<>();
        if (distList != null) {
            dists = distList.stream()
                    .map(m -> BehaviorDashboardResp.ActionDist.builder()
                            .actionType(String.valueOf(m.get("actionType")))
                            .count(((Number) m.get("cnt")).longValue())
                            .build())
                    .collect(Collectors.toList());
        }

        return BehaviorDashboardResp.builder()
                .errorTrend(errorTrend)
                .slowRequests(slowRankList)
                .actionDistribution(dists)
                .build();
    }
}

