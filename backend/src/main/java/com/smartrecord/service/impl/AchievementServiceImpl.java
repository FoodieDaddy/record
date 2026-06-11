package com.smartrecord.service.impl;

import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.smartrecord.common.BizException;
import com.smartrecord.common.ErrorCode;
import com.smartrecord.dto.achievement.UserAchievementResp;
import com.smartrecord.entity.Achievement;
import com.smartrecord.entity.UserAchievement;
import com.smartrecord.mapper.AchievementMapper;
import com.smartrecord.mapper.RoomMemberMapper;
import com.smartrecord.mapper.UserAchievementMapper;
import com.smartrecord.service.AchievementService;
import com.smartrecord.service.UserService;
import com.alicp.jetcache.anno.CacheType;
import com.alicp.jetcache.anno.Cached;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.Shape;
import java.awt.RenderingHints;
import java.awt.geom.Ellipse2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.URL;
import javax.imageio.ImageIO;

/**
 * 智能记分器成就系统服务实现类。
 * 负责在战局结算后，基于异步线程池对玩家在单局或历史的表现进行扫描，
 * 评估是否达成逆熵翻盘、星区领航员、慷慨信使或超导连接者等成就并进行发放。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AchievementServiceImpl implements AchievementService {

    private final UserAchievementMapper userAchievementMapper;
    private final RoomMemberMapper roomMemberMapper;
    private final AchievementMapper achievementMapper;
    private final UserService userService;
    private final com.smartrecord.mapper.UserMapper userMapper;

    @Override
    @Cached(name = "achievement:id:", key = "#achievementId", cacheType = CacheType.BOTH, expire = 3600)
    public Achievement getCachedAchievementById(Long achievementId) {
        if (achievementId == null) {
            return null;
        }
        return achievementMapper.selectById(achievementId);
    }

    @Override
    @Cached(name = "achievement:all", cacheType = CacheType.BOTH, expire = 3600)
    public List<Achievement> getCachedAllAchievements() {
        return achievementMapper.selectList(null);
    }

    @Override
    public void scanAndAward(Long userId, Long roomId, List<Map<String, Object>> allRecord, Map<Long, Integer> playerTotalMap) {
        if (userId == null || allRecord == null || allRecord.isEmpty()) {
            return;
        }

        try {
            log.info("开始对用户 {} 执行结算成就扫描: roomId={}", userId, roomId);

            // 1. 判定【成就 6001：逆熵翻盘者】
            // 规则：单局积分轨迹曾跌入负分（<0），但最终结算以正分（>0）完赛
            checkAndAwardEntropyFlipper(userId, allRecord, playerTotalMap);

            // 2. 判定【成就 6002：星区领航员】
            // 规则：累计在 5 场已结算的战局中荣获第 1 名且分数为正
            checkAndAwardApexPilot(userId);

            // 3. 判定【成就 6003：慷慨信使】
            // 规则：单局主动转账给他人记分的次数达到 15 次以上
            checkAndAwardGenerousEnvoy(userId, allRecord);

            // 4. 判定【成就 6004：超导连接者】
            // 规则：单局主动转账互动的去重接收人数达到 5 人及以上
            checkAndAwardSuperconductor(userId, allRecord);

        } catch (Exception e) {
            log.error("用户 {} 结算成就判定过程中发生异常: roomId={}", userId, roomId, e);
        }
    }

    /**
     * 判定逆熵翻盘者（成就 6001L）
     */
    @SuppressWarnings("unchecked")
    private void checkAndAwardEntropyFlipper(Long userId, List<Map<String, Object>> allRecord, Map<Long, Integer> playerTotalMap) {
        int currentCumulative = 0;
        boolean everNegative = false;

        // 还原玩家在整场战局中的积分累计走势
        for (Map<String, Object> batch : allRecord) {
            List<Map<String, Object>> scores = (List<Map<String, Object>>) batch.get("scores");
            if (scores == null) continue;

            for (Map<String, Object> ps : scores) {
                if (userId.equals(((Number) ps.get("userId")).longValue())) {
                    currentCumulative += ((Number) ps.get("score")).intValue();
                    if (currentCumulative < 0) {
                        everNegative = true;
                    }
                }
            }
        }

        // 最终积分为正数，且过程中曾经为负值，则判定达成
        Integer finalScore = playerTotalMap.get(userId);
        if (everNegative && finalScore != null && finalScore > 0) {
            log.info("用户 {} 达成【逆熵翻盘者】条件（过程曾负分且最终正分结算）", userId);
            awardAchievement(userId, 6001L);
        }
    }

    /**
     * 判定星区领航员（成就 6002L）
     */
    private void checkAndAwardApexPilot(Long userId) {
        // 统计该用户历史荣获第 1 名的已结算对局数
        int firstPlaceCount = roomMemberMapper.countFirstPlaceRooms(userId);
        if (firstPlaceCount >= 5) {
            log.info("用户 {} 达成【星区领航员】条件（累计获得 {} 次战局第一名）", userId, firstPlaceCount);
            awardAchievement(userId, 6002L);
        }
    }

    /**
     * 判定慷慨信使（成就 6003L）
     */
    @SuppressWarnings("unchecked")
    private void checkAndAwardGenerousEnvoy(Long userId, List<Map<String, Object>> allRecord) {
        int sendCount = 0;

        // 扫描归档中的 transferEvents 列表，统计主动转账发生次数
        for (Map<String, Object> batch : allRecord) {
            Object teObj = batch.get("transferEvents");
            if (!(teObj instanceof List)) continue;

            List<Map<String, Object>> transfers = (List<Map<String, Object>>) teObj;
            for (Map<String, Object> evt : transfers) {
                long fromId = ((Number) evt.get("from")).longValue();
                int amount = ((Number) evt.get("amount")).intValue();
                if (userId.equals(fromId) && amount > 0) {
                    sendCount++;
                }
            }
        }

        if (sendCount >= 15) {
            log.info("用户 {} 达成【慷慨信使】条件（单场转账发起次数达 {} 次）", userId, sendCount);
            awardAchievement(userId, 6003L);
        }
    }

    /**
     * 判定超导连接者（成就 6004L）
     */
    @SuppressWarnings("unchecked")
    private void checkAndAwardSuperconductor(Long userId, List<Map<String, Object>> allRecord) {
        Set<Long> receivers = new HashSet<>();

        // 统计主动记分转账的去重接收人数量
        for (Map<String, Object> batch : allRecord) {
            Object teObj = batch.get("transferEvents");
            if (!(teObj instanceof List)) continue;

            List<Map<String, Object>> transfers = (List<Map<String, Object>>) teObj;
            for (Map<String, Object> evt : transfers) {
                long fromId = ((Number) evt.get("from")).longValue();
                long toId = ((Number) evt.get("to")).longValue();
                int amount = ((Number) evt.get("amount")).intValue();
                if (userId.equals(fromId) && amount > 0) {
                    receivers.add(toId);
                }
            }
        }

        if (receivers.size() >= 5) {
            log.info("用户 {} 达成【超导连接者】条件（去重互动收款人数量达 {} 个）", userId, receivers.size());
            awardAchievement(userId, 6004L);
        }
    }

    /**
     * 为用户解锁发放指定成就（幂等写入）
     */
    private void awardAchievement(Long userId, Long achievementId) {
        synchronized (String.valueOf(userId).intern()) {
            UserAchievement existing = userAchievementMapper.selectOne(
                    new LambdaQueryWrapper<UserAchievement>()
                            .eq(UserAchievement::getUserId, userId)
                            .eq(UserAchievement::getAchievementId, achievementId));

            if (existing == null) {
                UserAchievement record = new UserAchievement();
                record.setUserId(userId);
                record.setAchievementId(achievementId);
                record.setStatus(0); // 默认已解锁但未装备
                record.setUnlockedAt(LocalDateTime.now());
                userAchievementMapper.insert(record);
                log.info("🎉 成功为用户 {} 发放新成就: {}", userId, achievementId);
            }
        }
    }

    /**
     * 获取用户当前装备的个性化装扮（称号标识、头像框皮肤等）。
     *
     * @param userId 用户 ID
     * @return 包含已装备装扮的 Map，键为 "equippedBadge" 和 "equippedAvatarBorder"
     */
    @Override
    public Map<String, String> getEquippedCosmetics(Long userId) {
        Map<String, String> cosmetics = new HashMap<>();
        cosmetics.put("equippedBadge", "");
        cosmetics.put("equippedAvatarBorder", "");
        if (userId == null) {
            return cosmetics;
        }

        // 查询用户当前所有已装备（status = 1）的成就记录
        List<UserAchievement> userAchievements = userAchievementMapper.selectList(
                new LambdaQueryWrapper<UserAchievement>()
                        .eq(UserAchievement::getUserId, userId)
                        .eq(UserAchievement::getStatus, 1)
        );

        for (UserAchievement ua : userAchievements) {
            Achievement achievement = getCachedAchievementById(ua.getAchievementId());
            if (achievement != null && achievement.getCosmeticPayload() != null) {
                try {
                    JSONObject payload = JSONUtil.parseObj(achievement.getCosmeticPayload());
                    if (achievement.getCosmeticType() == 1) { // 称号标识
                        cosmetics.put("equippedBadge", payload.getStr("badge", ""));
                    } else if (achievement.getCosmeticType() == 2) { // 头像框
                        cosmetics.put("equippedAvatarBorder", payload.getStr("avatarBorder", ""));
                    }
                } catch (Exception e) {
                    log.error("解析用户装备的装扮参数失败: achievementId={}", achievement.getId(), e);
                }
            }
        }
        return cosmetics;
    }

    /**
     * 获取用户的成就列表（包括所有系统内置成就，标识已解锁和装备状态）。
     *
     * @param userId 用户 ID
     * @return 用户成就列表 DTO
     */
    @Override
    public List<UserAchievementResp> getUserAchievements(Long userId) {
        // 1. 查询系统内所有的内置成就配置
        List<Achievement> allAchievements = getCachedAllAchievements();
        if (allAchievements == null || allAchievements.isEmpty()) {
            return Collections.emptyList();
        }

        // 2. 查询用户已经解锁达成的所有成就记录
        Map<Long, UserAchievement> userAwardedMap = new HashMap<>();
        if (userId != null) {
            List<UserAchievement> userAwarded = userAchievementMapper.selectList(
                    new LambdaQueryWrapper<UserAchievement>().eq(UserAchievement::getUserId, userId)
            );
            if (userAwarded != null) {
                for (UserAchievement ua : userAwarded) {
                    userAwardedMap.put(ua.getAchievementId(), ua);
                }
            }
        }

        // 3. 组装响应列表
        List<UserAchievementResp> respList = new ArrayList<>();
        for (Achievement ach : allAchievements) {
            UserAchievement ua = userAwardedMap.get(ach.getId());
            UserAchievementResp.UserAchievementRespBuilder builder = UserAchievementResp.builder()
                    .id(ach.getId())
                    .name(ach.getName())
                    .description(ach.getDescription())
                    .cosmeticType(ach.getCosmeticType())
                    .cosmeticPayload(ach.getCosmeticPayload())
                    .unlocked(ua != null ? 1 : 0)
                    .status(ua != null ? ua.getStatus() : 0)
                    .unlockedAt(ua != null ? ua.getUnlockedAt() : null);
            respList.add(builder.build());
        }
        return respList;
    }

    /**
     * 装备指定成就所赠送的装扮。
     * 装备时会自动更新数据库状态、清空同类型装扮的其他装备，刷新 Redis 缓存并广播 WS 状态。
     *
     * @param userId        用户 ID
     * @param achievementId 成就 ID
     */
    @Override
    public void equipCosmetic(Long userId, Long achievementId) {
        if (userId == null || achievementId == null) {
            throw new BizException(400, "用户ID和成就ID不能为空");
        }

        // 1. 确认成就存在
        Achievement targetAchievement = getCachedAchievementById(achievementId);
        if (targetAchievement == null) {
            throw new BizException(404, "未找到该成就配置");
        }

        // 2. 确认该成就拥有装扮奖励
        if (targetAchievement.getCosmeticType() == 0 || targetAchievement.getCosmeticPayload() == null) {
            throw new BizException(400, "该成就未提供可装备的装扮奖励");
        }

        // 3. 确认用户已达成/解锁该成就
        UserAchievement userAchievement = userAchievementMapper.selectOne(
                new LambdaQueryWrapper<UserAchievement>()
                        .eq(UserAchievement::getUserId, userId)
                        .eq(UserAchievement::getAchievementId, achievementId)
        );
        if (userAchievement == null) {
            throw new BizException(403, "您尚未解锁该成就，无法装备其奖励装扮");
        }

        // 如果已经是装备状态，直接返回
        if (userAchievement.getStatus() == 1) {
            return;
        }

        // 4. 同类型装扮互斥处理：卸下用户当前已装备的同类装扮
        // 先找出系统内所有与该成就同 cosmeticType 的成就 ID 列表
        List<Achievement> peerAchievements = achievementMapper.selectList(
                new LambdaQueryWrapper<Achievement>()
                        .eq(Achievement::getCosmeticType, targetAchievement.getCosmeticType())
        );

        if (peerAchievements != null && !peerAchievements.isEmpty()) {
            List<Long> peerIds = new ArrayList<>();
            for (Achievement pa : peerAchievements) {
                peerIds.add(pa.getId());
            }

            // 将这些同类型成就已装备状态（status = 1）全部更新为未装备（status = 0）
            LambdaUpdateWrapper<UserAchievement> unequipWrapper = new LambdaUpdateWrapper<UserAchievement>()
                    .eq(UserAchievement::getUserId, userId)
                    .in(UserAchievement::getAchievementId, peerIds)
                    .set(UserAchievement::getStatus, 0);
            userAchievementMapper.update(null, unequipWrapper);
        }

        // 5. 装备当前成就的奖励
        LambdaUpdateWrapper<UserAchievement> equipWrapper = new LambdaUpdateWrapper<UserAchievement>()
                .eq(UserAchievement::getUserId, userId)
                .eq(UserAchievement::getAchievementId, achievementId)
                .set(UserAchievement::getStatus, 1);
        userAchievementMapper.update(null, equipWrapper);

        log.info("用户 {} 装备了成就 {} 的个性化装扮", userId, achievementId);

        // 6. 热同步：重新计算写入 Redis 并向活跃房间内所有人推送 MEMBER_UPDATE
        userService.refreshUserCacheAndNotify(userId);
    }

    /**
     * 卸下指定成就所赠送的装扮。
     * 卸下后更新数据库状态，刷新 Redis 缓存并广播 WS 状态。
     *
     * @param userId        用户 ID
     * @param achievementId 成就 ID
     */
    @Override
    public void unequipCosmetic(Long userId, Long achievementId) {
        if (userId == null || achievementId == null) {
            throw new BizException(400, "用户ID和成就ID不能为空");
        }

        // 1. 确认该成就存在并已解锁
        UserAchievement userAchievement = userAchievementMapper.selectOne(
                new LambdaQueryWrapper<UserAchievement>()
                        .eq(UserAchievement::getUserId, userId)
                        .eq(UserAchievement::getAchievementId, achievementId)
        );
        if (userAchievement == null) {
            throw new BizException(400, "尚未达成该成就");
        }

        // 如果本来就是未装备状态，直接返回
        if (userAchievement.getStatus() == 0) {
            return;
        }

        // 2. 卸下装扮（status 置为 0）
        LambdaUpdateWrapper<UserAchievement> unequipWrapper = new LambdaUpdateWrapper<UserAchievement>()
                .eq(UserAchievement::getUserId, userId)
                .eq(UserAchievement::getAchievementId, achievementId)
                .set(UserAchievement::getStatus, 0);
        userAchievementMapper.update(null, unequipWrapper);

        log.info("用户 {} 卸下了成就 {} 的个性化装扮", userId, achievementId);

        // 3. 热同步：更新缓存并向房间成员推送通知
        userService.refreshUserCacheAndNotify(userId);
    }

    /**
     * 为用户生成专属的成就达成卡片海报（直接输出 PNG 字节数据）
     *
     * @param userId        用户 ID
     * @param achievementId 成就 ID
     * @return 绘制完成的海报 PNG 图片字节数组
     */
    @Override
    public byte[] generateAchievementPoster(Long userId, Long achievementId) {
        if (userId == null || achievementId == null) {
            throw new BizException(400, "用户ID和成就ID不能为空");
        }

        // 1. 确认该成就存在并已被用户达成解锁
        Achievement ach = getCachedAchievementById(achievementId);
        if (ach == null) {
            throw new BizException(404, "未找到该成就配置");
        }

        UserAchievement ua = userAchievementMapper.selectOne(
                new LambdaQueryWrapper<UserAchievement>()
                        .eq(UserAchievement::getUserId, userId)
                        .eq(UserAchievement::getAchievementId, achievementId)
        );
        if (ua == null) {
            throw new BizException(403, "尚未解锁该成就，无法生成纪念海报");
        }

        // 2. 获取用户最新基本资料
        com.smartrecord.dto.user.UserInfoResp userInfo = userService.getUserInfo(userId);
        String nickname = userInfo != null ? userInfo.getNickname() : "记分玩家";
        String avatarUrl = userInfo != null ? userInfo.getAvatarUrl() : "";

        // 3. 构建高画质图片缓冲区 (400 x 600)
        BufferedImage image = new BufferedImage(400, 600, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();

        try {
            // 启用抗锯齿与文本平滑渲染
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            // A. 绘制科幻暗调星空渐变背景 (#0F172A 到 #1E1B4B)
            GradientPaint cardBg = new GradientPaint(10, 10, new Color(15, 23, 42), 390, 590, new Color(30, 27, 75));
            g.setPaint(cardBg);
            g.fillRoundRect(10, 10, 380, 580, 28, 28);

            // B. 绘制暗金色流光发光卡片双层边框
            GradientPaint borderPaint = new GradientPaint(10, 10, new Color(212, 175, 55, 180), 390, 590, new Color(120, 90, 20, 80));
            g.setPaint(borderPaint);
            g.setStroke(new BasicStroke(3));
            g.drawRoundRect(10, 10, 380, 580, 28, 28);
            g.setStroke(new BasicStroke(1));
            g.setColor(new Color(255, 255, 255, 20));
            g.drawRoundRect(14, 14, 372, 572, 24, 24);

            // C. 绘制顶部质感横幅标题
            g.setFont(new Font("SansSerif", Font.BOLD, 14));
            g.setColor(new Color(230, 210, 140, 180));
            FontMetrics topFm = g.getFontMetrics();
            String titleText = "★  星 轨 成 就 纪 念 册  ★";
            g.drawString(titleText, 200 - topFm.stringWidth(titleText) / 2, 55);

            // D. 尝试加载并渲染圆形玩家头像（剪切蒙版）
            boolean avatarLoaded = false;
            Image avatarImg = null;
            if (avatarUrl != null && !avatarUrl.isEmpty() && (avatarUrl.startsWith("http") || avatarUrl.startsWith("https"))) {
                try {
                    avatarImg = ImageIO.read(new URL(avatarUrl));
                    avatarLoaded = true;
                } catch (Exception e) {
                    log.warn("海报渲染下载用户头像失败: avatarUrl={}", avatarUrl, e);
                }
            }

            int avatarX = 160;
            int avatarY = 95;
            int avatarSize = 80;

            if (avatarLoaded && avatarImg != null) {
                // 保存原剪切板
                Shape originalClip = g.getClip();
                // 剪切为圆形区域
                g.setClip(new Ellipse2D.Double(avatarX, avatarY, avatarSize, avatarSize));
                g.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize, null);
                // 还原剪切板
                g.setClip(originalClip);
            } else {
                // 兜底绘制纯色头像框块（画上一个带昵称首字母的圆形）
                g.setColor(new Color(212, 175, 55, 80));
                g.fillOval(avatarX, avatarY, avatarSize, avatarSize);
                g.setColor(Color.WHITE);
                g.setFont(new Font("SansSerif", Font.BOLD, 28));
                FontMetrics capFm = g.getFontMetrics();
                String firstChar = nickname.isEmpty() ? "P" : nickname.substring(0, 1);
                g.drawString(firstChar, 200 - capFm.stringWidth(firstChar) / 2, 145);
            }

            // 绘制头像圈的金色描边圈环
            g.setStroke(new BasicStroke(2));
            g.setColor(new Color(212, 175, 55, 200));
            g.drawOval(avatarX - 1, avatarY - 1, avatarSize + 2, avatarSize + 2);
            g.setStroke(new BasicStroke(1));

            // E. 绘制玩家昵称
            g.setFont(new Font("SansSerif", Font.BOLD, 16));
            g.setColor(Color.WHITE);
            FontMetrics nameFm = g.getFontMetrics();
            g.drawString(nickname, 200 - nameFm.stringWidth(nickname) / 2, 210);

            // F. 绘制成就主体卡片盒框 (半透明背景)
            g.setColor(new Color(255, 255, 255, 12));
            g.fillRoundRect(35, 240, 330, 245, 18, 18);
            g.setColor(new Color(255, 255, 255, 25));
            g.drawRoundRect(35, 240, 330, 245, 18, 18);

            // G. 绘制专属星轨成就大标题
            g.setFont(new Font("SansSerif", Font.BOLD, 24));
            g.setColor(new Color(212, 175, 55)); // 金色
            FontMetrics achFm = g.getFontMetrics();
            String achName = "【 " + ach.getName() + " 】";
            g.drawString(achName, 200 - achFm.stringWidth(achName) / 2, 295);

            // H. 绘制成就解锁要求条件与达成说明 (中文自动分行居中)
            g.setFont(new Font("SansSerif", Font.PLAIN, 14));
            g.setColor(new Color(200, 200, 200));
            drawStringWithLineBreak(g, ach.getDescription(), 200, 345, 290, 22);

            // I. 绘制荣耀解锁时间戳
            g.setFont(new Font("SansSerif", Font.PLAIN, 12));
            g.setColor(new Color(160, 160, 160));
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
            String unlockTimeStr = "解锁时刻: " + ua.getUnlockedAt().format(formatter);
            FontMetrics timeFm = g.getFontMetrics();
            g.drawString(unlockTimeStr, 200 - timeFm.stringWidth(unlockTimeStr) / 2, 455);

            // J. 底部说明及精美防伪徽记
            g.setFont(new Font("SansSerif", Font.BOLD, 12));
            g.setColor(new Color(212, 175, 55, 150));
            FontMetrics btmFm = g.getFontMetrics();
            String btmText = "⭐ SMARTRECORD 智能记分器 荣耀印证 ⭐";
            g.drawString(btmText, 200 - btmFm.stringWidth(btmText) / 2, 545);

        } finally {
            g.dispose();
        }

        // 4. 以 PNG 格式写出字节流并返回
        ByteArrayOutputStream os = new ByteArrayOutputStream();
        try {
            ImageIO.write(image, "png", os);
        } catch (Exception e) {
            log.error("生成成就海报图片流失败: userId={}, achievementId={}", userId, achievementId, e);
            throw new BizException(500, "生成海报失败");
        }
        return os.toByteArray();
    }

    /**
     * 辅助方法：让文字在指定宽度内自动按中文字符折行并水平居中绘制。
     */
    private void drawStringWithLineBreak(Graphics2D g, String text, int x, int y, int maxWidth, int lineHeight) {
        FontMetrics fm = g.getFontMetrics();
        int start = 0;
        int currentY = y;
        for (int i = 1; i <= text.length(); i++) {
            String sub = text.substring(start, i);
            if (fm.stringWidth(sub) > maxWidth) {
                // 超限折行绘制
                String line = text.substring(start, i - 1);
                int lineX = x - fm.stringWidth(line) / 2; // 保持居中
                g.drawString(line, lineX, currentY);
                start = i - 1;
                currentY += lineHeight;
            }
        }
        // 绘制剩余文字
        if (start < text.length()) {
            String line = text.substring(start);
            int lineX = x - fm.stringWidth(line) / 2;
            g.drawString(line, lineX, currentY);
        }
    }
}
