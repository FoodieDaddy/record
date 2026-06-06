package com.smartrecord.service.impl;

import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.config.interceptor.JwtInterceptor;
import com.smartrecord.dto.user.*;
import com.smartrecord.entity.User;
import com.smartrecord.entity.UserDetail;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.config.OssConfig;
import com.smartrecord.mapper.UserDetailMapper;
import com.smartrecord.mapper.UserMapper;
import com.smartrecord.service.StorageService;
import com.smartrecord.service.UserService;
import com.smartrecord.service.impl.ws.ScoreWebSocket;
import com.smartrecord.util.AvatarGenerator;
import com.smartrecord.util.JwtUtil;
import com.smartrecord.util.NicknameGenerator;
import com.smartrecord.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;
    private final UserDetailMapper userDetailMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final RoomMapper roomMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final JwtUtil jwtUtil;
    private final StringRedisTemplate redisTemplate;
    private final ScoreWebSocket scoreWebSocket;
    private final StorageService storageService;
    private final OssConfig ossConfig;
    private final AvatarGenerator avatarGenerator;
    private final TransactionTemplate transactionTemplate;

    @Value("${wechat.appid:}")
    private String appId;

    @Value("${wechat.secret:}")
    private String appSecret;

    @Override
    public LoginResp login(LoginReq req) {
        // 1. 调用微信 code2session
        String url = String.format(
                "https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
                appId, appSecret, req.getCode());
        String respStr = HttpUtil.get(url);
        JSONObject resp = JSONUtil.parseObj(respStr);

        String openid = resp.getStr("openid");
        if (openid == null) {
            log.error("微信登录失败: {}", respStr);
            throw new BizException("微信登录失败");
        }

        // 2. 查找或创建用户
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getOpenid, openid));

        if (user != null) {
            // 检查账号状态
            if (user.getStatus() != null && user.getStatus() == 1) {
                throw new BizException(4003, "账号已被封禁");
            }
            if (user.getStatus() != null && user.getStatus() == 2) {
                throw new BizException(4003, "账号已注销");
            }
        }

        if (user == null) {
            user = new User();
            user.setId(idGenerator.nextId());
            user.setOpenid(openid);
            user.setUnionid(resp.getStr("unionid"));
            user.setNickname(truncateNickname(NicknameGenerator.generateRandomName()));
            user.setAvatarUrl(avatarGenerator.generateAndUpload());
            final User newUser = user;
            transactionTemplate.executeWithoutResult(status -> {
                userMapper.insert(newUser);
                UserDetail detail = new UserDetail();
                detail.setId(newUser.getId());
                userDetailMapper.insert(detail);
            });
        }

        // 3. 缓存用户信息到 Redis
        String userKey = "sr:user:" + user.getId();
        String userJson = JSONUtil.toJsonStr(Map.of(
                "userId", user.getId(),
                "nickname", user.getNickname(),
                "avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : "",
                "status", user.getStatus() != null ? user.getStatus() : 0));
        redisTemplate.opsForValue().set(userKey, userJson, 24, TimeUnit.HOURS);

        // 4. 签发 JWT
        String token = jwtUtil.generateToken(user.getId());

        return LoginResp.builder()
                .token(token)
                .userId(user.getId())
                .nickname(user.getNickname())
                .avatarUrl(storageService.buildFullUrl(user.getAvatarUrl()))
                .build();
    }

    @Override
    public UserInfoResp getUserInfo(Long userId) {
        // 优先读 Redis 缓存，避免每次打开"我的"页面都查库
        String cacheKey = "sr:user:info:" + userId;
        String cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            JSONObject obj = JSONUtil.parseObj(cached);
            return UserInfoResp.builder()
                    .userId(obj.getLong("userId"))
                    .nickname(obj.getStr("nickname"))
                    .avatarUrl(obj.getStr("avatarUrl"))
                    .createdAt(obj.getStr("createdAt"))
                    .userDetail(getUserDetail(userId))
                    .build();
        }

        // 缓存未命中，查库并回写
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException(4001, "用户不存在");
        }
        String fullAvatarUrl = storageService.buildFullUrl(user.getAvatarUrl());

        // 写入缓存（24 小时 TTL）
        String createdAtStr = user.getCreatedAt() != null
                ? user.getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                : "";
        String json = JSONUtil.toJsonStr(Map.of(
                "userId", userId,
                "nickname", user.getNickname() != null ? user.getNickname() : "",
                "avatarUrl", fullAvatarUrl != null ? fullAvatarUrl : "",
                "createdAt", createdAtStr));
        redisTemplate.opsForValue().set(cacheKey, json, 24, TimeUnit.HOURS);

        return UserInfoResp.builder()
                .userId(user.getId())
                .nickname(user.getNickname())
                .avatarUrl(fullAvatarUrl)
                .createdAt(createdAtStr)
                .userDetail(getUserDetail(userId))
                .build();
    }

    @Override
    public void updateUserInfo(Long userId, String nickname, String avatarUrl) {
        // 从 Redis 缓存读取旧信息，避免 SELECT 查询
        String userKey = "sr:user:" + userId;
        String cachedJson = redisTemplate.opsForValue().get(userKey);
        String oldAvatarUrl = null;
        String oldNickname = null;
        int oldStatus = 0;
        if (cachedJson != null) {
            JSONObject obj = JSONUtil.parseObj(cachedJson);
            oldAvatarUrl = obj.getStr("avatarUrl", "");
            oldNickname = obj.getStr("nickname", "");
            oldStatus = obj.getInt("status", 0);
        }

        // 头像变更时，异步删除旧的 OSS 文件
        String newAvatarUrl = avatarUrl != null ? avatarUrl : oldAvatarUrl;
        if (avatarUrl != null && oldAvatarUrl != null && !avatarUrl.equals(oldAvatarUrl)) {
            deleteOldAvatarAsync(oldAvatarUrl);
        }

        // 静默截断：防止绕过前端直接调接口传超长昵称
        String newNickname = nickname != null ? truncateNickname(nickname) : oldNickname;
        if (newNickname == null) {
            throw new BizException(4001, "用户不存在");
        }

        // 使用 LambdaUpdateWrapper 直接更新，省掉 SELECT
        LambdaUpdateWrapper<User> wrapper = new LambdaUpdateWrapper<User>()
                .eq(User::getId, userId)
                .set(nickname != null, User::getNickname, nickname)
                .set(avatarUrl != null, User::getAvatarUrl, avatarUrl)
                .set(User::getUpdatedAt, LocalDateTime.now());
        userMapper.update(null, wrapper);

        // 更新 Redis 缓存
        String userJson = JSONUtil.toJsonStr(Map.of(
                "userId", userId,
                "nickname", newNickname,
                "avatarUrl", newAvatarUrl != null ? newAvatarUrl : "",
                "status", oldStatus));
        redisTemplate.opsForValue().set(userKey, userJson, 24, TimeUnit.HOURS);

        // 淘汰 getUserInfo 缓存，强制下次读取回源数据库
        redisTemplate.delete("sr:user:info:" + userId);

        // 仅在昵称变更时推送 MEMBER_UPDATE；纯头像更新跳过（避免新用户登录时的冗余 room_member 查询）
        if (nickname != null) {
            pushMemberUpdateToRooms(userId, newNickname, newAvatarUrl);
        }
    }

    @Override
    public UserDetailResp getUserDetail(Long userId) {
        UserDetail detail = userDetailMapper.selectById(userId);
        return UserDetailResp.builder()
                .voiceEnabled(detail.getVoiceEnabled() == 1)
                .voiceId(detail.getVoiceId())
                .animEnabled(detail.getAnimEnabled() == 1)
                .vibrateEnabled(detail.getVibrateEnabled() == 1)
                .build();
    }

    @Override
    public void updateUserDetail(Long userId, UpdateUserDetailReq req) {
        LambdaUpdateWrapper<UserDetail> wrapper = new LambdaUpdateWrapper<UserDetail>()
                .eq(UserDetail::getId, userId)
                .set(req.getVoiceEnabled() != null, UserDetail::getVoiceEnabled, Boolean.TRUE.equals(req.getVoiceEnabled()) ? 1 : 0)
                .set(req.getVoiceId() != null, UserDetail::getVoiceId, req.getVoiceId())
                .set(req.getAnimEnabled() != null, UserDetail::getAnimEnabled, Boolean.TRUE.equals(req.getAnimEnabled()) ? 1 : 0)
                .set(req.getVibrateEnabled() != null, UserDetail::getVibrateEnabled, Boolean.TRUE.equals(req.getVibrateEnabled()) ? 1 : 0);
        userDetailMapper.update(null, wrapper);
        // 淘汰 getUserInfo 缓存（userDetail 嵌套在其中）
        redisTemplate.delete("sr:user:info:" + userId);
    }

    /**
     * 异步删除旧头像文件
     */
    private void deleteOldAvatarAsync(String objectKeyOrUrl) {
        if (objectKeyOrUrl == null || objectKeyOrUrl.isEmpty()) return;
        // 兼容完整 URL 和纯 objectKey 两种格式
        String key = objectKeyOrUrl;
        if (objectKeyOrUrl.startsWith("http")) {
            int idx = objectKeyOrUrl.indexOf("/images/");
            if (idx >= 0) {
                key = objectKeyOrUrl.substring(idx + 1);
            } else {
                return;
            }
        }
        if (key.startsWith("images/")) {
            storageService.deleteObjectAsync(key);
        }
    }

    /**
     * 截断昵称到最大 6 个中文宽度单位
     * CJK 字符 = 1 单位，其他字符 = 0.5 单位
     */
    private String truncateNickname(String nickname) {
        if (nickname == null) return null;
        double width = 0;
        int end = 0;
        for (int i = 0; i < nickname.length(); i++) {
            char ch = nickname.charAt(i);
            double cw = isCJK(ch) ? 1.0 : 0.5;
            if (width + cw > 6) break;
            width += cw;
            end = i + 1;
        }
        return nickname.substring(0, end);
    }

    private boolean isCJK(char ch) {
        return (ch >= 0x4E00 && ch <= 0x9FFF)
            || (ch >= 0x3400 && ch <= 0x4DBF)
            || (ch >= 0x3000 && ch <= 0x303F)
            || (ch >= 0xFF00 && ch <= 0xFFEF)
            || (ch >= 0x3040 && ch <= 0x309F)
            || (ch >= 0x30A0 && ch <= 0x30FF);
    }

    /**
     * 查找用户所在的所有活跃房间，推送 MEMBER_UPDATE 事件
     */
    private void pushMemberUpdateToRooms(Long userId, String nickname, String avatarUrl) {
        try {
            // 从 Redis 缓存获取用户所在的房间
            Set<String> roomIds = redisTemplate.opsForSet().members("sr:user:rooms:" + userId);
            if (roomIds == null || roomIds.isEmpty()) {
                // 降级查数据库
                List<RoomMember> memberships = roomMemberMapper.selectList(
                        new LambdaQueryWrapper<RoomMember>().eq(RoomMember::getUserId, userId));
                if (memberships == null || memberships.isEmpty()) return;
                roomIds = memberships.stream()
                        .map(m -> String.valueOf(m.getRoomId()))
                        .collect(Collectors.toSet());
            }

            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "MEMBER_UPDATE");
            pushData.put("userId", String.valueOf(userId));
            pushData.put("nickname", nickname);
            pushData.put("avatarUrl", avatarUrl != null ? avatarUrl : "");

            for (String roomIdStr : roomIds) {
                scoreWebSocket.pushToRoom(roomIdStr, pushData);
            }
        } catch (Exception e) {
            log.warn("推送 MEMBER_UPDATE 失败: userId={}", userId, e);
        }
    }
}
