package com.smartrecord.service;

import com.smartrecord.entity.Achievement;
import java.util.List;
import java.util.Map;

/**
 * 智能记分器成就系统服务接口。
 * 提供对局结束时成就的自动化判定算法执行，以及成就的查询与装备更换。
 */
public interface AchievementService {

    /**
     * 按 ID 获取成就定义（启用二级缓存）
     */
    Achievement getCachedAchievementById(Long achievementId);

    /**
     * 获取全部成就定义列表（启用二级缓存）
     */
    List<Achievement> getCachedAllAchievements();

    /**
     * 对局结算后，异步扫描并为用户判定/发放成就。
     * 支持 Mode 1 和 Mode 2 结算触发，脱敏评估折线图曲线、转账频次与去重对象。
     *
     * @param userId         要判定的玩家 ID
     * @param roomId         对战房间 ID
     * @param allRecord      全局流水明细归档快照（内含 transferEvents 流水记录）
     * @param playerTotalMap 本场对局各玩家的最终积分结算结果
     */
    void scanAndAward(Long userId, Long roomId, List<Map<String, Object>> allRecord, Map<Long, Integer> playerTotalMap);

    /**
     * 获取用户当前装备的个性化装扮（称号标识、头像框皮肤等）。
     *
     * @param userId 用户 ID
     * @return 包含已装备装扮的 Map，键为 "equippedBadge" 和 "equippedAvatarBorder"
     */
    Map<String, String> getEquippedCosmetics(Long userId);

    /**
     * 获取用户的成就列表（包括所有系统内置成就，标识已解锁和装备状态）。
     *
     * @param userId 用户 ID
     * @return 用户成就列表 DTO
     */
    List<com.smartrecord.dto.achievement.UserAchievementResp> getUserAchievements(Long userId);

    /**
     * 装备指定成就所赠送的装扮。
     * 装备时会自动更新数据库状态、清空同类型装扮的其他装备，刷新 Redis 缓存并广播 WS 状态。
     *
     * @param userId        用户 ID
     * @param achievementId 成就 ID
     */
    void equipCosmetic(Long userId, Long achievementId);

    /**
     * 卸下指定成就所赠送的装扮。
     * 卸下后更新数据库状态，刷新 Redis 缓存并广播 WS 状态。
     *
     * @param userId        用户 ID
     * @param achievementId 成就 ID
     */
    void unequipCosmetic(Long userId, Long achievementId);

    /**
     * 为用户生成专属的成就达成卡片海报（直接输出 PNG 字节数据）
     *
     * @param userId        用户 ID
     * @param achievementId 成就 ID
     * @return 绘制完成的海报 PNG 图片字节数组
     */
    byte[] generateAchievementPoster(Long userId, Long achievementId);
}
