package com.mahjong.score.service.impl;

import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mahjong.score.common.BizException;
import com.mahjong.score.config.MinioConfig;
import com.mahjong.score.dto.room.CreateRoomReq;
import com.mahjong.score.dto.room.JoinRoomReq;
import com.mahjong.score.dto.room.RoomResp;
import com.mahjong.score.entity.Room;
import com.mahjong.score.entity.RoomMember;
import com.mahjong.score.entity.User;
import com.mahjong.score.mapper.RoomMapper;
import com.mahjong.score.mapper.RoomMemberMapper;
import com.mahjong.score.mapper.UserMapper;
import com.mahjong.score.service.RoomService;
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
    private final UserMapper userMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final StringRedisTemplate redisTemplate;
    private final MinioClient minioClient;
    private final MinioConfig minioConfig;

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

        // 2. 检查是否已在房间
        Long rid = roomId;
        RoomMember existing = roomMemberMapper.selectOne(
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getRoomId, rid)
                        .eq(RoomMember::getUserId, userId));
        if (existing != null) {
            return getRoomDetail(rid);
        }

        // 3. 检查房间状态
        Room room = roomMapper.selectById(rid);
        if (room == null || room.getStatus() != 0) {
            throw new BizException("房间已关闭");
        }

        // 4. 分配座位
        List<RoomMember> allMembers = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, rid));
        Set<Integer> usedSeats = allMembers.stream()
                .map(RoomMember::getSeatNo)
                .collect(Collectors.toSet());
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

        // 6. 更新 Redis
        User user = userMapper.selectById(userId);
        String memberJson = JSONUtil.toJsonStr(Map.of(
                "userId", userId,
                "nickname", user.getNickname(),
                "avatarUrl", user.getAvatarUrl(),
                "seatNo", nextSeat));
        redisTemplate.opsForHash().put("mj:room:" + rid + ":members", String.valueOf(userId), memberJson);
        redisTemplate.opsForSet().add("mj:user:rooms:" + userId, String.valueOf(rid));

        allMembers.add(member);
        return buildRoomResp(room, allMembers, null);
    }

    @Override
    public RoomResp getRoomDetail(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("房间不存在");

        List<RoomMember> members = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));

        return buildRoomResp(room, members, null);
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
                prefix + "session:counter"));
        redisTemplate.delete("mj:room_no:" + room.getRoomNo());
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

    private void initRoomRedis(Room room, Long ownerId) {
        User owner = userMapper.selectById(ownerId);
        String roomId = String.valueOf(room.getId());

        // 房间信息
        Map<String, String> info = new HashMap<>();
        info.put("ownerId", String.valueOf(ownerId));
        info.put("baseScore", String.valueOf(room.getBaseScore()));
        info.put("status", "0");
        info.put("sessionCounter", "0");
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
        // 批量查询用户信息
        Set<Long> userIds = members.stream().map(RoomMember::getUserId).collect(Collectors.toSet());
        Map<Long, User> userMap = userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        List<RoomResp.MemberVO> memberVOs = members.stream().map(m -> {
            User u = userMap.get(m.getUserId());
            return RoomResp.MemberVO.builder()
                    .userId(m.getUserId())
                    .nickname(u != null ? u.getNickname() : "")
                    .avatarUrl(u != null ? u.getAvatarUrl() : "")
                    .seatNo(m.getSeatNo())
                    .build();
        }).collect(Collectors.toList());

        return RoomResp.builder()
                .roomId(room.getId())
                .roomNo(room.getRoomNo())
                .ownerId(room.getOwnerId())
                .baseScore(room.getBaseScore())
                .status(room.getStatus())
                .qrCodeUrl(qrCodeUrl)
                .members(memberVOs)
                .createdAt(room.getCreatedAt())
                .build();
    }
}
