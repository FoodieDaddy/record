package com.smartrecord.task;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 宕机恢复：启动时自动将 MySQL 中活跃房间的状态重建到 Redis
 */
@Slf4j
@Component
@RequiredArgsConstructor
@SuppressWarnings("null")
public class CacheWarmUpRunner implements ApplicationRunner {

    private static final int EXPIRE_HOURS = 24;

    private final RoomMapper roomMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final UserMapper userMapper;
    private final StringRedisTemplate redisTemplate;

    @Override
    public void run(ApplicationArguments args) {
        log.info(">>> 缓存预热开始...");
        long start = System.currentTimeMillis();

        try {
            List<Room> activeRooms = roomMapper.selectList(
                    new LambdaQueryWrapper<Room>().eq(Room::getStatus, 0));
            if (activeRooms.isEmpty()) {
                log.info("没有活跃房间，跳过缓存预热");
                return;
            }

            int roomCount = 0;

            for (Room room : activeRooms) {
                Long roomId = room.getId();
                try {
                    // 恢复房间成员：活跃席位、归档席位分开重建
                    List<RoomMember> members = roomMemberMapper.selectList(
                            new LambdaQueryWrapper<RoomMember>()
                                    .eq(RoomMember::getRoomId, roomId));

                    String dataKey = "sr:room:" + roomId + ":data";

                    // 写入房间信息字段
                    redisTemplate.opsForHash().put(dataKey, "ownerId", String.valueOf(room.getOwnerId()));
                    redisTemplate.opsForHash().put(dataKey, "status", "0");
                    redisTemplate.opsForHash().put(dataKey, "scoreMode", String.valueOf(room.getScoreMode() != null ? room.getScoreMode() : 1));
                    redisTemplate.opsForHash().put(dataKey, "roomNo", room.getRoomNo());

                    // 启动恢复时先清掉旧成员字段，避免残留
                    Map<Object, Object> existingFields = redisTemplate.opsForHash().entries(dataKey);
                    if (existingFields != null) {
                        for (Object field : existingFields.keySet()) {
                            String key = (String) field;
                            if (key.startsWith("a:") || key.startsWith("r:")) {
                                redisTemplate.opsForHash().delete(dataKey, key);
                            }
                        }
                    }

                    if (!members.isEmpty()) {
                        List<Long> userIds = members.stream()
                                .map(RoomMember::getUserId).collect(Collectors.toList());
                        Map<Long, String> userJsonMap = batchLoadUserJson(userIds);
                        long now = System.currentTimeMillis();

                        for (RoomMember m : members) {
                            String userJson = userJsonMap.get(m.getUserId());
                            String nickname = "";
                            String avatarUrl = "";
                            if (userJson != null) {
                                JSONObject obj = JSONUtil.parseObj(userJson);
                                nickname = obj.getStr("nickname", "");
                                avatarUrl = obj.getStr("avatarUrl", "");
                            }

                            String memberJson = JSONUtil.toJsonStr(Map.of(
                                    "userId", m.getUserId(),
                                    "nickname", nickname,
                                    "avatarUrl", avatarUrl));
                            long joinedAtMs = m.getJoinedAt() != null ?
                                    m.getJoinedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli() :
                                    now;
                            long lastSeenAtMs = m.getQuitTime() != null ?
                                    m.getQuitTime().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli() :
                                    now;
                            String archiveJson = JSONUtil.toJsonStr(Map.of(
                                    "userId", m.getUserId(),
                                    "nickname", nickname,
                                    "avatarUrl", avatarUrl,
                                    "firstJoinedAt", joinedAtMs,
                                    "lastSeenAt", lastSeenAtMs));
                            redisTemplate.opsForHash().put(dataKey, "r:" + m.getUserId(), archiveJson);

                            if (m.getQuitTime() == null) {
                                // 活跃成员写入 data Hash / user room mapping
                                redisTemplate.opsForHash().put(dataKey, "a:" + m.getUserId(), memberJson);
                                redisTemplate.opsForSet().add("sr:user:rooms:" + m.getUserId(), String.valueOf(roomId));
                            } else {
                                // 已离席成员只保留 archive，避免重启后被误识别成实时席位
                                redisTemplate.opsForSet().remove("sr:user:rooms:" + m.getUserId(), String.valueOf(roomId));
                            }
                        }
                    }
                    redisTemplate.expire(dataKey, EXPIRE_HOURS, TimeUnit.HOURS);

                    // 恢复房间号映射
                    redisTemplate.opsForValue().set("sr:room_no:" + room.getRoomNo(),
                            String.valueOf(roomId), EXPIRE_HOURS, TimeUnit.HOURS);

                    // 恢复排行榜，先保留运行期分数，再补齐未发生流转的 0 分成员。
                    warmupRoomScores(roomId, members);

                    // 回填 lastActiveAt（旧房间可能为 null）
                    if (room.getLastActiveAt() == null) {
                        room.setLastActiveAt(LocalDateTime.now());
                        roomMapper.updateById(room);
                    }

                    roomCount++;
                } catch (Exception e) {
                    log.error("恢复房间 {} 缓存失败", roomId, e);
                }
            }

            log.info("<<< 缓存预热完成：{} 个房间，耗时 {}ms",
                    roomCount, System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("缓存预热异常", e);
        }
    }

    private void warmupRoomScores(Long roomId, List<RoomMember> members) {
        String scoresKey = "sr:room:" + roomId + ":scores";
        // Redis 仍有数据时跳过重建，避免覆盖运行期分数
        Long existingSize = redisTemplate.opsForZSet().zCard(scoresKey);
        if (existingSize != null && existingSize > 0) {
            ensureZeroScoreMembers(scoresKey, members);
            log.debug("房间 {} scores ZSet 已存在（{} 条），跳过重建", roomId, existingSize);
            redisTemplate.expire(scoresKey, EXPIRE_HOURS, TimeUnit.HOURS);
            return;
        }

        // 从 room.all_record JSON 读取已归档的得分数据
        String allRecordJson = roomMapper.selectAllRecordById(roomId);
        if (allRecordJson == null || allRecordJson.isBlank() || "null".equals(allRecordJson)) {
            ensureZeroScoreMembers(scoresKey, members);
            redisTemplate.expire(scoresKey, EXPIRE_HOURS, TimeUnit.HOURS);
            return;
        }

        try {
            cn.hutool.json.JSONArray records = cn.hutool.json.JSONUtil.parseArray(allRecordJson);
            Map<Long, Integer> playerTotals = new java.util.HashMap<>();
            for (int i = 0; i < records.size(); i++) {
                cn.hutool.json.JSONObject batch = records.getJSONObject(i);
                cn.hutool.json.JSONArray scores = batch.getJSONArray("scores");
                if (scores == null) continue;
                for (int j = 0; j < scores.size(); j++) {
                    cn.hutool.json.JSONObject ps = scores.getJSONObject(j);
                    Long uid = ps.getLong("userId");
                    int score = ps.getInt("score");
                    playerTotals.merge(uid, score, Integer::sum);
                }
            }

            for (Map.Entry<Long, Integer> entry : playerTotals.entrySet()) {
                redisTemplate.opsForZSet().incrementScore(scoresKey, String.valueOf(entry.getKey()), entry.getValue());
            }
        } catch (Exception e) {
            log.warn("解析房间 {} all_record 失败", roomId, e);
        }

        ensureZeroScoreMembers(scoresKey, members);
        redisTemplate.expire(scoresKey, EXPIRE_HOURS, TimeUnit.HOURS);
    }

    private void ensureZeroScoreMembers(String scoresKey, List<RoomMember> members) {
        if (members == null || members.isEmpty()) {
            redisTemplate.opsForZSet().add(scoresKey, "init", 0);
            return;
        }
        for (RoomMember member : members) {
            redisTemplate.opsForZSet().addIfAbsent(scoresKey, String.valueOf(member.getUserId()), 0);
        }
    }

    private Map<Long, String> batchLoadUserJson(List<Long> userIds) {
        Map<Long, String> result = new HashMap<>();
        for (Long uid : userIds) {
            String json = loadUserJson(uid);
            if (json != null) {
                result.put(uid, json);
            }
        }
        return result;
    }

    private String loadUserJson(Long userId) {
        String key = "sr:user:" + userId;
        Object cached = redisTemplate.opsForHash().get(key, "info");
        if (cached != null) return (String) cached;

        var user = userMapper.selectById(userId);
        if (user == null) return null;

        String createdAtStr = user.getCreatedAt() != null
                ? user.getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                : "";
        String json = JSONUtil.toJsonStr(Map.of(
                "userId", user.getId(),
                "nickname", user.getNickname() != null ? user.getNickname() : "",
                "avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : "",
                "status", user.getStatus() != null ? user.getStatus() : 0,
                "createdAt", createdAtStr));
        redisTemplate.opsForHash().put(key, "info", json);
        return json;
    }
}
