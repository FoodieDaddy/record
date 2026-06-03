package com.smartrecord.task;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.entity.Session;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.ScoreMapper;
import com.smartrecord.mapper.SessionMapper;
import com.smartrecord.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 宕机恢复：启动时自动将 MySQL 中未结算的活跃场次状态重建到 Redis
 * <p>
 * 恢复内容：
 * 1. 房间成员映射 (sr:room:{roomId}:members)
 * 2. 活跃场次指针 (sr:room:{roomId}:active_session)
 * 3. 场次排行榜 (sr:session:{sessionId}:scores)
 * 4. 房间号映射 (sr:room_no:{roomNo})
 * 5. 用户所在房间集合 (sr:user:rooms:{userId})
 * 6. 房间信息缓存 (sr:room:{roomId}:info)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CacheWarmUpRunner implements ApplicationRunner {

    private static final int EXPIRE_HOURS = 24;

    private final SessionMapper sessionMapper;
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
            // 1. 查询所有未结算的场次（status = 0）
            List<Session> activeSessions = sessionMapper.selectList(
                    new LambdaQueryWrapper<Session>().eq(Session::getStatus, 0));
            if (activeSessions.isEmpty()) {
                log.info("没有活跃场次，跳过缓存预热");
                return;
            }

            // 按 roomId 分组，每个房间取最新的一条
            Map<Long, Session> roomSessionMap = activeSessions.stream()
                    .collect(Collectors.toMap(
                            Session::getRoomId,
                            s -> s,
                            (a, b) -> a.getSessionNo() >= b.getSessionNo() ? a : b));

            int roomCount = 0;
            int sessionCount = 0;

            for (Map.Entry<Long, Session> entry : roomSessionMap.entrySet()) {
                Long roomId = entry.getKey();
                Session session = entry.getValue();

                try {
                    Room room = roomMapper.selectById(roomId);
                    if (room == null || room.getStatus() != 0) {
                        log.warn("房间 {} 已关闭或不存在，跳过", roomId);
                        continue;
                    }

                    // 恢复房间成员
                    List<RoomMember> members = roomMemberMapper.selectList(
                            new LambdaQueryWrapper<RoomMember>()
                                    .eq(RoomMember::getRoomId, roomId));

                    if (!members.isEmpty()) {
                        // 批量查询用户信息
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

                            // 用户所在房间集合
                            redisTemplate.opsForSet().add("sr:user:rooms:" + m.getUserId(), String.valueOf(roomId));
                            redisTemplate.expire("sr:user:rooms:" + m.getUserId(), EXPIRE_HOURS, TimeUnit.HOURS);
                        }
                        redisTemplate.expire(membersKey, EXPIRE_HOURS, TimeUnit.HOURS);
                    }

                    // 恢复房间号映射
                    redisTemplate.opsForValue().set("sr:room_no:" + room.getRoomNo(),
                            String.valueOf(roomId), EXPIRE_HOURS, TimeUnit.HOURS);

                    // 恢复房间信息缓存
                    String ownerJson = loadUserJson(room.getOwnerId());
                    String ownerNickname = "";
                    if (ownerJson != null) {
                        ownerNickname = JSONUtil.parseObj(ownerJson).getStr("nickname", "");
                    }
                    Map<String, String> info = new HashMap<>();
                    info.put("ownerId", String.valueOf(room.getOwnerId()));
                    info.put("baseScore", String.valueOf(room.getBaseScore()));
                    info.put("status", "0");
                    info.put("sessionCounter", String.valueOf(room.getRoundCount()));
                    info.put("layoutType", "circle");
                    redisTemplate.opsForHash().putAll("sr:room:" + roomId + ":info", info);
                    redisTemplate.expire("sr:room:" + roomId + ":info", EXPIRE_HOURS, TimeUnit.HOURS);

                    // 恢复活跃场次指针
                    redisTemplate.opsForValue().set(
                            "sr:room:" + roomId + ":active_session",
                            String.valueOf(session.getId()), EXPIRE_HOURS, TimeUnit.HOURS);

                    // 恢复场次排行榜（从 score 表聚合）
                    warmupSessionScores(session.getId());
                    sessionCount++;

                    roomCount++;
                } catch (Exception e) {
                    log.error("恢复房间 {} 缓存失败", roomId, e);
                }
            }

            log.info("<<< 缓存预热完成：{} 个房间，{} 个场次，耗时 {}ms",
                    roomCount, sessionCount, System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("缓存预热异常", e);
        }
    }

    /**
     * 从 score 表聚合该场次所有得分，重建 Redis 排行榜
     */
    private void warmupSessionScores(Long sessionId) {
        String scoresKey = "sr:session:" + sessionId + ":scores";

        // 如果 Redis 中已有数据（可能只是哨兵 init），先清理再重建
        redisTemplate.delete(scoresKey);

        // 从 MySQL score 表按 userId 聚合总分
        List<Map<String, Object>> rows = scoreMapper.selectAggregatedScores(sessionId);
        if (rows == null || rows.isEmpty()) {
            // 无历史得分，仅初始化哨兵
            redisTemplate.opsForZSet().add(scoresKey, "init", 0);
            redisTemplate.expire(scoresKey, EXPIRE_HOURS, TimeUnit.HOURS);
            return;
        }

        for (Map<String, Object> row : rows) {
            Long userId = ((Number) row.get("user_id")).longValue();
            Integer total = ((Number) row.get("total")).intValue();
            redisTemplate.opsForZSet().incrementScore(scoresKey, String.valueOf(userId), total);
        }
        // 哨兵值，用于区分"无人参与"和"所有人分数为 0"
        redisTemplate.opsForZSet().add(scoresKey, "init", 0);
        redisTemplate.expire(scoresKey, EXPIRE_HOURS, TimeUnit.HOURS);
    }

    /**
     * 批量加载用户 JSON 缓存，未命中则查数据库并回填
     */
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

        // 查数据库并回填
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
