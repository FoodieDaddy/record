package com.smartrecord.service.impl;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.common.ErrorCode;
import com.smartrecord.config.OssConfig;
import com.smartrecord.dto.room.*;
import com.smartrecord.enums.ScoreMode;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.entity.User;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.UserMapper;
import com.smartrecord.service.AsyncTaskService;
import com.smartrecord.service.RoomService;
import com.smartrecord.service.impl.ws.ScoreWebSocket;
import org.springframework.context.ApplicationEventPublisher;
import com.smartrecord.event.RoomClosedEvent;
import com.alicp.jetcache.Cache;
import com.alicp.jetcache.anno.CreateCache;
import com.alicp.jetcache.anno.CacheType;
import com.smartrecord.util.SnowflakeIdGenerator;
import com.smartrecord.entity.UserAchievement;
import com.smartrecord.entity.Achievement;
import com.smartrecord.mapper.UserAchievementMapper;
import com.smartrecord.mapper.AchievementMapper;
import com.smartrecord.service.MirrorProfileService;
import com.smartrecord.service.MirrorStatsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class RoomServiceImpl implements RoomService {

    private final RoomMapper roomMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final UserMapper userMapper;
    private final com.smartrecord.mapper.RoundRecordMapper roundRecordMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final StringRedisTemplate redisTemplate;
    private final OssConfig ossConfig;
    private final ScoreWebSocket scoreWebSocket;
    private final AsyncTaskService asyncTaskService;
    private final ApplicationEventPublisher eventPublisher;
    private final UserAchievementMapper userAchievementMapper;
    private final AchievementMapper achievementMapper;
    private final MirrorProfileService mirrorProfileService;
    private final MirrorStatsService mirrorStatsService;
    private final RedissonClient redissonClient;
    private final org.springframework.transaction.support.TransactionTemplate transactionTemplate;

    @SuppressWarnings("deprecation")
    @CreateCache(name = "achievement:id:", cacheType = CacheType.BOTH, expire = 3600)
    private Cache<Long, Achievement> achievementCache;
    @Qualifier("asyncExecutor")
    private final Executor asyncExecutor;

    private static final String ROOM_NO_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int ROOM_NO_LEN = 6;
    private static final int ROOM_EXPIRE_HOURS = 24;

    private String dataKey(Long roomId) { return "sr:room:" + roomId + ":data"; }

    @Override
    @Transactional
    public RoomResp createRoom(Long userId, CreateRoomReq req) {
        // 检查是否已有活跃房间
        Room existing = roomMapper.selectOne(
                new LambdaQueryWrapper<Room>()
                        .eq(Room::getOwnerId, userId)
                        .eq(Room::getStatus, 0)
                        .last("LIMIT 1"));
        if (existing != null) {
            throw new BizException(ErrorCode.ALREADY_HAS_ACTIVE_ROOM);
        }

        // 1. 生成唯一房间号
        String roomNo = generateUniqueRoomNo();

        // 2. 创建房间
        Room room = new Room();
        room.setId(idGenerator.nextId());
        room.setRoomNo(roomNo);
        room.setOwnerId(userId);
        room.setScoreMode(req.getScoreMode() != null ? req.getScoreMode() : 1);
        if (ScoreMode.ROUND_RECORD.getCode() == room.getScoreMode()) {
            room.setRoundInputMethod(req.getRoundInputMethod() != null ? req.getRoundInputMethod() : 1);
            room.setTrustMode(req.getTrustMode() != null ? req.getTrustMode() : 1);
            room.setZeroSumRequired(req.getZeroSumRequired() != null ? req.getZeroSumRequired() : 1);
        }
        room.setStatus(0);
        roomMapper.insert(room);

        // 3. 房主自动加入
        RoomMember member = new RoomMember();
        member.setId(idGenerator.nextId());
        member.setRoomId(room.getId());
        member.setUserId(userId);
        roomMemberMapper.insert(member);

        // 4. Redis 初始化房间状态
        initRoomRedis(room, userId, req);

        // 5. 异步生成专属小程序码
        generateQrCodeAsync(room.getId(), roomNo);

        return buildRoomResp(room, Collections.singletonList(member), null);
    }

    @Override
    public RoomResp joinRoom(Long userId, JoinRoomReq req) {
        String roomNo = req.getRoomNo() != null ? req.getRoomNo() : req.getScanRoomNo();
        if (roomNo == null || roomNo.isBlank()) {
            throw new BizException(ErrorCode.INPUT_CODE_REQUIRED);
        }

        // 1. 从 Redis 查找房间 ID
        String roomIdStr = redisTemplate.opsForValue().get("sr:room_no:" + roomNo.toUpperCase());
        Long roomId;
        if (roomIdStr != null) {
            roomId = Long.parseLong(roomIdStr);
        } else {
            // 降级查数据库
            Room room = roomMapper.selectOne(
                    new LambdaQueryWrapper<Room>().eq(Room::getRoomNo, roomNo.toUpperCase()));
            if (room == null) throw new BizException(ErrorCode.ROOM_NOT_FOUND);
            roomId = room.getId();
        }

        Long rid = roomId;
        RLock lock = redissonClient.getLock("lock:room:" + rid);
        try {
            if (!lock.tryLock(5, 5, TimeUnit.SECONDS)) {
                throw new BizException(ErrorCode.SYSTEM_BUSY);
            }
            return transactionTemplate.execute(status -> {
                // 2. 检查是否为活跃成员（先查 active Hash，再兼容旧 meta）
                if (isActiveMemberWithFallback(rid, userId)) {
                    throw new BizException(ErrorCode.ROOM_ALREADY_JOINED);
                }

                // 3. 检查房间状态
                Room room = roomMapper.selectById(rid);
                if (room == null || room.getStatus() != 0) {
                    throw new BizException(ErrorCode.ROOM_CLOSED);
                }

                // 4. 检查房间人数上限。如果超过 16 人上限，尝试寻找“WebSocket 掉线且积分为 0”的僵尸成员进行强制腾退
                Long memberCount = countActiveMembers(rid);
                if (memberCount >= 16) {
                    // 获取当前房间在 WebSocket 中的在线用户 ID 集合
                    Set<Long> onlineUserIds = scoreWebSocket.getOnlineUserIds(String.valueOf(rid));
                    // 读取当前房间的所有活跃成员快照
                    Map<Long, JSONObject> activeMembersMap = readActiveMembers(rid);
                    String scoresKey = "sr:room:" + rid + ":scores";
                    
                    Long victimUserId = null;
                    for (Long activeUid : activeMembersMap.keySet()) {
                        // 如果该成员当前不在线（不在 WebSocket 在线列表中）
                        if (!onlineUserIds.contains(activeUid)) {
                            // 查询该离线成员的当前积分
                            Double score = redisTemplate.opsForZSet().score(scoresKey, String.valueOf(activeUid));
                            // 必须满足积分未变动（为 0 分）且非房主本人，才被判定为可清退的僵尸用户
                            if ((score == null || score.intValue() == 0) && !room.getOwnerId().equals(activeUid)) {
                                victimUserId = activeUid;
                                break; // 找到一个离线零分用户即可
                            }
                        }
                    }
                    
                    if (victimUserId != null) {
                        // 执行强制自动腾退以挪出空位
                        log.info("房间 {} 达到 16 人上限，自动清退离线零分僵尸用户: userId={}", rid, victimUserId);
                        removeActiveMember(rid, victimUserId);
                        redisTemplate.opsForSet().remove("sr:user:rooms:" + victimUserId, String.valueOf(rid));
                        // 异步广播该成员离席事件，通知同编队其他成员
                        asyncPushMemberLeave(rid, victimUserId);
                    } else {
                        // 实在无法腾退（所有成员均在线，或者离线成员都有大局积分产生），抛出满员异常
                        throw new BizException(ErrorCode.ROOM_FULL);
                    }
                }

                // 5. 加载用户信息并检查重名
                Object cached = redisTemplate.opsForHash().get("sr:user:" + userId, "info");
                String nickname;
                String avatarUrl;
                if (cached != null) {
                    JSONObject userObj = JSONUtil.parseObj((String) cached);
                    nickname = userObj.getStr("nickname");
                    avatarUrl = userObj.getStr("avatarUrl");
                } else {
                    User user = userMapper.selectById(userId);
                    if (user == null) throw new BizException(ErrorCode.USER_NOT_FOUND);
                    nickname = user.getNickname();
                    avatarUrl = user.getAvatarUrl();
                }

                // 重名检查：遍历活跃成员，碰撞则拦截（排除自身，防止重新接入时与自己发生冲突）
                Map<Long, JSONObject> activeMembers = readActiveMembers(rid);
                for (Map.Entry<Long, JSONObject> entry : activeMembers.entrySet()) {
                    if (entry.getKey().equals(userId)) {
                        continue;
                    }
                    JSONObject memberObj = entry.getValue();
                    if (nickname.equals(memberObj.getStr("nickname"))) {
                        throw new BizException(ErrorCode.ROOM_MEMBER_NAME_DUPLICATE);
                    }
                }

                // 6. 加入房间（支持重新接入：已有记录则清空 quitTime 和 finalScore）
                RoomMember existingRecord = roomMemberMapper.selectOne(
                        new LambdaQueryWrapper<RoomMember>()
                                .eq(RoomMember::getRoomId, rid)
                                .eq(RoomMember::getUserId, userId));
                RoomMember member;
                if (existingRecord != null) {
                    // 重新接入：清空 quitTime 和 finalScore
                    existingRecord.setQuitTime(null);
                    existingRecord.setFinalScore(null);
                    roomMemberMapper.updateById(existingRecord);
                    member = existingRecord;
                } else {
                    // 新成员
                    member = new RoomMember();
                    member.setId(idGenerator.nextId());
                    member.setRoomId(rid);
                    member.setUserId(userId);
                    roomMemberMapper.insert(member);
                }

                // 7. 更新 Redis 房间成员缓存
                upsertActiveMember(rid, userId, nickname, avatarUrl);
                upsertArchiveMember(rid, userId, nickname, avatarUrl);
                redisTemplate.opsForSet().add("sr:user:rooms:" + userId, String.valueOf(rid));

                // 初始化新成员排行榜 0 分（确保 0 分成员也能出现在排行榜）
                String scoresKey = "sr:room:" + rid + ":scores";
                if (redisTemplate.opsForZSet().score(scoresKey, String.valueOf(userId)) == null) {
                    redisTemplate.opsForZSet().add(scoresKey, String.valueOf(userId), 0);
                }

                // 8. 异步 WebSocket 广播 MEMBER_JOIN（通知房间内已有成员）
                asyncPushMemberJoin(rid, userId, nickname, avatarUrl);

                // 5. 异步生成专属小程序码
                generateQrCodeAsync(room.getId(), roomNo);

                return buildRoomResp(room, Collections.singletonList(member), null);
            });
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException(ErrorCode.SYSTEM_BUSY);
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    @Override
    public RoomResp getRoomDetail(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException(ErrorCode.ROOM_NOT_FOUND);

        List<RoomMember> members;
        if (room.getStatus() == 0) {
            // 进行中：从 active 成员组读取
            Map<Long, JSONObject> activeMap = readActiveMembers(roomId);
            members = new ArrayList<>();
            for (JSONObject obj : activeMap.values()) {
                RoomMember m = new RoomMember();
                m.setRoomId(roomId);
                m.setUserId(obj.getLong("userId"));
                members.add(m);
            }
            if (members.isEmpty()) {
                // 兜底：查 DB 中未退出的成员
                members = roomMemberMapper.selectList(
                        new LambdaQueryWrapper<RoomMember>()
                                .eq(RoomMember::getRoomId, roomId)
                                .isNull(RoomMember::getQuitTime));
            }
        } else {
            // 已封存：从 DB 读取已写入 final_score/quit_time 的成员
            members = roomMemberMapper.selectList(
                    new LambdaQueryWrapper<RoomMember>()
                            .eq(RoomMember::getRoomId, roomId)
                            .isNotNull(RoomMember::getQuitTime));
        }

        // 构建二维码 URL（OSS 中的固定路径）
        String qrCodeUrl = getQrCodeUrlFromRedis(room.getId());
        return buildRoomResp(room, members, qrCodeUrl);
    }

    @Override
    public List<RoomResp> getMyRooms(Long userId) {
        // 只从 Redis 获取用户当前活跃空间
        Set<String> roomIds = redisTemplate.opsForSet().members("sr:user:rooms:" + userId);
        if (roomIds == null || roomIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<RoomResp> result = new ArrayList<>();
        for (String rid : roomIds) {
            try {
                Room room = roomMapper.selectById(Long.parseLong(rid));
                if (room == null || room.getStatus() != 0) {
                    // 已封存或不存在的空间，清理残留映射
                    redisTemplate.opsForSet().remove("sr:user:rooms:" + userId, rid);
                    continue;
                }
                // 验证用户确实在 active 成员中
                if (!isActiveMemberWithFallback(room.getId(), userId)) {
                    redisTemplate.opsForSet().remove("sr:user:rooms:" + userId, rid);
                    continue;
                }
                RoomResp resp = getRoomDetail(room.getId());
                result.add(resp);
            } catch (Exception e) {
                log.warn("获取房间详情失败: roomId={}", rid, e);
            }
        }
        return result;
    }

    @Override
    public void quitRoom(Long userId, Long roomId) {
        RLock lock = redissonClient.getLock("lock:room:" + roomId);
        try {
            if (!lock.tryLock(5, 5, TimeUnit.SECONDS)) {
                throw new BizException(ErrorCode.SYSTEM_BUSY);
            }
            transactionTemplate.executeWithoutResult(status -> {
                Room room = roomMapper.selectById(roomId);
                if (room == null) throw new BizException(ErrorCode.ROOM_NOT_FOUND);

                // 已结束的房间：保留 room_member 历史记录（final_score/quit_time），不删除
                // doSettleRoom 已清理 Redis 映射，此处仅确保幂等
                if (room.getStatus() != 0) {
                    redisTemplate.opsForSet().remove("sr:user:rooms:" + userId, String.valueOf(roomId));
                    return;
                }

                if (room.getOwnerId().equals(userId)) {
                    // 房主退出 = 解散房间
                    dissolveRoom(userId, roomId);
                    return;
                }

                // 普通成员退出：不删除 room_member 记录，quitTime 作为离席标记，封存时会统一覆盖为封存时间
                roomMemberMapper.update(null,
                        new LambdaUpdateWrapper<RoomMember>()
                                .eq(RoomMember::getRoomId, roomId)
                                .eq(RoomMember::getUserId, userId)
                                .set(RoomMember::getQuitTime, java.time.LocalDateTime.now()));
                // 从 active 成员组移除，保留 archive 快照和 scores
                removeActiveMember(roomId, userId);
                redisTemplate.opsForSet().remove("sr:user:rooms:" + userId, String.valueOf(roomId));

                // 广播成员离开
                asyncPushMemberLeave(roomId, userId);
            });
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException(ErrorCode.SYSTEM_BUSY);
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    @Override
    public void dissolveRoom(Long userId, Long roomId) {
        RLock lock = redissonClient.getLock("lock:room:" + roomId);
        try {
            if (!lock.tryLock(5, 5, TimeUnit.SECONDS)) {
                throw new BizException(ErrorCode.SYSTEM_BUSY);
            }
            transactionTemplate.executeWithoutResult(status -> {
                Room room = roomMapper.selectById(roomId);
                if (room == null) throw new BizException(ErrorCode.ROOM_NOT_FOUND);
                if (!room.getOwnerId().equals(userId)) {
                    throw new BizException(ErrorCode.NOT_OWNER_DISSOLVE);
                }

                // 标记归档（使用显式 Wrapper 确保 status 字段写入）
                room.setStatus(1);
                roomMapper.update(null, new LambdaUpdateWrapper<Room>()
                        .eq(Room::getId, roomId)
                        .set(Room::getStatus, 1));

                // 解散房间时，将该房间下所有处于“录入中”或“待确认”状态 of 本局录记录更新为“已取消”，防止数据库状态失真。因 RoundRecord 实体不包含 updatedAt 字段，故不单独进行设置
                roundRecordMapper.update(null, new LambdaUpdateWrapper<com.smartrecord.entity.RoundRecord>()
                        .eq(com.smartrecord.entity.RoundRecord::getRoomId, roomId)
                        .in(com.smartrecord.entity.RoundRecord::getStatus, List.of(1, 2)) // 1-等待成员填写, 2-等待全员确认
                        .set(com.smartrecord.entity.RoundRecord::getStatus, 5)); // 5-已取消

                // 获取所有成员并清理 Redis
                List<RoomMember> members = roomMemberMapper.selectList(
                        new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
                for (RoomMember m : members) {
                    redisTemplate.opsForSet().remove("sr:user:rooms:" + m.getUserId(), String.valueOf(roomId));
                }

                // 更新成员记录：设置离开时间和最终分数
                roomMemberMapper.update(null, new LambdaUpdateWrapper<RoomMember>()
                        .eq(RoomMember::getRoomId, roomId)
                        .isNull(RoomMember::getQuitTime)
                        .set(RoomMember::getQuitTime, java.time.LocalDateTime.now())
                        .set(RoomMember::getFinalScore, 0));

                // 广播房间解散消息
                try {
                    Map<String, Object> pushData = new HashMap<>();
                    pushData.put("type", "ROOM_DISBANDED");
                    pushData.put("roomId", String.valueOf(roomId));
                    scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
                } catch (Exception e) {
                    log.error("推送房间解散消息失败: roomId={}", roomId, e);
                }

                // 清理房间 Redis key
                String prefix = "sr:room:" + roomId + ":";

                List<String> keysToDelete = new ArrayList<>(List.of(
                        dataKey(roomId),
                        prefix + "scores",
                        prefix + "events",
                        prefix + "round:data",
                        prefix + "transfer:amount"));
                redisTemplate.delete(keysToDelete);

                redisTemplate.delete("sr:room_no:" + room.getRoomNo());

                // 发布房间关闭（解散）事件，异步清理二维码资源
                eventPublisher.publishEvent(new RoomClosedEvent(this, room.getRoomNo()));
            });
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException(ErrorCode.SYSTEM_BUSY);
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    @Override
    public List<RoomResp> getHistory(Long userId) {
        // 查询用户参与过的已结算房间
        List<RoomMember> memberships = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getUserId, userId)
                        .isNotNull(RoomMember::getQuitTime));
        if (memberships.isEmpty()) return Collections.emptyList();

        List<Long> roomIds = memberships.stream()
                .map(RoomMember::getRoomId)
                .distinct()
                .collect(Collectors.toList());

        List<Room> rooms = roomMapper.selectList(
                new LambdaQueryWrapper<Room>()
                        .in(Room::getId, roomIds)
                        .eq(Room::getStatus, 1)
                        .orderByDesc(Room::getCreatedAt));
        if (rooms.isEmpty()) return Collections.emptyList();

        // 批量加载所有房间的成员（含 finalScore）
        List<RoomMember> allMembers = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>()
                        .in(RoomMember::getRoomId, roomIds)
                        .isNotNull(RoomMember::getQuitTime));
        Map<Long, List<RoomMember>> membersByRoom = allMembers.stream()
                .collect(Collectors.groupingBy(RoomMember::getRoomId));

        // 批量加载用户信息（Redis 优先，DB 兜底）
        Set<Long> allUserIds = allMembers.stream()
                .map(RoomMember::getUserId).collect(Collectors.toSet());
        Map<Long, String> nicknameMap = new HashMap<>();
        Map<Long, String> avatarUrlMap = new HashMap<>();
        for (Long uid : allUserIds) {
            Object cached = redisTemplate.opsForHash().get("sr:user:" + uid, "info");
            if (cached != null) {
                JSONObject userObj = JSONUtil.parseObj((String) cached);
                nicknameMap.put(uid, userObj.getStr("nickname", ""));
                avatarUrlMap.put(uid, buildFullUrl(userObj.getStr("avatarUrl", "")));
            } else {
                User u = userMapper.selectById(uid);
                nicknameMap.put(uid, u != null ? u.getNickname() : "");
                avatarUrlMap.put(uid, u != null ? buildFullUrl(u.getAvatarUrl()) : "");
            }
        }

        return rooms.stream().map(room -> {
            List<RoomMember> roomMembers = membersByRoom.getOrDefault(room.getId(), Collections.emptyList());
            List<RoomResp.MemberVO> memberVOs = roomMembers.stream()
                    .map(m -> RoomResp.MemberVO.builder()
                            .userId(m.getUserId())
                            .nickname(nicknameMap.getOrDefault(m.getUserId(), ""))
                            .avatarUrl(avatarUrlMap.getOrDefault(m.getUserId(), ""))
                            .finalScore(m.getFinalScore())
                            .build())
                    .collect(Collectors.toList());

            return RoomResp.builder()
                    .roomId(room.getId())
                    .roomNo(room.getRoomNo())
                    .ownerId(room.getOwnerId())
                    .scoreMode(room.getScoreMode())
                    .roundInputMethod(room.getRoundInputMethod())
                    .trustMode(room.getTrustMode())
                    .zeroSumRequired(room.getZeroSumRequired())
                    .status(room.getStatus())
                    .members(memberVOs)
                    .createdAt(room.getCreatedAt())
                    .build();
        }).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void updateSettings(Long userId, Long roomId, UpdateSettingsReq req) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException(ErrorCode.ROOM_NOT_FOUND);
        if (room.getStatus() != 0) throw new BizException(ErrorCode.SETTINGS_ARCHIVED);
        if (!room.getOwnerId().equals(userId)) throw new BizException(ErrorCode.NOT_OWNER_UPDATE_SETTINGS);

        // 检查是否有待处理录
        if (redisTemplate.opsForHash().hasKey(dataKey(roomId), "round:id")) {
            throw new BizException(ErrorCode.SETTINGS_HAS_PENDING_ROUND);
        }

        // 更新 MySQL
        boolean changed = false;
        if (req.getRoundInputMethod() != null) {
            room.setRoundInputMethod(req.getRoundInputMethod());
            changed = true;
        }
        if (req.getTrustMode() != null) {
            room.setTrustMode(req.getTrustMode());
            changed = true;
        }
        if (req.getZeroSumRequired() != null) {
            room.setZeroSumRequired(req.getZeroSumRequired());
            changed = true;
        }
        if (changed) {
            roomMapper.updateById(room);
        }

        // 更新 Redis 轮次配置（超时设置仅信任关闭时可修改）
        Map<String, String> configUpdates = new HashMap<>();
        int trustMode = room.getTrustMode() != null ? room.getTrustMode() : 1;
        if (trustMode == 0) {
            if (req.getAutoTimeoutSeconds() != null) {
                configUpdates.put("roundConfig:autoTimeoutSeconds", String.valueOf(req.getAutoTimeoutSeconds()));
            }
            if (req.getAutoTimeoutAction() != null) {
                configUpdates.put("roundConfig:autoTimeoutAction", String.valueOf(req.getAutoTimeoutAction()));
            }
        }
        if (!configUpdates.isEmpty()) {
            redisTemplate.opsForHash().putAll(dataKey(roomId), configUpdates);
        }

        // 广播 SETTINGS_CHANGED
        Map<String, Object> pushData = new HashMap<>();
        pushData.put("type", "SETTINGS_CHANGED");
        pushData.put("roomId", roomId);
        pushData.put("roundInputMethod", room.getRoundInputMethod());
        pushData.put("trustMode", room.getTrustMode());
        pushData.put("zeroSumRequired", room.getZeroSumRequired());
        if (trustMode == 0) {
            String seconds = (String) redisTemplate.opsForHash().get(dataKey(roomId), "roundConfig:autoTimeoutSeconds");
            String action = (String) redisTemplate.opsForHash().get(dataKey(roomId), "roundConfig:autoTimeoutAction");
            pushData.put("autoTimeoutSeconds", seconds != null ? Integer.parseInt(seconds) : 30);
            pushData.put("autoTimeoutAction", action != null ? Integer.parseInt(action) : 1);
        }
        scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
    }

    // ===== 成员辅助方法（合入 data Hash，a: = active，r: = archive） =====

    private static final String ACTIVE_PREFIX = "a:";
    private static final String ARCHIVE_PREFIX = "r:";

    private Map<Long, JSONObject> readActiveMembers(Long roomId) {
        Map<Object, Object> entries = redisTemplate.opsForHash().entries(dataKey(roomId));
        Map<Long, JSONObject> result = new HashMap<>();
        if (entries != null) {
            for (Map.Entry<Object, Object> entry : entries.entrySet()) {
                String field = (String) entry.getKey();
                if (!field.startsWith(ACTIVE_PREFIX)) continue;
                Long userId = Long.parseLong(field.substring(ACTIVE_PREFIX.length()));
                JSONObject obj = JSONUtil.parseObj((String) entry.getValue());
                result.put(userId, obj);
            }
        }
        return result;
    }

    private JSONObject getUserDisplayAndPersonaData(Long userId) {
        String nickname = "";
        String avatarUrl = "";
        String equippedBadge = "";
        String equippedAvatarBorder = "";
        String mbtiTitle = "";
        Integer mbtiCode = null;
        Map<String, Object> radarStats = new HashMap<>();

        // 1. 尝试从个人缓存中读取基本信息和装扮
        Object cachedInfo = redisTemplate.opsForHash().get("sr:user:" + userId, "info");
        if (cachedInfo != null) {
            JSONObject userObj = JSONUtil.parseObj((String) cachedInfo);
            nickname = userObj.getStr("nickname", "");
            avatarUrl = userObj.getStr("avatarUrl", "");
            equippedBadge = userObj.getStr("equippedBadge", "");
            equippedAvatarBorder = userObj.getStr("equippedAvatarBorder", "");
        } else {
            // 缓存未命中，查库
            User u = userMapper.selectById(userId);
            if (u != null) {
                nickname = u.getNickname();
                avatarUrl = u.getAvatarUrl();
                List<UserAchievement> userAchievements = userAchievementMapper.selectList(
                        new LambdaQueryWrapper<UserAchievement>()
                                .eq(UserAchievement::getUserId, userId)
                                .eq(UserAchievement::getStatus, 1)
                );
                for (UserAchievement ua : userAchievements) {
                    Achievement achievement = achievementCache.computeIfAbsent(ua.getAchievementId(), id -> achievementMapper.selectById(id));
                    if (achievement != null && achievement.getCosmeticPayload() != null) {
                        try {
                            JSONObject payload = JSONUtil.parseObj(achievement.getCosmeticPayload());
                            if (achievement.getCosmeticType() == 1) {
                                equippedBadge = payload.getStr("badge", "");
                            } else if (achievement.getCosmeticType() == 2) {
                                equippedAvatarBorder = payload.getStr("avatarBorder", "");
                            }
                        } catch (Exception e) {
                            log.error("解析用户成就装扮参数失败: achievementId={}", achievement.getId(), e);
                        }
                    }
                }
                // 顺便回写缓存
                String createdAtStr = u.getCreatedAt() != null
                        ? u.getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                        : "";
                String userJson = JSONUtil.toJsonStr(Map.of(
                        "userId", userId,
                        "nickname", nickname != null ? nickname : "",
                        "avatarUrl", avatarUrl != null ? avatarUrl : "",
                        "status", u.getStatus() != null ? u.getStatus() : 0,
                        "createdAt", createdAtStr,
                        "equippedBadge", equippedBadge,
                        "equippedAvatarBorder", equippedAvatarBorder
                ));
                redisTemplate.opsForHash().put("sr:user:" + userId, "info", userJson);
            }
        }

        // 2. 获取 MBTI 称号和编码
        try {
            var profile = mirrorProfileService.getFullProfile(userId);
            if (profile != null) {
                if (profile.getBattlePersona() != null) {
                    mbtiTitle = profile.getBattlePersona().getTitle();
                }
                if (profile.getMbti() != null) {
                    mbtiCode = profile.getMbti().getMbtiCode();
                }
            }
        } catch (Exception e) {
            log.warn("缓存拼装获取用户画像失败: userId={}", userId, e);
        }

        // 3. 获取雷达五维数据
        try {
            var stats = mirrorStatsService.calculate(userId);
            if (stats != null && stats.getDimensions() != null) {
                for (var d : stats.getDimensions()) {
                    radarStats.put(d.getKey(), d.getValue());
                }
            }
        } catch (Exception e) {
            log.warn("缓存拼装获取用户战绩统计失败: userId={}", userId, e);
        }

        return JSONUtil.createObj()
                .set("userId", userId)
                .set("nickname", nickname != null ? nickname : "")
                .set("avatarUrl", avatarUrl != null ? avatarUrl : "")
                .set("equippedBadge", equippedBadge)
                .set("equippedAvatarBorder", equippedAvatarBorder)
                .set("mbtiTitle", mbtiTitle)
                .set("mbtiCode", mbtiCode)
                .set("radarStats", radarStats);
    }

    private void upsertActiveMember(Long roomId, Long userId, String nickname, String avatarUrl) {
        JSONObject obj = getUserDisplayAndPersonaData(userId);
        if (nickname != null && !nickname.isEmpty()) {
            obj.set("nickname", nickname);
        }
        if (avatarUrl != null && !avatarUrl.isEmpty()) {
            obj.set("avatarUrl", avatarUrl);
        }
        redisTemplate.opsForHash().put(dataKey(roomId), ACTIVE_PREFIX + userId, obj.toString());
    }

    private void upsertArchiveMember(Long roomId, Long userId, String nickname, String avatarUrl) {
        long now = System.currentTimeMillis();
        String field = ARCHIVE_PREFIX + userId;
        Object existing = redisTemplate.opsForHash().get(dataKey(roomId), field);
        JSONObject obj;
        if (existing != null) {
            obj = JSONUtil.parseObj((String) existing);
            obj.set("nickname", nickname);
            obj.set("avatarUrl", avatarUrl != null ? avatarUrl : "");
            obj.set("lastSeenAt", now);
        } else {
            obj = JSONUtil.createObj()
                    .set("userId", userId)
                    .set("nickname", nickname)
                    .set("avatarUrl", avatarUrl != null ? avatarUrl : "")
                    .set("firstJoinedAt", now)
                    .set("lastSeenAt", now);
        }
        redisTemplate.opsForHash().put(dataKey(roomId), field, obj.toString());
    }

    private void removeActiveMember(Long roomId, Long userId) {
        redisTemplate.opsForHash().delete(dataKey(roomId), ACTIVE_PREFIX + userId);
    }

    private boolean isActiveMember(Long roomId, Long userId) {
        return Boolean.TRUE.equals(
                redisTemplate.opsForHash().hasKey(dataKey(roomId), ACTIVE_PREFIX + userId));
    }

    /**
     * 统计活跃成员数（扫描 data Hash 中 a: 前缀字段）
     */
    private long countActiveMembers(Long roomId) {
        Map<Object, Object> entries = redisTemplate.opsForHash().entries(dataKey(roomId));
        long count = 0;
        for (Object field : entries.keySet()) {
            if (((String) field).startsWith(ACTIVE_PREFIX)) count++;
        }
        return count;
    }

    /**
     * 判断是否在 active 成员中
     */
    private boolean isActiveMemberWithFallback(Long roomId, Long userId) {
        return isActiveMember(roomId, userId);
    }

    // ===== 私有方法 =====

    private void asyncPushMemberJoin(Long roomId, Long userId, String nickname, String avatarUrl) {
        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> pushData = new HashMap<>();
                pushData.put("type", "MEMBER_JOIN");
                pushData.put("roomId", String.valueOf(roomId));
                pushData.put("userId", String.valueOf(userId));
                pushData.put("nickname", nickname);
                pushData.put("avatarUrl", avatarUrl != null ? avatarUrl : "");
                scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
            } catch (Exception e) {
                log.warn("推送 MEMBER_JOIN 失败: roomId={}, userId={}", roomId, userId, e);
            }
        }, asyncExecutor);
    }

    private void asyncPushMemberLeave(Long roomId, Long userId) {
        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> pushData = new HashMap<>();
                pushData.put("type", "MEMBER_LEAVE");
                pushData.put("roomId", String.valueOf(roomId));
                pushData.put("userId", String.valueOf(userId));
                scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
            } catch (Exception e) {
                log.warn("推送 MEMBER_LEAVE 失败: roomId={}, userId={}", roomId, userId, e);
            }
        }, asyncExecutor);
    }

    private String generateUniqueRoomNo() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder(ROOM_NO_LEN);
            for (int i = 0; i < ROOM_NO_LEN; i++) {
                sb.append(ROOM_NO_CHARS.charAt(ThreadLocalRandom.current().nextInt(ROOM_NO_CHARS.length())));
            }
            String roomNo = sb.toString();
            String key = "sr:room_no:" + roomNo;
            Boolean ok = redisTemplate.opsForValue().setIfAbsent(key, "pending", ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
            if (Boolean.TRUE.equals(ok)) {
                return roomNo;
            }
        }
        throw new BizException(ErrorCode.ROOM_NO_GENERATE_FAILED);
    }

    private void initRoomRedis(Room room, Long ownerId, CreateRoomReq req) {
        User owner = userMapper.selectById(ownerId);
        if (owner == null) throw new BizException(ErrorCode.USER_NOT_FOUND);
        Long rid = room.getId();

        // 房间配置写入 data（不含成员数据，成员统一在 members:active）
        Map<String, String> data = new HashMap<>();
        data.put("ownerId", String.valueOf(ownerId));
        data.put("status", "0");
        data.put("scoreMode", String.valueOf(room.getScoreMode() != null ? room.getScoreMode() : 1));
        data.put("roomNo", room.getRoomNo());

        // 本局录模式：初始化轮次配置
        if (ScoreMode.ROUND_RECORD.getCode() == room.getScoreMode() && req != null) {
            data.put("roundConfig:autoTimeoutSeconds", String.valueOf(req.getAutoTimeoutSeconds() != null ? req.getAutoTimeoutSeconds() : 30));
            data.put("roundConfig:autoTimeoutAction", String.valueOf(req.getAutoTimeoutAction() != null ? req.getAutoTimeoutAction() : 1));
        }

        redisTemplate.opsForHash().putAll(dataKey(rid), data);
        redisTemplate.expire(dataKey(rid), ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 写入 members:active 和 members:archive
        upsertActiveMember(room.getId(), ownerId, owner.getNickname(), owner.getAvatarUrl());
        upsertArchiveMember(room.getId(), ownerId, owner.getNickname(), owner.getAvatarUrl());

        // 初始化排行榜 ZSet，房主初始 0 分（确保 0 分成员也能出现在排行榜）
        String scoresKey = "sr:room:" + rid + ":scores";
        redisTemplate.opsForZSet().add(scoresKey, String.valueOf(ownerId), 0);
        redisTemplate.expire(scoresKey, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 用户房间映射
        redisTemplate.opsForSet().add("sr:user:rooms:" + ownerId, String.valueOf(rid));
        redisTemplate.expire("sr:user:rooms:" + ownerId, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 更新房间号映射的实际 roomId
        redisTemplate.opsForValue().set("sr:room_no:" + room.getRoomNo(), String.valueOf(rid), ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 缓存用户信息
        String ownerCreatedAt = owner.getCreatedAt() != null
                ? owner.getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                : "";
        String userJson = JSONUtil.toJsonStr(Map.of(
                "userId", ownerId,
                "nickname", owner.getNickname() != null ? owner.getNickname() : "",
                "avatarUrl", owner.getAvatarUrl() != null ? owner.getAvatarUrl() : "",
                "status", owner.getStatus() != null ? owner.getStatus() : 0,
                "createdAt", ownerCreatedAt));
        redisTemplate.opsForHash().put("sr:user:" + ownerId, "info", userJson);
    }

    private String getQrCodeUrlFromRedis(Long roomId) {
        Object val = redisTemplate.opsForHash().get(dataKey(roomId), "qr");
        return val != null ? (String) val : null;
    }

    private void generateQrCodeAsync(Long roomId, String roomNo) {
        try {
            JSONObject payload = JSONUtil.createObj().set("roomNo", roomNo).set("roomId", String.valueOf(roomId));
            asyncTaskService.createTask("QR_CODE_GENERATE", roomNo, payload.toString());
            log.info("已创建二维码生成任务: roomNo={}", roomNo);
        } catch (Exception e) {
            log.error("创建二维码生成任务失败: roomNo={}", roomNo, e);
        }
    }

    private RoomResp buildRoomResp(Room room, List<RoomMember> members, String qrCodeUrl) {
        Map<Long, JSONObject> activeMembers = readActiveMembers(room.getId());

        List<RoomResp.MemberVO> memberVOs = members.stream().map(m -> {
            Long uid = m.getUserId();
            JSONObject cached = activeMembers.get(uid);

            String nickname = "";
            String avatarUrl = "";
            String equippedBadge = "";
            String equippedAvatarBorder = "";
            String mbtiTitle = "";
            Integer mbtiCode = null;
            Map<String, Object> radarStats = null;

            if (cached != null) {
                nickname = cached.getStr("nickname", "");
                avatarUrl = buildFullUrl(cached.getStr("avatarUrl", ""));
                equippedBadge = cached.getStr("equippedBadge", "");
                equippedAvatarBorder = cached.getStr("equippedAvatarBorder", "");
                mbtiTitle = cached.getStr("mbtiTitle", "");
                mbtiCode = cached.getInt("mbtiCode");
                JSONObject radarJson = cached.getJSONObject("radarStats");
                if (radarJson != null) {
                    radarStats = new HashMap<>(radarJson);
                }
            } else {
                JSONObject freshObj = getUserDisplayAndPersonaData(uid);
                nickname = freshObj.getStr("nickname", "");
                avatarUrl = buildFullUrl(freshObj.getStr("avatarUrl", ""));
                equippedBadge = freshObj.getStr("equippedBadge", "");
                equippedAvatarBorder = freshObj.getStr("equippedAvatarBorder", "");
                mbtiTitle = freshObj.getStr("mbtiTitle", "");
                mbtiCode = freshObj.getInt("mbtiCode");
                JSONObject radarJson = freshObj.getJSONObject("radarStats");
                if (radarJson != null) {
                    radarStats = new HashMap<>(radarJson);
                }

                if (room.getStatus() == 0) {
                    redisTemplate.opsForHash().put(dataKey(room.getId()), ACTIVE_PREFIX + uid, freshObj.toString());
                }
            }

            return RoomResp.MemberVO.builder()
                    .userId(uid)
                    .nickname(nickname)
                    .avatarUrl(avatarUrl)
                    .equippedBadge(equippedBadge)
                    .equippedAvatarBorder(equippedAvatarBorder)
                    .mbtiTitle(mbtiTitle)
                    .mbtiCode(mbtiCode)
                    .radarStats(radarStats)
                    .build();
        }).collect(Collectors.toList());

        // 读取 roundConfig（仅本局录模式）
        Integer autoTimeoutSeconds = null;
        Integer autoTimeoutAction = null;
        if (ScoreMode.ROUND_RECORD.getCode() == (room.getScoreMode() != null ? room.getScoreMode() : 1)) {
            String seconds = (String) redisTemplate.opsForHash().get(dataKey(room.getId()), "roundConfig:autoTimeoutSeconds");
            String action = (String) redisTemplate.opsForHash().get(dataKey(room.getId()), "roundConfig:autoTimeoutAction");
            autoTimeoutSeconds = seconds != null ? Integer.parseInt(seconds) : 30;
            autoTimeoutAction = action != null ? Integer.parseInt(action) : 1;
        }

        return RoomResp.builder()
                .roomId(room.getId())
                .roomNo(room.getRoomNo())
                .ownerId(room.getOwnerId())
                .scoreMode(room.getScoreMode() != null ? room.getScoreMode() : 1)
                .roundInputMethod(room.getRoundInputMethod())
                .trustMode(room.getTrustMode())
                .zeroSumRequired(room.getZeroSumRequired())
                .autoTimeoutSeconds(autoTimeoutSeconds)
                .autoTimeoutAction(autoTimeoutAction)
                .status(room.getStatus())
                .qrCodeUrl(qrCodeUrl)
                .members(memberVOs)
                .createdAt(room.getCreatedAt())
                .build();
    }

    private String buildFullUrl(String objectKey) {
        if (objectKey == null || objectKey.isEmpty()) return "";
        if (objectKey.startsWith("cloud://")) return objectKey;
        if (objectKey.startsWith("http")) return objectKey;
        return "https://" + ossConfig.getBucketName() + "." + ossConfig.getEndpoint() + "/" + objectKey;
    }
}
