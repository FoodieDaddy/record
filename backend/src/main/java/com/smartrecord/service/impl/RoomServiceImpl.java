package com.smartrecord.service.impl;

import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.config.OssConfig;
import com.smartrecord.dto.room.*;
import com.smartrecord.enums.ScoreMode;
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
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
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
    private final StorageService storageService;
    @Qualifier("asyncExecutor")
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
            throw new BizException("你已有活跃空间，请先退出后再启动");
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
        generateQrCodeAsync(roomNo);

        return buildRoomResp(room, Collections.singletonList(member), null);
    }

    @Override
    @Transactional
    public RoomResp joinRoom(Long userId, JoinRoomReq req) {
        String roomNo = req.getRoomNo() != null ? req.getRoomNo() : req.getScanRoomNo();
        if (roomNo == null || roomNo.isBlank()) {
            throw new BizException("请输入识别码");
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
            if (room == null) throw new BizException("空间不存在");
            roomId = room.getId();
        }

        // 2. 检查是否为活跃成员（先查 active Hash，再兼容旧 meta）
        Long rid = roomId;
        String metaKey = "sr:room:" + rid + ":meta";
        if (isActiveMemberWithFallback(rid, userId)) {
            throw new BizException(4009, "你已接入当前空间，无需重复接入");
        }

        // 3. 检查房间状态
        Room room = roomMapper.selectById(rid);
        if (room == null || room.getStatus() != 0) {
            throw new BizException("空间已关闭");
        }

        // 4. 检查房间人数上限
        Long memberCount = redisTemplate.opsForHash().size(activeMembersKey(rid));
        if (memberCount == null || memberCount == 0) {
            // 兼容降级：active Hash 为空时统计旧 meta 中 m: 前缀
            Map<Object, Object> allMetaFields = redisTemplate.opsForHash().entries(metaKey);
            memberCount = allMetaFields.keySet().stream().filter(k -> ((String) k).startsWith("m:")).count();
        }
        if (memberCount >= 16) throw new BizException(4003, "空间舰员已满（上限16人）");

        // 5. 加载用户信息并检查重名
        String userKey = "sr:user:" + userId;
        String userJson = redisTemplate.opsForValue().get(userKey);
        String nickname;
        String avatarUrl;
        if (userJson != null) {
            JSONObject userObj = JSONUtil.parseObj(userJson);
            nickname = userObj.getStr("nickname");
            avatarUrl = userObj.getStr("avatarUrl");
        } else {
            User user = userMapper.selectById(userId);
            if (user == null) throw new BizException("身份未识别，请重新接入终端");
            nickname = user.getNickname();
            avatarUrl = user.getAvatarUrl();
        }

        // 重名检查：遍历活跃成员，碰撞则拦截
        Map<Long, JSONObject> activeMembers = readActiveMembers(rid);
        for (JSONObject memberObj : activeMembers.values()) {
            if (nickname.equals(memberObj.getStr("nickname"))) {
                throw new BizException(4009, "身份重叠：场域内存在同名实体，请前往[我的]修改昵称");
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
        // 写入 active + archive 成员 Hash
        upsertActiveMember(rid, userId, nickname, avatarUrl);
        upsertArchiveMember(rid, userId, nickname, avatarUrl);
        // 兼容旧 meta
        String memberJson = JSONUtil.toJsonStr(Map.of(
                "userId", userId,
                "nickname", nickname,
                "avatarUrl", avatarUrl != null ? avatarUrl : ""));
        redisTemplate.opsForHash().put(metaKey, "m:" + userId, memberJson);
        redisTemplate.opsForSet().add("sr:user:rooms:" + userId, String.valueOf(rid));

        // 初始化新成员排行榜 0 分（确保 0 分成员也能出现在排行榜）
        String scoresKey = "sr:room:" + rid + ":scores";
        if (redisTemplate.opsForZSet().score(scoresKey, String.valueOf(userId)) == null) {
            redisTemplate.opsForZSet().add(scoresKey, String.valueOf(userId), 0);
        }

        // 8. 异步 WebSocket 广播 MEMBER_JOIN（通知房间内已有成员）
        asyncPushMemberJoin(rid, userId, nickname, avatarUrl);

        List<RoomMember> allMembers = new ArrayList<>();
        allMembers.add(member);
        String qrCodeUrl = getQrCodeUrlFromRedis(room.getRoomNo());
        return buildRoomResp(room, allMembers, qrCodeUrl);
    }

    @Override
    public RoomResp getRoomDetail(Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("空间不存在");

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
        String qrCodeUrl = getQrCodeUrlFromRedis(room.getRoomNo());
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
    @Transactional
    public void quitRoom(Long userId, Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("空间不存在");

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
        // 只从 active 成员组移除，保留 archive 快照和 scores
        removeActiveMember(roomId, userId);
        // 兼容：同时从旧 meta 中移除
        redisTemplate.opsForHash().delete("sr:room:" + roomId + ":meta", "m:" + userId);
        redisTemplate.opsForSet().remove("sr:user:rooms:" + userId, String.valueOf(roomId));

        // 广播成员离开
        asyncPushMemberLeave(roomId, userId);
    }

    @Override
    @Transactional
    public void dissolveRoom(Long userId, Long roomId) {
        Room room = roomMapper.selectById(roomId);
        if (room == null) throw new BizException("空间不存在");
        if (!room.getOwnerId().equals(userId)) {
            throw new BizException("仅主控可解散空间");
        }

        // 标记归档（使用显式 Wrapper 确保 status 字段写入）
        room.setStatus(1);
        roomMapper.update(null, new LambdaUpdateWrapper<Room>()
                .eq(Room::getId, roomId)
                .set(Room::getStatus, 1));

        // 获取所有成员并清理 Redis
        List<RoomMember> members = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getRoomId, roomId));
        for (RoomMember m : members) {
            redisTemplate.opsForSet().remove("sr:user:rooms:" + m.getUserId(), String.valueOf(roomId));
        }

        // 清理房间 Redis key
        String prefix = "sr:room:" + roomId + ":";

        // 先读取批次时间戳，再统一删除
        List<String> batchTsList = redisTemplate.opsForList().range(prefix + "batches", 0, -1);

        List<String> keysToDelete = new ArrayList<>(List.of(
                prefix + "meta",
                prefix + "scores",
                prefix + "batches",
                prefix + "events",
                prefix + "overview",
                prefix + "roundConfig",
                prefix + "round",
                prefix + "round:details",
                prefix + "round:members",
                prefix + "round:confirms",
                prefix + "members:active",
                prefix + "members:archive"));
        if (batchTsList != null) {
            for (String ts : batchTsList) {
                keysToDelete.add(prefix + "batch:" + ts);
            }
        }
        redisTemplate.delete(keysToDelete);

        redisTemplate.delete("sr:room_no:" + room.getRoomNo());

        // 清理二维码
        storageService.deleteObjectAsync("qrcode/" + room.getRoomNo() + ".png");
        redisTemplate.delete("sr:room:" + room.getRoomNo() + ":qr");
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

        Map<Long, RoomMember> memberMap = memberships.stream()
                .collect(Collectors.toMap(RoomMember::getRoomId, m -> m, (a, b) -> a));

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
            String userJson = redisTemplate.opsForValue().get("sr:user:" + uid);
            if (userJson != null) {
                JSONObject userObj = JSONUtil.parseObj(userJson);
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
        if (room == null) throw new BizException("空间不存在");
        if (room.getStatus() != 0) throw new BizException("空间已封存，不能修改记录设置");
        if (!room.getOwnerId().equals(userId)) throw new BizException("仅主控可修改记录设置");

        // 检查是否有待处理录
        String roundKey = "sr:room:" + roomId + ":round";
        if (Boolean.TRUE.equals(redisTemplate.hasKey(roundKey))) {
            throw new BizException("当前有待处理录入，不能修改记录设置");
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

        // 更新 Redis roundConfig（超时设置仅信任关闭时可修改）
        String configKey = "sr:room:" + roomId + ":roundConfig";
        Map<String, String> configUpdates = new HashMap<>();
        int trustMode = room.getTrustMode() != null ? room.getTrustMode() : 1;
        if (trustMode == 0) {
            if (req.getAutoTimeoutSeconds() != null) {
                configUpdates.put("autoTimeoutSeconds", String.valueOf(req.getAutoTimeoutSeconds()));
            }
            if (req.getAutoTimeoutAction() != null) {
                configUpdates.put("autoTimeoutAction", String.valueOf(req.getAutoTimeoutAction()));
            }
        }
        if (!configUpdates.isEmpty()) {
            redisTemplate.opsForHash().putAll(configKey, configUpdates);
        }

        // 广播 SETTINGS_CHANGED
        Map<String, Object> pushData = new HashMap<>();
        pushData.put("type", "SETTINGS_CHANGED");
        pushData.put("roomId", roomId);
        pushData.put("roundInputMethod", room.getRoundInputMethod());
        pushData.put("trustMode", room.getTrustMode());
        pushData.put("zeroSumRequired", room.getZeroSumRequired());
        if (trustMode == 0) {
            String seconds = (String) redisTemplate.opsForHash().get(configKey, "autoTimeoutSeconds");
            String action = (String) redisTemplate.opsForHash().get(configKey, "autoTimeoutAction");
            pushData.put("autoTimeoutSeconds", seconds != null ? Integer.parseInt(seconds) : 30);
            pushData.put("autoTimeoutAction", action != null ? Integer.parseInt(action) : 1);
        }
        scoreWebSocket.pushToRoom(String.valueOf(roomId), pushData);
    }

    // ===== 成员 Hash 辅助方法 =====

    private String activeMembersKey(Long roomId) {
        return "sr:room:" + roomId + ":members:active";
    }

    private String archiveMembersKey(Long roomId) {
        return "sr:room:" + roomId + ":members:archive";
    }

    /**
     * 从 members:active Hash 读取成员列表，如果为空则兼容降级读旧 meta 中 m: 前缀
     */
    private Map<Long, JSONObject> readActiveMembers(Long roomId) {
        String activeKey = activeMembersKey(roomId);
        Map<Object, Object> entries = redisTemplate.opsForHash().entries(activeKey);
        if (entries != null && !entries.isEmpty()) {
            Map<Long, JSONObject> result = new HashMap<>();
            for (Map.Entry<Object, Object> entry : entries.entrySet()) {
                Long userId = Long.parseLong((String) entry.getKey());
                JSONObject obj = JSONUtil.parseObj((String) entry.getValue());
                result.put(userId, obj);
            }
            return result;
        }
        // 兼容降级：读旧 meta 中 m: 前缀字段
        String metaKey = "sr:room:" + roomId + ":meta";
        Map<Object, Object> metaEntries = redisTemplate.opsForHash().entries(metaKey);
        Map<Long, JSONObject> result = new HashMap<>();
        if (metaEntries != null) {
            for (Map.Entry<Object, Object> entry : metaEntries.entrySet()) {
                String key = (String) entry.getKey();
                if (key.startsWith("m:")) {
                    Long userId = Long.parseLong(key.substring(2));
                    JSONObject obj = JSONUtil.parseObj((String) entry.getValue());
                    result.put(userId, obj);
                }
            }
        }
        return result;
    }

    /**
     * 从 members:archive Hash 读取归档成员快照
     */
    private Map<Long, JSONObject> readArchiveMembers(Long roomId) {
        String archiveKey = archiveMembersKey(roomId);
        Map<Object, Object> entries = redisTemplate.opsForHash().entries(archiveKey);
        Map<Long, JSONObject> result = new HashMap<>();
        if (entries != null) {
            for (Map.Entry<Object, Object> entry : entries.entrySet()) {
                Long userId = Long.parseLong((String) entry.getKey());
                JSONObject obj = JSONUtil.parseObj((String) entry.getValue());
                result.put(userId, obj);
            }
        }
        return result;
    }

    /**
     * 写入 active Hash，设置 TTL
     */
    private void upsertActiveMember(Long roomId, Long userId, String nickname, String avatarUrl) {
        String key = activeMembersKey(roomId);
        JSONObject obj = JSONUtil.createObj()
                .set("userId", userId)
                .set("nickname", nickname)
                .set("avatarUrl", avatarUrl != null ? avatarUrl : "");
        redisTemplate.opsForHash().put(key, String.valueOf(userId), obj.toString());
        redisTemplate.expire(key, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
    }

    /**
     * 写入 archive Hash，存在则更新昵称头像和 lastSeenAt，不存在则新增（含 firstJoinedAt），设置 TTL
     */
    private void upsertArchiveMember(Long roomId, Long userId, String nickname, String avatarUrl) {
        String key = archiveMembersKey(roomId);
        long now = System.currentTimeMillis();
        Object existing = redisTemplate.opsForHash().get(key, String.valueOf(userId));
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
        redisTemplate.opsForHash().put(key, String.valueOf(userId), obj.toString());
        redisTemplate.expire(key, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
    }

    /**
     * 从 active Hash 移除
     */
    private void removeActiveMember(Long roomId, Long userId) {
        redisTemplate.opsForHash().delete(activeMembersKey(roomId), String.valueOf(userId));
    }

    /**
     * 判断是否在 active Hash 中
     */
    private boolean isActiveMember(Long roomId, Long userId) {
        return Boolean.TRUE.equals(
                redisTemplate.opsForHash().hasKey(activeMembersKey(roomId), String.valueOf(userId)));
    }

    /**
     * 先查 active，再兼容旧 meta
     */
    private boolean isActiveMemberWithFallback(Long roomId, Long userId) {
        if (isActiveMember(roomId, userId)) {
            return true;
        }
        // 兼容旧 meta
        String metaKey = "sr:room:" + roomId + ":meta";
        return Boolean.TRUE.equals(redisTemplate.opsForHash().hasKey(metaKey, "m:" + userId));
    }

    /**
     * 三源合并：archive + scores 中的 playerTotalMap + events 中的 eventUserIds
     */
    private Set<Long> collectArchiveUserIdsForSettle(Long roomId, Map<Long, Integer> playerTotalMap, Set<Long> eventUserIds) {
        Set<Long> userIds = new HashSet<>();
        // 1. 归档成员
        Map<Long, JSONObject> archiveMembers = readArchiveMembers(roomId);
        userIds.addAll(archiveMembers.keySet());
        // 2. 分数记录中的用户
        if (playerTotalMap != null) {
            userIds.addAll(playerTotalMap.keySet());
        }
        // 3. 事件记录中的用户
        if (eventUserIds != null) {
            userIds.addAll(eventUserIds);
        }
        return userIds;
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
        throw new BizException("识别码生成失败，请重试");
    }

    private void initRoomRedis(Room room, Long ownerId, CreateRoomReq req) {
        User owner = userMapper.selectById(ownerId);
        if (owner == null) throw new BizException("身份未识别，请重新接入终端");
        String roomId = String.valueOf(room.getId());
        String metaKey = "sr:room:" + roomId + ":meta";

        // 房间信息 + 房主成员数据合并写入 meta
        Map<String, String> meta = new HashMap<>();
        meta.put("ownerId", String.valueOf(ownerId));
        meta.put("status", "0");
        meta.put("m:" + ownerId, JSONUtil.toJsonStr(Map.of(
                "userId", ownerId,
                "nickname", owner.getNickname(),
                "avatarUrl", owner.getAvatarUrl() != null ? owner.getAvatarUrl() : "")));
        redisTemplate.opsForHash().putAll(metaKey, meta);
        redisTemplate.expire(metaKey, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

        // 写入 members:active 和 members:archive
        upsertActiveMember(room.getId(), ownerId, owner.getNickname(), owner.getAvatarUrl());
        upsertArchiveMember(room.getId(), ownerId, owner.getNickname(), owner.getAvatarUrl());

        // 初始化排行榜 ZSet，房主初始 0 分（确保 0 分成员也能出现在排行榜）
        String scoresKey = "sr:room:" + roomId + ":scores";
        redisTemplate.opsForZSet().add(scoresKey, String.valueOf(ownerId), 0);
        redisTemplate.expire(scoresKey, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);

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

        // 本局录模式：初始化 roundConfig
        if (ScoreMode.ROUND_RECORD.getCode() == room.getScoreMode() && req != null) {
            String configKey = "sr:room:" + roomId + ":roundConfig";
            Map<String, String> config = new HashMap<>();
            config.put("autoTimeoutSeconds", String.valueOf(req.getAutoTimeoutSeconds() != null ? req.getAutoTimeoutSeconds() : 30));
            config.put("autoTimeoutAction", String.valueOf(req.getAutoTimeoutAction() != null ? req.getAutoTimeoutAction() : 1));
            redisTemplate.opsForHash().putAll(configKey, config);
            redisTemplate.expire(configKey, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
        }
    }

    private String getQrCodeUrlFromRedis(String roomNo) {
        return redisTemplate.opsForValue().get("sr:room:" + roomNo + ":qr");
    }

    private void generateQrCodeAsync(String roomNo) {
        CompletableFuture.runAsync(() -> {
            try {
                String url = generateQrCode(roomNo);
                if (url != null) {
                    redisTemplate.opsForValue().set("sr:room:" + roomNo + ":qr", url, ROOM_EXPIRE_HOURS, TimeUnit.HOURS);
                    log.info("异步生成二维码成功: roomNo={}", roomNo);
                } else {
                    log.warn("异步生成二维码失败: roomNo={}", roomNo);
                }
            } catch (Exception e) {
                log.error("异步生成二维码异常: roomNo={}", roomNo, e);
            }
        }, asyncExecutor);
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
        Set<Long> userIds = members.stream().map(RoomMember::getUserId).collect(Collectors.toSet());
        Map<Long, String> nicknameMap = new HashMap<>();
        Map<Long, String> avatarUrlMap = new HashMap<>();
        for (Long uid : userIds) {
            String userKey = "sr:user:" + uid;
            String userJson = redisTemplate.opsForValue().get(userKey);
            if (userJson != null) {
                JSONObject userObj = JSONUtil.parseObj(userJson);
                nicknameMap.put(uid, userObj.getStr("nickname", ""));
                avatarUrlMap.put(uid, buildFullUrl(userObj.getStr("avatarUrl", "")));
            } else {
                User u = userMapper.selectById(uid);
                nicknameMap.put(uid, u != null ? u.getNickname() : "");
                avatarUrlMap.put(uid, u != null ? buildFullUrl(u.getAvatarUrl()) : "");
            }
        }

        List<RoomResp.MemberVO> memberVOs = members.stream().map(m ->
                RoomResp.MemberVO.builder()
                        .userId(m.getUserId())
                        .nickname(nicknameMap.getOrDefault(m.getUserId(), ""))
                        .avatarUrl(avatarUrlMap.getOrDefault(m.getUserId(), ""))
                        .build()
        ).collect(Collectors.toList());

        // 读取 roundConfig（仅本局录模式）
        Integer autoTimeoutSeconds = null;
        Integer autoTimeoutAction = null;
        if (ScoreMode.ROUND_RECORD.getCode() == (room.getScoreMode() != null ? room.getScoreMode() : 1)) {
            String configKey = "sr:room:" + room.getId() + ":roundConfig";
            String seconds = (String) redisTemplate.opsForHash().get(configKey, "autoTimeoutSeconds");
            String action = (String) redisTemplate.opsForHash().get(configKey, "autoTimeoutAction");
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
        if (objectKey.startsWith("http")) return objectKey;
        return "https://" + ossConfig.getBucketName() + "." + ossConfig.getEndpoint() + "/" + objectKey;
    }
}
