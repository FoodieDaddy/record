package com.smartrecord.task;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.ScoreMapper;
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
    private final ScoreMapper scoreMapper;
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

                    if (!members.isEmpty()) {
                        List<Long> userIds = members.stream()
                                .map(RoomMember::getUserId).collect(Collectors.toList());
                        Map<Long, String> userJsonMap = batchLoadUserJson(userIds);

                        String membersKey = "sr:room:" + roomId + ":members";
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
                                    "avatarUrl", avatarUrl,
                                    "seatNo", m.getSeatNo()));
                            redisTemplate.opsForHash().put(membersKey, String.valueOf(m.getUserId()), memberJson);

                            redisTemplate.opsForSet().add("sr:user:rooms:" + m.getUserId(), String.valueOf(roomId));
                            redisTemplate.expire("sr:user:rooms:" + m.getUserId(), EXPIRE_HOURS, TimeUnit.HOURS);
                        }
                        redisTemplate.expire(membersKey, EXPIRE_HOURS, TimeUnit.HOURS);
                    }

                    // 恢复房间号映射
                    redisTemplate.opsForValue().set("sr:room_no:" + room.getRoomNo(),
                            String.valueOf(roomId), EXPIRE_HOURS, TimeUnit.HOURS);

                    // 恢复房间信息缓存
                    Map<String, String> info = new HashMap<>();
                    info.put("ownerId", String.valueOf(room.getOwnerId()));
                    info.put("status", "0");
                    info.put("layoutType", "circle");
                    redisTemplate.opsForHash().putAll("sr:room:" + roomId + ":info", info);
                    redisTemplate.expire("sr:room:" + roomId + ":info", EXPIRE_HOURS, TimeUnit.HOURS);

                    // 恢复排行榜（从 score 表聚合）
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

        List<Map<String, Object>> rows = scoreMapper.selectAggregatedScores(roomId);
        if (rows == null || rows.isEmpty()) {
            redisTemplate.opsForZSet().add(scoresKey, "init", 0);
            redisTemplate.expire(scoresKey, EXPIRE_HOURS, TimeUnit.HOURS);
            return;
        }

        for (Map<String, Object> row : rows) {
            Long userId = ((Number) row.get("user_id")).longValue();
            Integer total = ((Number) row.get("total")).intValue();
            redisTemplate.opsForZSet().incrementScore(scoresKey, String.valueOf(userId), total);
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
