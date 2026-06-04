package com.smartrecord.service.impl;

import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.config.OssConfig;
import com.smartrecord.dto.room.CreateRoomReq;
import com.smartrecord.dto.room.JoinRoomReq;
import com.smartrecord.dto.room.RearrangeSeatsReq;
import com.smartrecord.dto.room.RoomResp;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.entity.User;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.UserMapper;
import com.smartrecord.service.RoomService;
import com.smartrecord.service.StorageService;
import com.smartrecord.service.impl.ws.ScoreWebSocket;
import com.smartrecord.util.SnowflakeIdGenerator;
import com.aliyun.oss.OSS;
import com.aliyun.oss.model.ObjectMetadata;
import com.aliyun.oss.model.PutObjectRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;

import java.io.ByteArrayInputStream;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

    private final RoomMapper roomMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final UserMapper userMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final StringRedisTemplate redisTemplate;
    private final OSS ossClient;
    private final OssConfig ossConfig;
    private final ScoreWebSocket scoreWebSocket;
    private final RedissonClient redissonClient;
    private final StorageService storageService;
    @org.springframework.beans.factory.annotation.Qualifier("asyncExecutor")
    private final Executor asyncExecutor;

    @Value("${wechat.appid:}")
    private String appId;

    @Value("${wechat.secret:}")
    private String appSecret;

    private static final String ROOM_NO_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int ROOM_NO_LEN = 6;
    private static final int ROOM_EXPIRE_HOURS = 24;

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
            throw new BizException("你已有活跃房间，请先退出后再创建");
        }

        // 1. 生成唯一房间号
        String roomNo = generateUniqueRoomNo();

        // 2. 创建房间
        Room room = new Room();
        room.setId(idGenerator.nextId());
        room.setRoomNo(roomNo);
        room.setOwnerId(userId);
        room.setScoreMode(req.getScoreMode() != null ? req.getScoreMode() : 1);
        room.setStatus(0);
        roomMapper.insert(room);

        // 3. 房主自动加入（座位 1）
        RoomMember member = new RoomMember();
        member.setId(idGenerator.nextId());
        member.setRoomId(room.getId());
        member.setUserId(userId);
        member.setSeatNo(1);
        roomMemberMapper.insert(member);

        // 4. Redis 初始化房间状态
        initRoomRedis(room, userId);

        // 5. 生成专属小程序码
        String qrCodeUrl = generateQrCode(roomNo);

        return buildRoomResp(room, Collections.singletonList(member), qrCodeUrl);
    }

    @Override
    @Transactional
    public RoomResp joinRoom(Long userId, JoinRoomReq req) {
        String roomNo = req.getRoomNo() != null ? req.getRoomNo() : req.getScanRoomNo();
        if (roomNo == null || roomNo.isBlank()) {
            throw new BizException("请输入房间号");
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
            if (room == null) throw new BizException("房间不存在");
            roomId = room.getId();
        }

        // 2. 从 Redis 缓存检查是否已在房间
        Long rid = roomId;
        String membersKey = "sr:room:" + rid + ":members";
        Boolean isMember = redisTemplate.opsForHash().hasKey(membersKey, String.valueOf(userId));
        if (Boolean.TRUE.equals(isMember)) {
            return getRoomDetail(rid);
        }

        // 3. 检查房间状态
        Room room = roomMapper.selectById(rid);
        if (room == null || room.getStatus() != 0) {
            throw new BizException("房间已关闭");
        }

        // 4. 分布式锁：防止并发加入导致座位冲突
        String lockKey = "sr:room:" + rid + ":join_lock";
        RLock lock = redissonClient.getLock(lockKey);
        try {
            if (!lock.tryLock(5, 10, TimeUnit.SECONDS)) {
                throw new BizException("系统繁忙，请稍后重试");
            }

            // 再次检查是否已在房间（锁内）
            Boolean isMemberNow = redisTemplate.opsForHash().hasKey(membersKey, String.valueOf(userId));
            if (Boolean.TRUE.equals(isMemberNow)) {
                return getRoomDetail(rid);
            }

            // 5. 从 Redis 缓存分配座位
            Map<Object, Object> memberEntries = redisTemplate.opsForHash().entries(membersKey);
            Set<Integer> usedSeats = new HashSet<>();
            for (Object value : memberEntries.values()) {
                String memberJson = (String) value;
                JSONObject memberObj = JSONUtil.parseObj(memberJson);
                usedSeats.add(memberObj.getInt("seatNo"));
            }
            int nextSeat = 1;
            while (usedSeats.contains(nextSeat)) nextSeat++;
            if (nextSeat > 16) throw new BizException(4003, "房间人数已达上限，无法加入（最多16人）");

            // 6. 加入房间
            RoomMember member = new RoomMember();
            member.setId(idGenerator.nextId());
            member.setRoomId(rid);
            member.setUserId(userId);
            member.setSeatNo(nextSeat);
            roomMemberMapper.insert(member);

            // 7. 从 Redis 缓存获取用户信息
            String userKey = "sr:user:" + userId;
            String userJson = redisTemplate.opsForValue().get(userKey);
            String nickname;
            String avatarUrl;
            if (userJson != null) {
                JSONObject userObj = JSONUtil.parseObj(userJson);
                nickname = userObj.getStr("nickname");
                avatarUrl = userObj.getStr("avatarUrl");
            } else {
                // 降级查数据库
                User user = userMapper.selectById(userId);
                if (user == null) throw new BizException("用户不存在，请重新登录");
                nickname = user.getNickname();
                avatarUrl = user.getAvatarUrl();
            }

            // 8. 更新房间成员缓存
            String memberJson = JSONUtil.toJsonStr(Map.of(
                    "userId", userId,
                    "nickname", nickname,
                    "avatarUrl", avatarUrl != null ? avatarUrl : "",
                    "seatNo", nextSeat));
            redisTemplate.opsForHash().put("sr:room:" + rid + ":members", String.valueOf(userId), memberJson);
            redisTemplate.opsForSet().add("sr:user:rooms:" + userId, String.valueOf(rid));

            // 9. 异步 WebSocket 广播 MEMBER_UPDATE
            asyncPushMemberUpdate(rid, userId);

            List<RoomMember> allMembers = new ArrayList<>();
            allMembers.add(member);
            String qrCodeUrl = getQrCodeUrlFromRedis(room.getRoomNo());
            return buildRoomResp(room, allMembers, qrCodeUrl);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException("操作被中断");
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    @Override
    public RoomResp getRoomDetail(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("房间不存在");

        // 从 Redis 缓存查询房间成员
        String membersKey = "sr:room:" + roomId + ":members";
        Map<Object, Object> memberEntries = redisTemplate.opsForHash().entries(membersKey);

        List<RoomMember> members;
        if (memberEntries != null && !memberEntries.isEmpty()) {
            members = new ArrayList<>();
            for (Map.Entry<Object, Object> entry : memberEntries.entrySet()) {
                String memberJson = (String) entry.getValue();
                JSONObject memberObj = JSONUtil.parseObj(memberJson);
                RoomMember member = new RoomMember();
                member.setRoomId(roomId);
                member.setUserId(memberObj.getLong("userId"));
                member.setSeatNo(memberObj.getInt("seatNo"));
                members.add(member);
            }
        } else {
            // 降级查数据库
            members = roomMemberMapper.selectList(
                    new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
        }

        // 构建二维码 URL（OSS 中的固定路径）
        String qrCodeUrl = getQrCodeUrlFromRedis(room.getRoomNo());
        return buildRoomResp(room, members, qrCodeUrl);
    }

    @Override
    public List<RoomResp> getMyRooms(Long userId) {
        // 从 Redis 获取用户所在房间
        Set<String> roomIds = redisTemplate.opsForSet().members("sr:user:rooms:" + userId);
        if (roomIds == null || roomIds.isEmpty()) {
            // 降级查数据库
            List<RoomMember> memberships = roomMemberMapper.selectList(
                    new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getUserId, userId));
            roomIds = memberships.stream()
                    .map(m -> String.valueOf(m.getRoomId()))
                    .collect(Collectors.toSet());
        }

        if (roomIds.isEmpty()) return Collections.emptyList();

        List<Long> roomIdList = roomIds.stream().map(Long::parseLong).collect(Collectors.toList());

        // 过滤：只保留当前用户 quit_time IS NULL 的房间
        List<RoomMember> myActive = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getUserId, userId)
                        .in(RoomMember::getRoomId, roomIdList)
                        .isNull(RoomMember::getQuitTime));
        Set<Long> activeRoomIds = myActive.stream()
                .map(RoomMember::getRoomId).collect(Collectors.toSet());
        if (activeRoomIds.isEmpty()) return Collections.emptyList();

        // 批量加载房间（一次 MySQL IN 查询）
        List<Room> rooms = roomMapper.selectBatchIds(activeRoomIds);
        Map<Long, Room> roomMap = rooms.stream().collect(Collectors.toMap(Room::getId, r -> r));

        // 批量加载活跃房间的成员
        List<RoomMember> allMembers = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>()
                        .in(RoomMember::getRoomId, activeRoomIds)
                        .isNull(RoomMember::getQuitTime));
        Map<Long, List<RoomMember>> membersByRoom = allMembers.stream()
                .collect(Collectors.groupingBy(RoomMember::getRoomId));

        List<RoomResp> result = new ArrayList<>();
        for (Long rid : activeRoomIds) {
            Room room = roomMap.get(rid);
            if (room == null) continue;
            try {
                List<RoomMember> members = membersByRoom.getOrDefault(rid, Collections.emptyList());
                String qrCodeUrl = getQrCodeUrlFromRedis(room.getRoomNo());
                result.add(buildRoomResp(room, members, qrCodeUrl));
            } catch (Exception e) {
                log.warn("获取房间详情失败: roomId={}", rid, e);
            }
        }
        return result;
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
                .map(RoomMember::getRoomId).collect(Collectors.toList());
        List<Room> rooms = roomMapper.selectList(
                new LambdaQueryWrapper<Room>()
                        .in(Room::getId, roomIds)
                        .eq(Room::getStatus, 1)
                        .orderByDesc(Room::getUpdatedAt));

        List<RoomResp> result = new ArrayList<>();
        for (Room room : rooms) {
            try {
                // 从 allRecord 中提取成员信息
                List<RoomMember> allMembers = roomMemberMapper.selectList(
                        new LambdaQueryWrapper<RoomMember>()
                                .eq(RoomMember::getRoomId, room.getId()));
                String qrCodeUrl = getQrCodeUrlFromRedis(room.getRoomNo());
                result.add(buildRoomResp(room, allMembers, qrCodeUrl));
            } catch (Exception e) {
                log.warn("获取历史房间详情失败: roomId={}", room.getId(), e);
            }
        }
        return result;
    }

    @Override
    @Transactional
    public void quitRoom(Long userId, Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("房间不存在");
        if (room.getStatus() != 0) throw new BizException("房间已关闭");

        if (room.getOwnerId().equals(userId)) {
            // 房主退出 = 解散房间
            dissolveRoom(userId, roomId);
            return;
        }

        // 普通成员退出（软删除）
        roomMemberMapper.update(null, new LambdaUpdateWrapper<RoomMember>()
                .eq(RoomMember::getRoomId, roomId)
                .eq(RoomMember::getUserId, userId)
                .set(RoomMember::getQuitTime, LocalDateTime.now()));

        // 清理 Redis
        redisTemplate.opsForHash().delete("sr:room:" + roomId + ":members", String.valueOf(userId));
        redisTemplate.opsForSet().remove("sr:user:rooms:" + userId, String.valueOf(roomId));
    }

    @Override
    @Transactional
    public void dissolveRoom(Long userId, Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("房间不存在");
        if (!room.getOwnerId().equals(userId)) {
            throw new BizException("仅房主可解散房间");
        }

        // 标记归档
        room.setStatus(1);
        roomMapper.updateById(room);

        // 获取所有成员并清理 Redis
        List<RoomMember> members = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
        for (RoomMember m : members) {
            redisTemplate.opsForSet().remove("sr:user:rooms:" + m.getUserId(), String.valueOf(roomId));
        }

        // 清理房间 Redis key
        String prefix = "sr:room:" + roomId + ":";
        redisTemplate.delete(List.of(
                prefix + "info",
                prefix + "members",
                prefix + "scores",
                prefix + "batches",
                prefix + "images",
                prefix + "last_active"));
        redisTemplate.delete("sr:room_no:" + room.getRoomNo());

        // 清理批次 Hash key（通配符删除）
        Set<Object> batchKeys = redisTemplate.opsForHash().keys(prefix + "batch:*");
        if (batchKeys != null && !batchKeys.isEmpty()) {
            List<String> keysToDelete = batchKeys.stream()
                    .map(k -> prefix + "batch:" + k)
                    .collect(Collectors.toList());
            redisTemplate.delete(keysToDelete);
        }
    }

    @Override
    @Transactional
    public void swapSeat(Long userId, Long roomId, Integer targetSeatNo) {
        // 1. 校验房间
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) {
            throw new BizException("房间不存在或已关闭");
        }

        // 2. 校验用户在房间内
        String membersKey = "sr:room:" + roomId + ":members";
        String userMemberJson = (String) redisTemplate.opsForHash().get(membersKey, String.valueOf(userId));
        if (userMemberJson == null) {
            throw new BizException("您不在此房间内");
        }

        // 3. 校验目标座位未被占用
        Map<Object, Object> allMembers = redisTemplate.opsForHash().entries(membersKey);
        for (Map.Entry<Object, Object> entry : allMembers.entrySet()) {
            if (String.valueOf(entry.getKey()).equals(String.valueOf(userId))) continue;
            JSONObject obj = JSONUtil.parseObj((String) entry.getValue());
            if (targetSeatNo.equals(obj.getInt("seatNo"))) {
                throw new BizException("该座位已被占用");
            }
        }

        // 4. 更新 Redis
        JSONObject memberObj = JSONUtil.parseObj(userMemberJson);
        memberObj.set("seatNo", targetSeatNo);
        redisTemplate.opsForHash().put(membersKey, String.valueOf(userId), memberObj.toString());

        // 5. 更新 MySQL
        RoomMember updateMember = new RoomMember();
        updateMember.setSeatNo(targetSeatNo);
        roomMemberMapper.update(updateMember,
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getRoomId, roomId)
                        .eq(RoomMember::getUserId, userId));

        // 6. 异步广播 MEMBER_UPDATE
        asyncPushMemberUpdate(roomId, userId);
    }

    @Override
    @Transactional
    public void rearrangeSeats(Long userId, Long roomId, List<RearrangeSeatsReq.SeatAssignment> assignments) {
        // 1. 校验房间
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) {
            throw new BizException("房间不存在或已关闭");
        }

        // 2. 权限校验：仅房主可操作
        if (!room.getOwnerId().equals(userId)) {
            throw new BizException("仅房主可调整座位");
        }

        // 3. 读取全部成员
        String membersKey = "sr:room:" + roomId + ":members";
        Map<Object, Object> allMembers = redisTemplate.opsForHash().entries(membersKey);
        if (allMembers.isEmpty()) {
            throw new BizException("房间内无成员");
        }

        // 4. 构建当前座位映射：seatNo → userId, userId → memberJson
        Map<Integer, Long> currentSeatMap = new HashMap<>();
        Map<Long, String> memberJsonMap = new HashMap<>();
        for (Map.Entry<Object, Object> entry : allMembers.entrySet()) {
            String uid = String.valueOf(entry.getKey());
            String json = (String) entry.getValue();
            JSONObject obj = JSONUtil.parseObj(json);
            memberJsonMap.put(Long.parseLong(uid), json);
            currentSeatMap.put(obj.getInt("seatNo"), Long.parseLong(uid));
        }

        // 5. 校验所有 userId 在房间内
        for (RearrangeSeatsReq.SeatAssignment a : assignments) {
            if (!memberJsonMap.containsKey(a.getUserId())) {
                throw new BizException("用户 " + a.getUserId() + " 不在房间内");
            }
        }

        // 6. 校验目标座位号无重复
        Set<Integer> targetSeats = new HashSet<>();
        for (RearrangeSeatsReq.SeatAssignment a : assignments) {
            if (!targetSeats.add(a.getTargetSeatNo())) {
                throw new BizException("目标座位号 " + a.getTargetSeatNo() + " 重复");
            }
        }

        // 7. 虚拟应用，检查座位冲突
        Map<Integer, Long> finalSeatMap = new HashMap<>(currentSeatMap);
        for (RearrangeSeatsReq.SeatAssignment a : assignments) {
            finalSeatMap.values().removeIf(v -> v.equals(a.getUserId()));
        }
        for (RearrangeSeatsReq.SeatAssignment a : assignments) {
            if (finalSeatMap.containsKey(a.getTargetSeatNo())) {
                throw new BizException("座位 " + a.getTargetSeatNo() + " 已被占用");
            }
            finalSeatMap.put(a.getTargetSeatNo(), a.getUserId());
        }

        // 8. 更新 Redis 和 MySQL
        for (RearrangeSeatsReq.SeatAssignment a : assignments) {
            String json = memberJsonMap.get(a.getUserId());
            JSONObject obj = JSONUtil.parseObj(json);
            obj.set("seatNo", a.getTargetSeatNo());
            redisTemplate.opsForHash().put(membersKey, String.valueOf(a.getUserId()), obj.toString());

            RoomMember updateMember = new RoomMember();
            updateMember.setSeatNo(a.getTargetSeatNo());
            roomMemberMapper.update(updateMember,
                    new LambdaQueryWrapper<RoomMember>()
                            .eq(RoomMember::getRoomId, roomId)
                            .eq(RoomMember::getUserId, a.getUserId()));
        }

        // 9. 异步广播 MEMBER_UPDATE
        asyncPushMemberUpdate(roomId, userId);
    }

    @Override
    public void updateLayout(Long userId, Long roomId, String layoutType) {
        // 1. 校验房间
        Room room = roomMapper.selectById(roomId);
        if (room == null || room.getStatus() != 0) {
            throw new BizException("房间不存在或已关闭");
        }

        // 2. 权限校验
        if (!room.getOwnerId().equals(userId)) {
            throw new BizException("仅房主可切换布局");
        }

        // 3. 更新 Redis
        redisTemplate.opsForHash().put("sr:room:" + roomId + ":info", "layoutType", layoutType);

        // 4. 异步广播 LAYOUT_UPDATE
        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> pushData = new HashMap<>();
                pushData.put("type", "LAYOUT_UPDATE");
                pushData.put("roomId", roomId);
                pushData.put("layoutType", layoutType);
                scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
            } catch (Exception e) {
                log.warn("推送 LAYOUT_UPDATE 失败: roomId={}", roomId, e);
            }
        }, asyncExecutor);
    }

    // ===== 私有方法 =====

    private void asyncPushMemberUpdate(Object roomId, Object userId) {
        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> pushData = new HashMap<>();
                pushData.put("type", "MEMBER_UPDATE");
                pushData.put("roomId", roomId);
                pushData.put("userId", userId);
                scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
            } catch (Exception e) {
                log.warn("推送 MEMBER_UPDATE 失败: roomId={}, userId={}", roomId, userId, e);
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
        throw new BizException("房间号生成失败，请重试");
    }

    private void initRoomRedis(Room room, Long ownerId) {
        User owner = userMapper.selectById(ownerId);
        if (owner == null) throw new BizException("用户不存在，请重新登录");
        String roomId = String.valueOf(room.getId());

        // 房间信息
        Map<String, String> info = new HashMap<>();
        info.put("ownerId", String.valueOf(ownerId));
        info.put("status", "0");
        info.put("layoutType", "circle");
        redisTemplate.opsForHash().putAll("sr:room:" + roomId + ":info", info);
        redisTemplate.expire("sr:room:" + roomId + ":info", ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 成员
        String memberJson = JSONUtil.toJsonStr(Map.of(
                "userId", ownerId,
                "nickname", owner.getNickname(),
                "avatarUrl", owner.getAvatarUrl(),
                "seatNo", 1));
        redisTemplate.opsForHash().put("sr:room:" + roomId + ":members", String.valueOf(ownerId), memberJson);
        redisTemplate.expire("sr:room:" + roomId + ":members", ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 用户房间映射
        redisTemplate.opsForSet().add("sr:user:rooms:" + ownerId, roomId);
        redisTemplate.expire("sr:user:rooms:" + ownerId, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 更新房间号映射的实际 roomId
        redisTemplate.opsForValue().set("sr:room_no:" + room.getRoomNo(), roomId, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 缓存用户信息
        String userKey = "sr:user:" + ownerId;
        String userJson = JSONUtil.toJsonStr(Map.of(
                "userId", ownerId,
                "nickname", owner.getNickname(),
                "avatarUrl", owner.getAvatarUrl() != null ? owner.getAvatarUrl() : ""));
        redisTemplate.opsForValue().set(userKey, userJson, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
    }

    private String getQrCodeUrlFromRedis(String roomNo) {
        return redisTemplate.opsForValue().get("sr:room:" + roomNo + ":qr");
    }

    private String generateQrCode(String roomNo) {
        try {
            String tokenUrl = String.format(
                    "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s",
                    appId, appSecret);
            String tokenResp = HttpUtil.get(tokenUrl);
            String accessToken = JSONUtil.parseObj(tokenResp).getStr("access_token");
            if (accessToken == null) {
                log.error("获取 access_token 失败: {}", tokenResp);
                return null;
            }

            String qrUrl = "https://api.weixin.qq.com/wxa/getunlimited?access_token=" + accessToken;
            JSONObject body = JSONUtil.createObj()
                    .set("scene", roomNo)
                    .set("page", "pages/room/room")
                    .set("width", 280);
            byte[] qrBytes = HttpUtil.createPost(qrUrl)
                    .body(body.toString(), "application/json")
                    .execute()
                    .bodyBytes();

            String objectKey = "qrcode/" + roomNo + ".png";
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentType("image/png");
            PutObjectRequest putRequest = new PutObjectRequest(
                    ossConfig.getBucketName(), objectKey,
                    new ByteArrayInputStream(qrBytes), metadata);
            ossClient.putObject(putRequest);

            return "https://" + ossConfig.getBucketName() + "." + ossConfig.getEndpoint() + "/" + objectKey;
        } catch (Exception e) {
            log.error("生成小程序码失败", e);
            return null;
        }
    }

    private RoomResp buildRoomResp(Room room, List<RoomMember> members, String qrCodeUrl) {
        List<Long> userIds = members.stream().map(RoomMember::getUserId).distinct().collect(Collectors.toList());
        Map<Long, String> nicknameMap = new HashMap<>();
        Map<Long, String> avatarUrlMap = new HashMap<>();

        // 批量从 Redis 加载用户信息
        List<String> keys = userIds.stream().map(uid -> "sr:user:" + uid).collect(Collectors.toList());
        List<String> cached = redisTemplate.opsForValue().multiGet(keys);
        List<Long> missedIds = new ArrayList<>();
        for (int i = 0; i < userIds.size(); i++) {
            String json = cached != null ? cached.get(i) : null;
            if (json != null) {
                JSONObject userObj = JSONUtil.parseObj(json);
                nicknameMap.put(userIds.get(i), userObj.getStr("nickname", ""));
                avatarUrlMap.put(userIds.get(i), storageService.buildFullUrl(userObj.getStr("avatarUrl", "")));
            } else {
                missedIds.add(userIds.get(i));
            }
        }
        if (!missedIds.isEmpty()) {
            List<User> users = userMapper.selectBatchIds(missedIds);
            for (User u : users) {
                nicknameMap.put(u.getId(), u.getNickname());
                avatarUrlMap.put(u.getId(), storageService.buildFullUrl(u.getAvatarUrl()));
            }
            for (Long uid : missedIds) {
                nicknameMap.putIfAbsent(uid, "");
                avatarUrlMap.putIfAbsent(uid, "");
            }
        }

        List<RoomResp.MemberVO> memberVOs = members.stream().map(m ->
                RoomResp.MemberVO.builder()
                        .userId(m.getUserId())
                        .nickname(nicknameMap.getOrDefault(m.getUserId(), ""))
                        .avatarUrl(avatarUrlMap.getOrDefault(m.getUserId(), ""))
                        .seatNo(m.getSeatNo())
                        .build()
        ).collect(Collectors.toList());

        String layoutType = (String) redisTemplate.opsForHash().get("sr:room:" + room.getId() + ":info", "layoutType");

        return RoomResp.builder()
                .roomId(room.getId())
                .roomNo(room.getRoomNo())
                .ownerId(room.getOwnerId())
                .scoreMode(room.getScoreMode() != null ? room.getScoreMode() : 1)
                .status(room.getStatus())
                .qrCodeUrl(qrCodeUrl)
                .layoutType(layoutType != null ? layoutType : "circle")
                .members(memberVOs)
                .createdAt(room.getCreatedAt())
                .build();
    }

}
