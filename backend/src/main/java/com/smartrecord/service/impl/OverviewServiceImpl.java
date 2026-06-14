package com.smartrecord.service.impl;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.smartrecord.common.BizException;
import com.smartrecord.common.ErrorCode;
import com.smartrecord.dto.score.ChartDataResp;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.User;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.UserMapper;
import com.smartrecord.service.OverviewService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings({"null", "unchecked"})
public class OverviewServiceImpl implements OverviewService {

    private final RoomMapper roomMapper;
    private final UserMapper userMapper;
    private final StringRedisTemplate redisTemplate;

    private static final String ROOM_PREFIX = "sr:room:";

    private String dataKey(Long roomId) { return ROOM_PREFIX + roomId + ":data"; }

    @Override
    @Async("asyncExecutor")
    public void computeOverview(Long roomId) {
        try {
            // 前置校验房间状态，已结算则直接退出，防止回写脏数据造成 Redis 内存泄露
            Room room = roomMapper.selectById(roomId);
            if (room == null || room.getStatus() != 0) {
                log.info("房间 {} 已结算或不存在，跳过异步总览计算", roomId);
                return;
            }
            ChartDataResp chartData = getChartData(roomId);
            String json = JSONUtil.toJsonStr(chartData);
            redisTemplate.opsForHash().put(dataKey(roomId), "overview", json);
            log.info("异步计算房间 {} 总览数据完成", roomId);
        } catch (Exception e) {
            log.error("异步计算房间 {} 总览数据失败", roomId, e);
        }
    }

    @Override
    public String getCachedOverview(Long roomId) {
        Object cached = redisTemplate.opsForHash().get(dataKey(roomId), "overview");
        if (cached != null) return (String) cached;

        // 缓存 miss，同步计算
        ChartDataResp chartData = getChartData(roomId);
        String json = JSONUtil.toJsonStr(chartData);
        redisTemplate.opsForHash().put(dataKey(roomId), "overview", json);
        return json;
    }

    @Override
    public ChartDataResp getChartData(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException(ErrorCode.ROOM_NOT_FOUND);

        String roomPrefix = ROOM_PREFIX + roomId + ":";

        if (room.getStatus() == 0) {
            // 活跃房间优先读 Redis；若 Redis 已被 settle 清理且 allRecord 有数据，降级读 allRecord
            ChartDataResp redisResult = buildChartFromRedis(roomId, roomPrefix);
            if (!redisResult.getTimestamps().isEmpty() || room.getAllRecord() == null || room.getAllRecord().isEmpty()) {
                return redisResult;
            }
            return buildChartFromAllRecord(room);
        } else {
            return buildChartFromAllRecord(room);
        }
    }

    // ===== 图表构建 =====

    private ChartDataResp buildChartFromRedis(Long roomId, String roomPrefix) {
        return buildChartFromEvents(roomPrefix);
    }

    private ChartDataResp buildChartFromAllRecord(Room room) {
        List<Map<String, Object>> allRecord = room.getAllRecord();
        if (allRecord == null || allRecord.isEmpty()) {
            return ChartDataResp.builder().timestamps(List.of()).series(List.of()).build();
        }

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
        Map<Long, String> nicknameMap = loadNicknameMap(userIds, room.getId());

        List<Long> timestamps = new ArrayList<>();
        Map<Long, List<Integer>> userScores = new HashMap<>();
        userIds.forEach(uid -> userScores.put(uid, new ArrayList<>()));

        Map<Long, Integer> cumulative = new HashMap<>();
        userIds.forEach(uid -> cumulative.put(uid, 0));

        for (Map<String, Object> batch : allRecord) {
            Object batchTimeObj = batch.get("batchTime");
            if (batchTimeObj == null) continue; // 跳过 meta 记录（transferEvents）
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

    /**
     * 从 events（计分流水 ZSet）构建图表数据
     */
    private ChartDataResp buildChartFromEvents(String roomPrefix) {
        String eventsKey = roomPrefix + "events";
        Set<ZSetOperations.TypedTuple<String>> events =
                redisTemplate.opsForZSet().rangeWithScores(eventsKey, 0, -1);
        if (events == null || events.isEmpty()) {
            return ChartDataResp.builder().timestamps(List.of()).series(List.of()).build();
        }

        // 收集所有用户 ID
        Set<Long> userIdSet = new LinkedHashSet<>();
        List<JSONObject> eventList = new ArrayList<>();
        for (ZSetOperations.TypedTuple<String> tuple : events) {
            String json = tuple.getValue();
            if (json == null) continue;
            try {
                JSONObject obj = JSONUtil.parseObj(json);
                eventList.add(obj);
                userIdSet.add(obj.getLong("from"));
                userIdSet.add(obj.getLong("to"));
            } catch (Exception ignored) {}
        }
        if (eventList.isEmpty()) {
            return ChartDataResp.builder().timestamps(List.of()).series(List.of()).build();
        }

        Long roomId = null;
        try {
            String temp = roomPrefix.substring("sr:room:".length());
            roomId = Long.parseLong(temp.substring(0, temp.indexOf(":")));
        } catch (Exception ignored) {}

        List<Long> userIds = new ArrayList<>(userIdSet);
        Map<Long, String> nicknameMap = loadNicknameMap(userIds, roomId);

        // 按时间排序
        eventList.sort(Comparator.comparingLong(o -> o.getLong("time", 0L)));

        // 构建累计积分序列 + 变动额 + 交易对手
        List<Long> timestamps = new ArrayList<>();
        Map<Long, List<Integer>> userScores = new HashMap<>();
        Map<Long, List<Integer>> userDeltas = new HashMap<>();
        Map<Long, List<Long>> userTargets = new HashMap<>();
        userIds.forEach(uid -> {
            userScores.put(uid, new ArrayList<>());
            userDeltas.put(uid, new ArrayList<>());
            userTargets.put(uid, new ArrayList<>());
        });

        Map<Long, Integer> cumulative = new HashMap<>();
        userIds.forEach(uid -> cumulative.put(uid, 0));

        for (JSONObject event : eventList) {
            long time = event.getLong("time", 0L);
            long fromId = event.getLong("from");
            long toId = event.getLong("to");
            int amount = event.getInt("amount");

            timestamps.add(time);
            cumulative.merge(fromId, -amount, Integer::sum);
            cumulative.merge(toId, amount, Integer::sum);

            for (Long uid : userIds) {
                userScores.get(uid).add(cumulative.getOrDefault(uid, 0));
                // 默认无变动，仅事件涉及的用户会覆盖
                userDeltas.get(uid).add(0);
                userTargets.get(uid).add(null);
            }
            // from: 支出 → delta 为负，target 为收款方
            userDeltas.get(fromId).set(userDeltas.get(fromId).size() - 1, -amount);
            userTargets.get(fromId).set(userTargets.get(fromId).size() - 1, toId);
            // to: 收入 → delta 为正，target 为付款方
            userDeltas.get(toId).set(userDeltas.get(toId).size() - 1, amount);
            userTargets.get(toId).set(userTargets.get(toId).size() - 1, fromId);
        }

        List<ChartDataResp.Series> seriesList = userIds.stream()
                .map(uid -> ChartDataResp.Series.builder()
                        .userId(uid)
                        .nickname(nicknameMap.getOrDefault(uid, "玩家"))
                        .scores(userScores.get(uid))
                        .deltas(userDeltas.get(uid))
                        .targets(userTargets.get(uid))
                        .build())
                .collect(Collectors.toList());

        return ChartDataResp.builder()
                .timestamps(timestamps)
                .series(seriesList)
                .build();
    }

    private Map<Long, String> loadNicknameMap(List<Long> userIds, Long roomId) {
        if (userIds.isEmpty()) return Collections.emptyMap();

        Map<Long, String> map = new HashMap<>();
        List<Long> missedIds = new ArrayList<>();

        // 1. 如果有 roomId，优先尝试从房间缓存盒读取
        if (roomId != null) {
            String roomDataKey = "sr:room:" + roomId + ":data";
            try {
                Map<Object, Object> entries = redisTemplate.opsForHash().entries(roomDataKey);
                if (entries != null) {
                    for (Long uid : userIds) {
                        Object val = entries.get("a:" + uid);
                        if (val != null) {
                            JSONObject memberObj = JSONUtil.parseObj((String) val);
                            map.put(uid, memberObj.getStr("nickname", "玩家"));
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("loadNicknameMap 尝试从房间缓存加载昵称失败: roomId={}", roomId, e);
            }
        }

        // 2. 对缺失的，再读取个人缓存 sr:user:xxx:info
        for (Long uid : userIds) {
            if (map.containsKey(uid)) continue;
            Object cached = redisTemplate.opsForHash().get("sr:user:" + uid, "info");
            if (cached != null) {
                JSONObject userObj = JSONUtil.parseObj((String) cached);
                map.put(uid, userObj.getStr("nickname", "玩家"));
            } else {
                missedIds.add(uid);
            }
        }

        // 3. 对仍然缺失的查数据库并回写缓存
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
}
