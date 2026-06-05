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
                    // 恢复房间成员（仅未退出的）
                    List<RoomMember> members = roomMemberMapper.selectList(
                            new LambdaQueryWrapper<RoomMember>()
                                    .eq(RoomMember::getRoomId, roomId)
                                    .isNull(RoomMember::getQuitTime));

                    String metaKey = "sr:room:" + roomId + ":meta";

                    // 写入房间信息字段
                    redisTemplate.opsForHash().put(metaKey, "ownerId", String.valueOf(room.getOwnerId()));
                    redisTemplate.opsForHash().put(metaKey, "status", "0");

                    if (!members.isEmpty()) {
                        List<Long> userIds = members.stream()
                                .map(RoomMember::getUserId).collect(Collectors.toList());
                        Map<Long, String> userJsonMap = batchLoadUserJson(userIds);

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
                            redisTemplate.opsForHash().put(metaKey, "m:" + m.getUserId(), memberJson);

                            redisTemplate.opsForSet().add("sr:user:rooms:" + m.getUserId(), String.valueOf(roomId));
                            redisTemplate.expire("sr:user:rooms:" + m.getUserId(), EXPIRE_HOURS, TimeUnit.HOURS);
                        }
                    }
                    redisTemplate.expire(metaKey, EXPIRE_HOURS, TimeUnit.HOURS);

                    // 恢复房间号映射
                    redisTemplate.opsForValue().set("sr:room_no:" + room.getRoomNo(),
                            String.valueOf(roomId), EXPIRE_HOURS, TimeUnit.HOURS);

                    // 恢复排行榜（从 room.all_record JSON 读取）
                    warmupRoomScores(roomId);

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

    private void warmupRoomScores(Long roomId) {
        String scoresKey = "sr:room:" + roomId + ":scores";
        redisTemplate.delete(scoresKey);

        // 从 room.all_record JSON 读取已归档的得分数据
        String allRecordJson = roomMapper.selectAllRecordById(roomId);
        if (allRecordJson == null || allRecordJson.isBlank() || "null".equals(allRecordJson)) {
            redisTemplate.opsForZSet().add(scoresKey, "init", 0);
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

        redisTemplate.opsForZSet().add(scoresKey, "init", 0);
        redisTemplate.expire(scoresKey, EXPIRE_HOURS, TimeUnit.HOURS);
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
        String json = redisTemplate.opsForValue().get(key);
        if (json != null) return json;

        var user = userMapper.selectById(userId);
        if (user == null) return null;

        json = JSONUtil.toJsonStr(Map.of(
                "userId", user.getId(),
                "nickname", user.getNickname() != null ? user.getNickname() : "",
                "avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : ""));
        redisTemplate.opsForValue().set(key, json, EXPIRE_HOURS, TimeUnit.HOURS);
        return json;
    }
}
