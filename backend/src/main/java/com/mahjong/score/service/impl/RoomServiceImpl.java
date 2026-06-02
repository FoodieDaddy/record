package com.mahjong.score.service.impl;

import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mahjong.score.common.BizException;
import com.mahjong.score.config.MinioConfig;
import com.mahjong.score.dto.room.CreateRoomReq;
import com.mahjong.score.dto.room.JoinRoomReq;
import com.mahjong.score.dto.room.RearrangeSeatsReq;
import com.mahjong.score.dto.room.RoomResp;
import com.mahjong.score.entity.Room;
import com.mahjong.score.entity.RoomMember;
import com.mahjong.score.entity.Session;
import com.mahjong.score.entity.User;
import com.mahjong.score.mapper.RoomMapper;
import com.mahjong.score.mapper.RoomMemberMapper;
import com.mahjong.score.mapper.SessionMapper;
import com.mahjong.score.mapper.UserMapper;
import com.mahjong.score.service.RoomService;
import com.mahjong.score.service.impl.ws.ScoreWebSocket;
import com.mahjong.score.util.JwtUtil;
import com.mahjong.score.util.SnowflakeIdGenerator;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

    private final RoomMapper roomMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final SessionMapper sessionMapper;
    private final UserMapper userMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final StringRedisTemplate redisTemplate;
    private final MinioClient minioClient;
    private final MinioConfig minioConfig;
    private final ScoreWebSocket scoreWebSocket;

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
        // 1. 生成唯一房间号
        String roomNo = generateUniqueRoomNo();

        // 2. 创建房间
        Room room = new Room();
        room.setId(idGenerator.nextId());
        room.setRoomNo(roomNo);
        room.setOwnerId(userId);
        room.setBaseScore(req.getBaseScore());
        room.setStatus(0);
        room.setRoundCount(1);
        roomMapper.insert(room);

        // 自动创建第一轮场次
        Session session = new Session();
        session.setId(idGenerator.nextId());
        session.setRoomId(room.getId());
        session.setSessionNo(1);
        session.setTitle("第1轮");
        session.setStatus(0);
        session.setScoreCount(0);
        session.setCreatedBy(userId);
        sessionMapper.insert(session);

        // 3. 房主自动加入（座位 1）
        RoomMember member = new RoomMember();
        member.setId(idGenerator.nextId());
        member.setRoomId(room.getId());
        member.setUserId(userId);
        member.setSeatNo(1);
        roomMemberMapper.insert(member);

        // 4. Redis 初始化房间状态
        initRoomRedis(room, userId, session.getId());

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
        String roomIdStr = redisTemplate.opsForValue().get("mj:room_no:" + roomNo.toUpperCase());
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
        String membersKey = "mj:room:" + rid + ":members";
        Boolean isMember = redisTemplate.opsForHash().hasKey(membersKey, String.valueOf(userId));
        if (Boolean.TRUE.equals(isMember)) {
            return getRoomDetail(rid);
        }

        // 3. 检查房间状态
        Room room = roomMapper.selectById(rid);
        if (room == null || room.getStatus() != 0) {
            throw new BizException("房间已关闭");
        }

        // 4. 从 Redis 缓存分配座位
        Map<Object, Object> memberEntries = redisTemplate.opsForHash().entries(membersKey);
        Set<Integer> usedSeats = new HashSet<>();
        for (Object value : memberEntries.values()) {
            String memberJson = (String) value;
            JSONObject memberObj = JSONUtil.parseObj(memberJson);
            usedSeats.add(memberObj.getInt("seatNo"));
        }
        int nextSeat = 1;
        while (usedSeats.contains(nextSeat)) nextSeat++;
        if (nextSeat > 8) throw new BizException("房间已满（最多 8 人）");

        // 5. 加入房间
        RoomMember member = new RoomMember();
        member.setId(idGenerator.nextId());
        member.setRoomId(rid);
        member.setUserId(userId);
        member.setSeatNo(nextSeat);
        roomMemberMapper.insert(member);

        // 6. 从 Redis 缓存获取用户信息
        String userKey = "mj:user:" + userId;
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

        // 7. 更新房间成员缓存
        String memberJson = JSONUtil.toJsonStr(Map.of(
                "userId", userId,
                "nickname", nickname,
                "avatarUrl", avatarUrl != null ? avatarUrl : "",
                "seatNo", nextSeat));
        redisTemplate.opsForHash().put("mj:room:" + rid + ":members", String.valueOf(userId), memberJson);
        redisTemplate.opsForSet().add("mj:user:rooms:" + userId, String.valueOf(rid));

        // 8. WebSocket 广播 MEMBER_UPDATE
        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "MEMBER_UPDATE");
            pushData.put("roomId", rid);
            pushData.put("userId", userId);
            scoreWebSocket.pushToRoom(String.valueOf(rid), pushData);
        } catch (Exception e) {
            log.warn("推送 MEMBER_UPDATE 失败: roomId={}, userId={}", rid, userId, e);
        }

        List<RoomMember> allMembers = new ArrayList<>();
        allMembers.add(member);
        String qrCodeUrl = minioConfig.getEndpoint() + "/" + minioConfig.getBucket() + "/qrcode/" + room.getRoomNo() + ".png";
        return buildRoomResp(room, allMembers, qrCodeUrl);
    }

    @Override
    public RoomResp getRoomDetail(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("房间不存在");

        // 从 Redis 缓存查询房间成员
        String membersKey = "mj:room:" + roomId + ":members";
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

        // 构建二维码 URL（MinIO 中的固定路径）
        String qrCodeUrl = minioConfig.getEndpoint() + "/" + minioConfig.getBucket() + "/qrcode/" + room.getRoomNo() + ".png";
        return buildRoomResp(room, members, qrCodeUrl);
    }

    @Override
    public List<RoomResp> getMyRooms(Long userId) {
        // 从 Redis 获取用户所在房间
        Set<String> roomIds = redisTemplate.opsForSet().members("mj:user:rooms:" + userId);
        if (roomIds == null || roomIds.isEmpty()) {
            // 降级查数据库
            List<RoomMember> memberships = roomMemberMapper.selectList(
                    new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getUserId, userId));
            roomIds = memberships.stream()
                    .map(m -> String.valueOf(m.getRoomId()))
                    .collect(Collectors.toSet());
        }

        List<RoomResp> result = new ArrayList<>();
        for (String rid : roomIds) {
            try {
                result.add(getRoomDetail(Long.parseLong(rid)));
            } catch (Exception e) {
                log.warn("获取房间详情失败: roomId={}", rid, e);
            }
        }
        return result;
    }

    @Override
    @Transactional
    public void quitRoom(Long userId, Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("房间不存在");
        if (room.getOwnerId().equals(userId)) {
            throw new BizException("房主不能退出，请使用解散功能");
        }

        roomMemberMapper.delete(
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getRoomId, roomId)
                        .eq(RoomMember::getUserId, userId));

        // 清理 Redis
        redisTemplate.opsForHash().delete("mj:room:" + roomId + ":members", String.valueOf(userId));
        redisTemplate.opsForSet().remove("mj:user:rooms:" + userId, String.valueOf(roomId));
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
            redisTemplate.opsForSet().remove("mj:user:rooms:" + m.getUserId(), String.valueOf(roomId));
        }

        // 清理房间 Redis key
        String prefix = "mj:room:" + roomId + ":";
        redisTemplate.delete(List.of(
                prefix + "info",
                prefix + "members",
                prefix + "scores",
                prefix + "session:counter",
                prefix + "active_session"));
        redisTemplate.delete("mj:room_no:" + room.getRoomNo());
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
        String membersKey = "mj:room:" + roomId + ":members";
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

        // 6. 广播 MEMBER_UPDATE
        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "MEMBER_UPDATE");
            pushData.put("roomId", roomId);
            pushData.put("userId", userId);
            scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
        } catch (Exception e) {
            log.warn("推送换座 MEMBER_UPDATE 失败: roomId={}, userId={}", roomId, userId, e);
        }
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
        String membersKey = "mj:room:" + roomId + ":members";
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
        // 先清除所有被调整用户的旧座位
        for (RearrangeSeatsReq.SeatAssignment a : assignments) {
            finalSeatMap.values().removeIf(v -> v.equals(a.getUserId()));
        }
        // 再分配新座位，检查目标是否被未调整的人占用
        for (RearrangeSeatsReq.SeatAssignment a : assignments) {
            if (finalSeatMap.containsKey(a.getTargetSeatNo())) {
                throw new BizException("座位 " + a.getTargetSeatNo() + " 已被占用");
            }
            finalSeatMap.put(a.getTargetSeatNo(), a.getUserId());
        }

        // 7. 更新 Redis 和 MySQL
        for (RearrangeSeatsReq.SeatAssignment a : assignments) {
            // Redis
            String json = memberJsonMap.get(a.getUserId());
            JSONObject obj = JSONUtil.parseObj(json);
            obj.set("seatNo", a.getTargetSeatNo());
            redisTemplate.opsForHash().put(membersKey, String.valueOf(a.getUserId()), obj.toString());

            // MySQL
            RoomMember updateMember = new RoomMember();
            updateMember.setSeatNo(a.getTargetSeatNo());
            roomMemberMapper.update(updateMember,
                    new LambdaQueryWrapper<RoomMember>()
                            .eq(RoomMember::getRoomId, roomId)
                            .eq(RoomMember::getUserId, a.getUserId()));
        }

        // 8. 广播 MEMBER_UPDATE
        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "MEMBER_UPDATE");
            pushData.put("roomId", roomId);
            pushData.put("rearrangedBy", userId);
            scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
        } catch (Exception e) {
            log.warn("推送调整座位 MEMBER_UPDATE 失败: roomId={}", roomId, e);
        }
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
        redisTemplate.opsForHash().put("mj:room:" + roomId + ":info", "layoutType", layoutType);

        // 4. 广播 LAYOUT_UPDATE
        try {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "LAYOUT_UPDATE");
            pushData.put("roomId", roomId);
            pushData.put("layoutType", layoutType);
            scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
        } catch (Exception e) {
            log.warn("推送 LAYOUT_UPDATE 失败: roomId={}", roomId, e);
        }
    }

    // ===== 私有方法 =====

    private String generateUniqueRoomNo() {
        Random random = new Random();
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder(ROOM_NO_LEN);
            for (int i = 0; i < ROOM_NO_LEN; i++) {
                sb.append(ROOM_NO_CHARS.charAt(random.nextInt(ROOM_NO_CHARS.length())));
            }
            String roomNo = sb.toString();
            String key = "mj:room_no:" + roomNo;
            Boolean ok = redisTemplate.opsForValue().setIfAbsent(key, "pending", ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
            if (Boolean.TRUE.equals(ok)) {
                return roomNo;
            }
        }
        throw new BizException("房间号生成失败，请重试");
    }

    private void initRoomRedis(Room room, Long ownerId, Long sessionId) {
        User owner = userMapper.selectById(ownerId);
        if (owner == null) throw new BizException("用户不存在，请重新登录");
        String roomId = String.valueOf(room.getId());

        // 房间信息
        Map<String, String> info = new HashMap<>();
        info.put("ownerId", String.valueOf(ownerId));
        info.put("baseScore", String.valueOf(room.getBaseScore()));
        info.put("status", "0");
        info.put("sessionCounter", "0");
        info.put("layoutType", "circle");
        redisTemplate.opsForHash().putAll("mj:room:" + roomId + ":info", info);
        redisTemplate.expire("mj:room:" + roomId + ":info", ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 成员
        String memberJson = JSONUtil.toJsonStr(Map.of(
                "userId", ownerId,
                "nickname", owner.getNickname(),
                "avatarUrl", owner.getAvatarUrl(),
                "seatNo", 1));
        redisTemplate.opsForHash().put("mj:room:" + roomId + ":members", String.valueOf(ownerId), memberJson);
        redisTemplate.expire("mj:room:" + roomId + ":members", ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 用户房间映射
        redisTemplate.opsForSet().add("mj:user:rooms:" + ownerId, roomId);
        redisTemplate.expire("mj:user:rooms:" + ownerId, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 更新房间号映射的实际 roomId
        redisTemplate.opsForValue().set("mj:room_no:" + room.getRoomNo(), roomId, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 缓存活跃场次 ID
        redisTemplate.opsForValue().set("mj:room:" + roomId + ":active_session", String.valueOf(sessionId), ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 缓存用户信息
        String userKey = "mj:user:" + ownerId;
        String userJson = JSONUtil.toJsonStr(Map.of(
                "userId", ownerId,
                "nickname", owner.getNickname(),
                "avatarUrl", owner.getAvatarUrl() != null ? owner.getAvatarUrl() : ""));
        redisTemplate.opsForValue().set(userKey, userJson, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
    }

    private String generateQrCode(String roomNo) {
        try {
            // 1. 获取 access_token
            String tokenUrl = String.format(
                    "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s",
                    appId, appSecret);
            String tokenResp = HttpUtil.get(tokenUrl);
            String accessToken = JSONUtil.parseObj(tokenResp).getStr("access_token");
            if (accessToken == null) {
                log.error("获取 access_token 失败: {}", tokenResp);
                return null;
            }

            // 2. 调用 getUnlimited 生成小程序码
            String qrUrl = "https://api.weixin.qq.com/wxa/getunlimited?access_token=" + accessToken;
            JSONObject body = JSONUtil.createObj()
                    .set("scene", roomNo)
                    .set("page", "pages/room/room")
                    .set("width", 280);
            byte[] qrBytes = HttpUtil.createPost(qrUrl)
                    .body(body.toString(), "application/json")
                    .execute()
                    .bodyBytes();

            // 3. 上传到 MinIO
            String objectKey = "qrcode/" + roomNo + ".png";
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(minioConfig.getBucket())
                            .object(objectKey)
                            .stream(new ByteArrayInputStream(qrBytes), qrBytes.length, -1)
                            .contentType("image/png")
                            .build());

            return minioConfig.getEndpoint() + "/" + minioConfig.getBucket() + "/" + objectKey;
        } catch (Exception e) {
            log.error("生成小程序码失败", e);
            return null;
        }
    }

    private RoomResp buildRoomResp(Room room, List<RoomMember> members, String qrCodeUrl) {
        // 从 Redis 缓存获取用户信息
        Set<Long> userIds = members.stream().map(RoomMember::getUserId).collect(Collectors.toSet());
        Map<Long, String> nicknameMap = new HashMap<>();
        Map<Long, String> avatarUrlMap = new HashMap<>();
        for (Long uid : userIds) {
            String userKey = "mj:user:" + uid;
            String userJson = redisTemplate.opsForValue().get(userKey);
            if (userJson != null) {
                JSONObject userObj = JSONUtil.parseObj(userJson);
                nicknameMap.put(uid, userObj.getStr("nickname", ""));
                avatarUrlMap.put(uid, userObj.getStr("avatarUrl", ""));
            } else {
                // 降级查数据库
                User u = userMapper.selectById(uid);
                nicknameMap.put(uid, u != null ? u.getNickname() : "");
                avatarUrlMap.put(uid, u != null ? u.getAvatarUrl() : "");
            }
        }

        List<RoomResp.MemberVO> memberVOs = members.stream().map(m -> {
            return RoomResp.MemberVO.builder()
                    .userId(m.getUserId())
                    .nickname(nicknameMap.getOrDefault(m.getUserId(), ""))
                    .avatarUrl(avatarUrlMap.getOrDefault(m.getUserId(), ""))
                    .seatNo(m.getSeatNo())
                    .build();
        }).collect(Collectors.toList());

        // 从 Redis 缓存获取活跃场次 ID
        Long activeSessionId = null;
        String activeSessionKey = "mj:room:" + room.getId() + ":active_session";
        String sessionIdStr = redisTemplate.opsForValue().get(activeSessionKey);
        if (sessionIdStr != null) {
            activeSessionId = Long.parseLong(sessionIdStr);
        } else {
            // 降级查数据库
            Session activeSession = sessionMapper.selectOne(
                    new LambdaQueryWrapper<Session>()
                            .eq(Session::getRoomId, room.getId())
                            .eq(Session::getStatus, 0)
                            .last("LIMIT 1"));
            if (activeSession != null) {
                activeSessionId = activeSession.getId();
                // 缓存活跃场次 ID
                redisTemplate.opsForValue().set(activeSessionKey, String.valueOf(activeSessionId), ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
            }
        }

        // 从 Redis 读取布局类型
        String layoutType = (String) redisTemplate.opsForHash().get("mj:room:" + room.getId() + ":info", "layoutType");

        return RoomResp.builder()
                .roomId(room.getId())
                .roomNo(room.getRoomNo())
                .ownerId(room.getOwnerId())
                .baseScore(room.getBaseScore())
                .status(room.getStatus())
                .roundCount(room.getRoundCount())
                .activeSessionId(activeSessionId)
                .qrCodeUrl(qrCodeUrl)
                .layoutType(layoutType != null ? layoutType : "circle")
                .members(memberVOs)
                .createdAt(room.getCreatedAt())
                .build();
    }
}
