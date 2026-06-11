package com.smartrecord.service.impl;

import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.alibaba.csp.sentinel.annotation.SentinelResource;
import com.alibaba.csp.sentinel.slots.block.BlockException;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.common.ErrorCode;
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
import com.smartrecord.util.JwtUtil;
import com.smartrecord.util.NicknameGenerator;
import com.smartrecord.util.SnowflakeIdGenerator;
import com.smartrecord.entity.UserAchievement;
import com.smartrecord.entity.Achievement;
import com.smartrecord.mapper.UserAchievementMapper;
import com.smartrecord.mapper.AchievementMapper;
import com.smartrecord.service.MirrorProfileService;
import com.smartrecord.service.MirrorStatsService;
import com.alicp.jetcache.Cache;
import com.alicp.jetcache.anno.CreateCache;
import com.alicp.jetcache.anno.CacheType;
import com.alicp.jetcache.anno.Cached;
import com.alicp.jetcache.anno.CacheInvalidate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.ArrayList;
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
    private final TransactionTemplate transactionTemplate;
    private final UserAchievementMapper userAchievementMapper;
    private final AchievementMapper achievementMapper;
    private final MirrorProfileService mirrorProfileService;
    private final MirrorStatsService mirrorStatsService;

    @CreateCache(name = "achievement:id:", cacheType = CacheType.BOTH, expire = 3600)
    private Cache<Long, Achievement> achievementCache;

    @Value("${wechat.appid:}")
    private String appId;

    @Value("${wechat.secret:}")
    private String appSecret;

    @Override
    @SentinelResource(value = "wx-login",
            blockHandler = "loginBlockHandler",
            fallback = "loginFallback")
    public LoginResp login(LoginReq req) {
        String openid;
        String unionid = null;
        
        if (req.getCode() != null && req.getCode().startsWith("dev_code_")) {
            // 本地开发与测试环境 Mock 登录：直接根据后缀匹配种子用户 openid
            String indexStr = req.getCode().replace("dev_code_", "");
            openid = "dev_openid_" + indexStr;
            log.info("[MOCK LOGIN] 触发本地开发环境 Mock 登录, code={}, openid={}", req.getCode(), openid);
        } else {
            // 1. 调用微信 code2session 线上真实登录
            String url = String.format(
                    "https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
                    appId, appSecret, req.getCode());
            String respStr = HttpUtil.get(url);
            JSONObject resp = JSONUtil.parseObj(respStr);

            openid = resp.getStr("openid");
            unionid = resp.getStr("unionid");
            if (openid == null) {
                log.error("微信登录失败: {}", respStr);
                throw new BizException(ErrorCode.WX_LOGIN_FAILED);
            }
        }

        // 2. 查找或创建用户
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getOpenid, openid));

        if (user != null) {
            // 检查账号状态
            if (user.getStatus() != null && user.getStatus() == 1) {
                throw new BizException(ErrorCode.ACCOUNT_BANNED);
            }
            if (user.getStatus() != null && user.getStatus() == 2) {
                throw new BizException(ErrorCode.ACCOUNT_LOGGED_OUT);
            }
        }

        if (user == null) {
            user = new User();
            user.setId(idGenerator.nextId());
            user.setOpenid(openid);
            user.setUnionid(unionid);
            user.setNickname(truncateNickname(NicknameGenerator.generateRandomName()));
            user.setAvatarUrl("");
            final User newUser = user;
            transactionTemplate.executeWithoutResult(status -> {
                userMapper.insert(newUser);
                UserDetail detail = new UserDetail();
                detail.setId(newUser.getId());
                userDetailMapper.insert(detail);
            });
        }

        // 3. 缓存用户信息到 Redis Hash（使用统一辅助方法，包含装扮字段）
        String userJson = buildUserJson(user);
        redisTemplate.opsForHash().put("sr:user:" + user.getId(), "info", userJson);

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
        String userKey = "sr:user:" + userId;
        Object cached = redisTemplate.opsForHash().get(userKey, "info");
        if (cached != null) {
            JSONObject obj = JSONUtil.parseObj((String) cached);
            String rawAvatar = obj.getStr("avatarUrl", "");
            return UserInfoResp.builder()
                    .userId(obj.getLong("userId"))
                    .nickname(obj.getStr("nickname"))
                    .avatarUrl(storageService.buildFullUrl(rawAvatar))
                    .createdAt(obj.getStr("createdAt", ""))
                    .userDetail(getUserDetail(userId))
                    .build();
        }

        // 缓存未命中，查库并回写（包含装扮字段）
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException(ErrorCode.IDENTITY_NOT_RECOGNIZED);
        }
        String json = buildUserJson(user);
        redisTemplate.opsForHash().put(userKey, "info", json);
        String createdAtStr = user.getCreatedAt() != null
                ? user.getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                : "";

        return UserInfoResp.builder()
                .userId(user.getId())
                .nickname(user.getNickname())
                .avatarUrl(storageService.buildFullUrl(user.getAvatarUrl()))
                .createdAt(createdAtStr)
                .userDetail(getUserDetail(userId))
                .build();
    }

    @Override
    public void updateUserInfo(Long userId, UpdateUserReq req) {
        // 从 Redis 缓存读取旧信息，避免 SELECT 查询
        String userKey = "sr:user:" + userId;
        Object cachedRaw = redisTemplate.opsForHash().get(userKey, "info");
        String cachedJson = cachedRaw != null ? (String) cachedRaw : null;
        String oldAvatarUrl = null;
        String oldNickname = null;
        int oldStatus = 0;
        String oldCreatedAt = "";
        if (cachedJson != null) {
            JSONObject obj = JSONUtil.parseObj(cachedJson);
            oldAvatarUrl = obj.getStr("avatarUrl", "");
            oldNickname = obj.getStr("nickname", "");
            oldStatus = obj.getInt("status", 0);
            oldCreatedAt = obj.getStr("createdAt", "");
        }

        String avatarUrl = req.getAvatarUrl();
        String nickname = req.getNickname();

        // 校验头像路径安全性
        if (avatarUrl != null && !avatarUrl.isEmpty()) {
            if (!avatarUrl.startsWith("cloud://") && !avatarUrl.startsWith("http://") && !avatarUrl.startsWith("https://")
                    && !avatarUrl.startsWith("avatars/") && !avatarUrl.startsWith("images/")) {
                throw new BizException(400, "非法头像路径");
            }
        }

        // 头像变更时，异步删除旧的 OSS 文件
        String newAvatarUrl = avatarUrl != null ? avatarUrl : oldAvatarUrl;
        if (avatarUrl != null && oldAvatarUrl != null && !avatarUrl.equals(oldAvatarUrl)) {
            deleteOldAvatarAsync(oldAvatarUrl);
        }

        // 静默截断：防止绕过前端直接调接口传超长昵称
        String newNickname = nickname != null ? truncateNickname(nickname) : oldNickname;
        if (newNickname == null) {
            throw new BizException(ErrorCode.IDENTITY_NOT_RECOGNIZED);
        }

        // 使用 LambdaUpdateWrapper 直接更新，省掉 SELECT
        LambdaUpdateWrapper<User> wrapper = new LambdaUpdateWrapper<User>()
                .eq(User::getId, userId)
                .set(nickname != null, User::getNickname, nickname)
                .set(avatarUrl != null, User::getAvatarUrl, avatarUrl)
                .set(User::getUpdatedAt, LocalDateTime.now());
        userMapper.update(null, wrapper);
        // 刷新缓存并推送 MEMBER_UPDATE 广播到该用户所在的所有活跃房间
        refreshUserCacheAndNotify(userId);
    }

    @Override
    @Cached(name = "user:detail:", key = "#userId", cacheType = CacheType.BOTH, expire = 3600)
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
    @CacheInvalidate(name = "user:detail:", key = "#userId")
    public void updateUserDetail(Long userId, UpdateUserDetailReq req) {
        LambdaUpdateWrapper<UserDetail> wrapper = new LambdaUpdateWrapper<UserDetail>()
                .eq(UserDetail::getId, userId)
                .set(req.getVoiceEnabled() != null, UserDetail::getVoiceEnabled, Boolean.TRUE.equals(req.getVoiceEnabled()) ? 1 : 0)
                .set(req.getVoiceId() != null, UserDetail::getVoiceId, req.getVoiceId())
                .set(req.getAnimEnabled() != null, UserDetail::getAnimEnabled, Boolean.TRUE.equals(req.getAnimEnabled()) ? 1 : 0)
                .set(req.getVibrateEnabled() != null, UserDetail::getVibrateEnabled, Boolean.TRUE.equals(req.getVibrateEnabled()) ? 1 : 0);
        userDetailMapper.update(null, wrapper);
    }

    /**
     * 异步删除旧头像文件
     */
    private void deleteOldAvatarAsync(String objectKeyOrUrl) {
        if (objectKeyOrUrl == null || objectKeyOrUrl.isEmpty()) return;
        // cloud:// fileID 由 CloudBase 管理，不走 OSS 删除
        if (objectKeyOrUrl.startsWith("cloud://")) return;
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
        if (key.startsWith("images/") || key.startsWith("avatars/")) {
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
     * Sentinel 限流降级 — 微信登录
     */
    public LoginResp loginBlockHandler(LoginReq req, BlockException ex) {
        log.warn("微信登录被限流: {}", ex.getRule());
        throw new BizException(ErrorCode.WX_LOGIN_FAILED.getCode(), "登录繁忙，请稍后重试");
    }

    public LoginResp loginFallback(LoginReq req, Throwable ex) {
        log.error("微信登录降级", ex);
        throw new BizException(ErrorCode.WX_LOGIN_FAILED.getCode(), "登录服务暂时不可用，请稍后重试");
    }

    /**
     * 刷新用户缓存（包括基本信息和当前装备的装扮）并广播通知成员更新。
     *
     * @param userId 用户 ID
     */
    @Override
    public void refreshUserCacheAndNotify(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            return;
        }
        String userJson = buildUserJson(user);
        redisTemplate.opsForHash().put("sr:user:" + userId, "info", userJson);

        // 获取当前已装备装扮进行广播
        JSONObject userObj = JSONUtil.parseObj(userJson);
        String equippedBadge = userObj.getStr("equippedBadge", "");
        String equippedAvatarBorder = userObj.getStr("equippedAvatarBorder", "");

        pushMemberUpdateToRooms(userId, user.getNickname(), storageService.buildFullUrl(user.getAvatarUrl()), equippedBadge, equippedAvatarBorder);
    }

    /**
     * 统一构建包含基本信息与当前装备装扮的 Redis 缓存 JSON。
     */
    private String buildUserJson(User user) {
        String createdAtStr = user.getCreatedAt() != null
                ? user.getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                : "";

        // 查询用户当前已装备（status = 1）的成就
        List<UserAchievement> userAchievements = userAchievementMapper.selectList(
                new LambdaQueryWrapper<UserAchievement>()
                        .eq(UserAchievement::getUserId, user.getId())
                        .eq(UserAchievement::getStatus, 1)
        );

        String equippedBadge = "";
        String equippedAvatarBorder = "";
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

        Map<String, Object> dataMap = new HashMap<>();
        dataMap.put("userId", user.getId());
        dataMap.put("nickname", user.getNickname() != null ? user.getNickname() : "");
        dataMap.put("avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : "");
        dataMap.put("status", user.getStatus() != null ? user.getStatus() : 0);
        dataMap.put("createdAt", createdAtStr);
        dataMap.put("equippedBadge", equippedBadge);
        dataMap.put("equippedAvatarBorder", equippedAvatarBorder);

        return JSONUtil.toJsonStr(dataMap);
    }

    /**
     * 查找用户所在的所有活跃房间，推送 MEMBER_UPDATE 事件，携带最新称号及头像框装扮。
     */
    private void pushMemberUpdateToRooms(Long userId, String nickname, String avatarUrl, String equippedBadge, String equippedAvatarBorder) {
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

            // 获取用户最新的 MBTI 称号和战绩统计
            String mbtiTitle = "";
            Integer mbtiCode = null;
            Map<String, Object> radarStats = new HashMap<>();
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
                log.warn("热同步资料获取用户画像失败: userId={}", userId, e);
            }

            try {
                var stats = mirrorStatsService.calculate(userId);
                if (stats != null && stats.getDimensions() != null) {
                    for (var d : stats.getDimensions()) {
                        radarStats.put(d.getKey(), d.getValue());
                    }
                }
            } catch (Exception e) {
                log.warn("热同步资料获取用户战绩统计失败: userId={}", userId, e);
            }

            JSONObject obj = JSONUtil.createObj()
                    .set("userId", userId)
                    .set("nickname", nickname != null ? nickname : "")
                    .set("avatarUrl", avatarUrl != null ? avatarUrl : "")
                    .set("equippedBadge", equippedBadge != null ? equippedBadge : "")
                    .set("equippedAvatarBorder", equippedAvatarBorder != null ? equippedAvatarBorder : "")
                    .set("mbtiTitle", mbtiTitle)
                    .set("mbtiCode", mbtiCode)
                    .set("radarStats", radarStats);

            Map<String, Object> pushData = new HashMap<>();
            pushData.put("type", "MEMBER_UPDATE");
            pushData.put("userId", String.valueOf(userId));
            pushData.put("nickname", nickname);
            pushData.put("avatarUrl", avatarUrl != null ? avatarUrl : "");
            pushData.put("equippedBadge", equippedBadge != null ? equippedBadge : "");
            pushData.put("equippedAvatarBorder", equippedAvatarBorder != null ? equippedAvatarBorder : "");
            pushData.put("mbtiTitle", mbtiTitle);
            pushData.put("mbtiCode", mbtiCode);
            pushData.put("radarStats", radarStats);

            for (String roomIdStr : roomIds) {
                String dataKey = "sr:room:" + roomIdStr + ":data";
                // 仅当房间仍然保留该活跃成员时才热更新，防止污染已结算封存的历史房间
                if (Boolean.TRUE.equals(redisTemplate.opsForHash().hasKey(dataKey, "a:" + userId))) {
                    redisTemplate.opsForHash().put(dataKey, "a:" + userId, obj.toString());
                }
                scoreWebSocket.pushToRoom(roomIdStr, pushData);
            }
        } catch (Exception e) {
            log.warn("推送 MEMBER_UPDATE 失败: userId={}", userId, e);
        }
    }

    /**
     * 获取用户生涯驾驶舱汇总数据（包括总场次、胜率、黄金拍档及宿敌画像）
     *
     * @param userId 用户 ID
     * @return 个人生涯汇总数据
     */
    @Override
    public CareerCockpitResp getCareerCockpit(Long userId) {
        if (userId == null) {
            return new CareerCockpitResp();
        }

        // 1. 查询当前用户历史所有已结算的对局成员记录 (finalScore 不为 null 代表已结算归档)
        List<RoomMember> myMemberships = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>()
                        .eq(RoomMember::getUserId, userId)
                        .isNotNull(RoomMember::getFinalScore)
        );

        if (myMemberships == null || myMemberships.isEmpty()) {
            return CareerCockpitResp.builder()
                    .totalRooms(0)
                    .totalScore(0)
                    .positiveRate(0.0)
                    .build();
        }

        int totalRooms = myMemberships.size();
        int totalScore = 0;
        int positiveRooms = 0;
        Set<Long> roomIds = new HashSet<>();
        // 记录我自己在每个房间的最终得分，便于后面共存分析时直接取，避免重复遍历
        Map<Long, Integer> myRoomScoreMap = new HashMap<>();

        for (RoomMember m : myMemberships) {
            int score = m.getFinalScore();
            totalScore += score;
            if (score > 0) {
                positiveRooms++;
            }
            roomIds.add(m.getRoomId());
            myRoomScoreMap.put(m.getRoomId(), score);
        }

        double positiveRate = Math.round(((double) positiveRooms / totalRooms * 100) * 10.0) / 10.0;

        // 2. 分析与我同局的所有其他玩家
        List<RoomMember> allCoMembers = roomMemberMapper.selectList(
                new LambdaQueryWrapper<RoomMember>()
                        .in(RoomMember::getRoomId, roomIds)
                        .ne(RoomMember::getUserId, userId)
                        .isNotNull(RoomMember::getFinalScore)
        );

        CareerCockpitResp.PartnerInfo bestPartner = null;
        CareerCockpitResp.PartnerInfo nemesis = null;

        if (allCoMembers != null && !allCoMembers.isEmpty()) {
            // 好友ID -> 好友参与的我所在的房间ID列表
            Map<Long, List<Long>> friendRoomsMap = new HashMap<>();
            for (RoomMember co : allCoMembers) {
                friendRoomsMap.computeIfAbsent(co.getUserId(), k -> new ArrayList<>()).add(co.getRoomId());
            }

            long bestFriendId = -1;
            double maxAvgScore = -Double.MAX_VALUE;
            int maxPlayCount = 0;

            long worstFriendId = -1;
            double minAvgScore = Double.MAX_VALUE;
            int worstPlayCount = 0;

            for (Map.Entry<Long, List<Long>> entry : friendRoomsMap.entrySet()) {
                Long friendId = entry.getKey();
                List<Long> sharedRoomIds = entry.getValue();
                int playCount = sharedRoomIds.size();

                // 计算共同游戏时，我方（userId）的平均得分
                double sumScore = 0;
                for (Long rid : sharedRoomIds) {
                    sumScore += myRoomScoreMap.getOrDefault(rid, 0);
                }
                double avgScore = Math.round((sumScore / playCount) * 10.0) / 10.0;

                // 黄金拍档判定：平均分最高（相同平均分则局数多者优先，且我方必须是平均正分）
                if (avgScore > maxAvgScore || (Math.abs(avgScore - maxAvgScore) < 0.001 && playCount > maxPlayCount)) {
                    maxAvgScore = avgScore;
                    maxPlayCount = playCount;
                    bestFriendId = friendId;
                }

                // 天命宿敌判定：平均分最低（相同平均分则局数多者优先）
                if (avgScore < minAvgScore || (Math.abs(avgScore - minAvgScore) < 0.001 && playCount > worstPlayCount)) {
                    minAvgScore = avgScore;
                    worstPlayCount = playCount;
                    worstFriendId = friendId;
                }
            }

            if (bestFriendId != -1) {
                String bestNickname = getUserNickname(bestFriendId);
                String bestAvatar = getUserAvatar(bestFriendId);
                bestPartner = CareerCockpitResp.PartnerInfo.builder()
                        .userId(bestFriendId)
                        .nickname(bestNickname)
                        .avatarUrl(storageService.buildFullUrl(bestAvatar))
                        .playCount(maxPlayCount)
                        .avgScore(maxAvgScore)
                        .build();
            }

            if (worstFriendId != -1) {
                String worstNickname = getUserNickname(worstFriendId);
                String worstAvatar = getUserAvatar(worstFriendId);
                nemesis = CareerCockpitResp.PartnerInfo.builder()
                        .userId(worstFriendId)
                        .nickname(worstNickname)
                        .avatarUrl(storageService.buildFullUrl(worstAvatar))
                        .playCount(worstPlayCount)
                        .avgScore(minAvgScore)
                        .build();
            }
        }

        return CareerCockpitResp.builder()
                .totalRooms(totalRooms)
                .totalScore(totalScore)
                .positiveRate(positiveRate)
                .bestPartner(bestPartner)
                .nemesis(nemesis)
                .build();
    }

    /**
     * 辅助获取用户昵称
     */
    private String getUserNickname(Long userId) {
        Object cached = redisTemplate.opsForHash().get("sr:user:" + userId, "info");
        if (cached != null) {
            JSONObject userObj = JSONUtil.parseObj((String) cached);
            return userObj.getStr("nickname", "未知成员");
        }
        User u = userMapper.selectById(userId);
        return u != null ? u.getNickname() : "未知成员";
    }

    /**
     * 辅助获取用户头像路径
     */
    private String getUserAvatar(Long userId) {
        Object cached = redisTemplate.opsForHash().get("sr:user:" + userId, "info");
        if (cached != null) {
            JSONObject userObj = JSONUtil.parseObj((String) cached);
            return userObj.getStr("avatarUrl", "");
        }
        User u = userMapper.selectById(userId);
        return u != null ? u.getAvatarUrl() : "";
    }
}
