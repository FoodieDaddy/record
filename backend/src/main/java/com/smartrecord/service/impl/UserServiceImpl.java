package com.smartrecord.service.impl;

import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.config.interceptor.JwtInterceptor;
import com.smartrecord.dto.user.LoginReq;
import com.smartrecord.dto.user.LoginResp;
import com.smartrecord.dto.user.UserInfoResp;
import com.smartrecord.entity.User;
import com.smartrecord.entity.Room;
import com.smartrecord.entity.RoomMember;
import com.smartrecord.mapper.RoomMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.config.OssConfig;
import com.smartrecord.mapper.UserMapper;
import com.smartrecord.service.StorageService;
import com.smartrecord.service.UserService;
import com.smartrecord.service.impl.ws.ScoreWebSocket;
import com.smartrecord.util.JwtUtil;
import com.smartrecord.util.NicknameGenerator;
import com.smartrecord.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

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
    private final RoomMemberMapper roomMemberMapper;
    private final RoomMapper roomMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final JwtUtil jwtUtil;
    private final StringRedisTemplate redisTemplate;
    private final ScoreWebSocket scoreWebSocket;
    private final StorageService storageService;
    private final OssConfig ossConfig;

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

        if (user == null) {
            user = new User();
            user.setId(idGenerator.nextId());
            user.setOpenid(openid);
            user.setUnionid(resp.getStr("unionid"));
            user.setNickname(req.getNickname() != null ? req.getNickname() : NicknameGenerator.generate());
            user.setAvatarUrl(req.getAvatarUrl() != null ? req.getAvatarUrl() : "");
            userMapper.insert(user);
        }

        // 3. 缓存用户信息到 Redis
        String userKey = "sr:user:" + user.getId();
        String userJson = JSONUtil.toJsonStr(Map.of(
                "userId", user.getId(),
                "nickname", user.getNickname(),
                "avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : ""));
        redisTemplate.opsForValue().set(userKey, userJson, 24, TimeUnit.HOURS);

        // 4. 签发 JWT
        String token = jwtUtil.generateToken(user.getId());

        return LoginResp.builder()
                .token(token)
                .userId(user.getId())
                .nickname(user.getNickname())
                .avatarUrl(buildFullUrl(user.getAvatarUrl()))
                .build();
    }

    @Override
    public UserInfoResp getUserInfo(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException("用户不存在");
        }
        return UserInfoResp.builder()
                .userId(user.getId())
                .nickname(user.getNickname())
                .avatarUrl(buildFullUrl(user.getAvatarUrl()))
                .build();
    }

    @Override
    public void updateUserInfo(Long userId, String nickname, String avatarUrl) {
        // 从 Redis 缓存读取旧信息，避免 SELECT 查询
        String userKey = "sr:user:" + userId;
        String cachedJson = redisTemplate.opsForValue().get(userKey);
        String oldAvatarUrl = null;
        String oldNickname = null;
        if (cachedJson != null) {
            JSONObject obj = JSONUtil.parseObj(cachedJson);
            oldAvatarUrl = obj.getStr("avatarUrl", "");
            oldNickname = obj.getStr("nickname", "");
        }

        // 头像变更时，异步删除旧的 OSS 文件
        String newAvatarUrl = avatarUrl != null ? avatarUrl : oldAvatarUrl;
        if (avatarUrl != null && oldAvatarUrl != null && !avatarUrl.equals(oldAvatarUrl)) {
            deleteOldAvatarAsync(oldAvatarUrl);
        }

        String newNickname = nickname != null ? nickname : oldNickname;
        if (newNickname == null) {
            throw new BizException("用户不存在");
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
                "avatarUrl", newAvatarUrl != null ? newAvatarUrl : ""));
        redisTemplate.opsForValue().set(userKey, userJson, 24, TimeUnit.HOURS);

        // 推送 MEMBER_UPDATE 给用户所在的活跃房间（携带更新后的昵称头像）
        pushMemberUpdateToRooms(userId, newNickname, newAvatarUrl);
    }

    /**
     * 将 objectKey 拼接为完整访问 URL
     */
    private String buildFullUrl(String objectKey) {
        if (objectKey == null || objectKey.isEmpty()) return "";
        if (objectKey.startsWith("http")) return objectKey; // 兼容旧数据
        return "https://" + ossConfig.getBucketName() + "." + ossConfig.getEndpoint() + "/" + objectKey;
    }

    /**
     * 异步删除旧头像文件
     */
    private void deleteOldAvatarAsync(String objectKey) {
        if (objectKey == null || objectKey.isEmpty()) return;
        if (objectKey.startsWith("images/")) {
            storageService.deleteObjectAsync(objectKey);
        }
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
