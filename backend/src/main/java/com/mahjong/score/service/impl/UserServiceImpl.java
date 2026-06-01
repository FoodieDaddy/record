package com.mahjong.score.service.impl;

import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.mahjong.score.common.BizException;
import com.mahjong.score.config.interceptor.JwtInterceptor;
import com.mahjong.score.dto.user.LoginReq;
import com.mahjong.score.dto.user.LoginResp;
import com.mahjong.score.dto.user.UserInfoResp;
import com.mahjong.score.entity.User;
import com.mahjong.score.mapper.UserMapper;
import com.mahjong.score.service.UserService;
import com.mahjong.score.util.JwtUtil;
import com.mahjong.score.util.SnowflakeIdGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;
    private final SnowflakeIdGenerator idGenerator;
    private final JwtUtil jwtUtil;
    private final StringRedisTemplate redisTemplate;

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
            user.setNickname(req.getNickname() != null ? req.getNickname() : "玩家");
            user.setAvatarUrl(req.getAvatarUrl() != null ? req.getAvatarUrl() : "");
            userMapper.insert(user);
        } else {
            // 更新昵称和头像（如果有传入）
            if (req.getNickname() != null || req.getAvatarUrl() != null) {
                if (req.getNickname() != null) user.setNickname(req.getNickname());
                if (req.getAvatarUrl() != null) user.setAvatarUrl(req.getAvatarUrl());
                userMapper.updateById(user);
            }
        }

        // 3. 签发 JWT
        String token = jwtUtil.generateToken(user.getId());

        return LoginResp.builder()
                .token(token)
                .userId(user.getId())
                .nickname(user.getNickname())
                .avatarUrl(user.getAvatarUrl())
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
                .avatarUrl(user.getAvatarUrl())
                .build();
    }

    @Override
    public void updateUserInfo(Long userId, String nickname, String avatarUrl) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException("用户不存在");
        }
        if (nickname != null) user.setNickname(nickname);
        if (avatarUrl != null) user.setAvatarUrl(avatarUrl);
        userMapper.updateById(user);
    }
}
