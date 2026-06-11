package com.smartrecord.controller;

import com.smartrecord.aop.CurrentUser;
import com.smartrecord.common.Result;
import com.smartrecord.dto.achievement.UserAchievementResp;
import com.smartrecord.service.AchievementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 成就与驾驶舱装扮模块控制器。
 * 提供成就字典查询、获取已解锁成就、装备个性化装扮（头像框/称号挂件）、以及卸下装扮功能。
 */
@Tag(name = "成就与装扮模块", description = "成就列表、装备个性化装扮等")
@RestController
@RequestMapping("/achievement")
@RequiredArgsConstructor
public class AchievementController {

    private final AchievementService achievementService;

    /**
     * 获取全局成就及当前用户解锁与装备状态列表。
     *
     * @param userId 当前登录用户 ID
     * @return 包含所有成就及用户达成装扮状态的列表
     */
    @Operation(summary = "获取成就与装扮列表", description = "获取系统全局成就字典，并标识当前用户是否解锁及是否装备该成就奖励装扮")
    @GetMapping("/list")
    public Result<List<UserAchievementResp>> listAchievements(@CurrentUser Long userId) {
        return Result.ok(achievementService.getUserAchievements(userId));
    }

    /**
     * 装备成就解锁的个性化装扮奖励。
     * 同类别的装扮（例如头像框、特殊标识挂件等）会自动进行互斥置空。
     *
     * @param userId        当前登录用户 ID
     * @param achievementId 解锁了装扮的成就 ID
     * @return 装备成功响应
     */
    @Operation(summary = "装备成就装扮", description = "装备成就解锁的个性化装扮奖励，同类型装扮将会自动互斥下架")
    @PostMapping("/{id}/equip")
    public Result<Void> equipCosmetic(@CurrentUser Long userId, @PathVariable("id") Long achievementId) {
        achievementService.equipCosmetic(userId, achievementId);
        return Result.ok();
    }

    /**
     * 卸下当前已装备的个性化装扮奖励。
     *
     * @param userId        当前登录用户 ID
     * @param achievementId 已装备的成就 ID
     * @return 卸下成功响应
     */
    @Operation(summary = "卸下成就装扮", description = "卸下当前已装备的个性化装扮奖励")
    @PostMapping("/{id}/unequip")
    public Result<Void> unequipCosmetic(@CurrentUser Long userId, @PathVariable("id") Long achievementId) {
        achievementService.unequipCosmetic(userId, achievementId);
        return Result.ok();
    }

    /**
     * 生成并直接以图片流形式输出成就达成专属海报卡片。
     *
     * @param userId        当前登录用户 ID
     * @param achievementId 成就 ID
     * @param response      HTTP 响应对象
     * @throws java.io.IOException 写入图片流失败时抛出
     */
    @Operation(summary = "生成成就专属海报图片", description = "生成指定已解锁成就的专属分享海报，直接返回 image/png 字节流图片")
    @GetMapping("/{id}/poster")
    public void getAchievementPoster(
            @CurrentUser Long userId,
            @PathVariable("id") Long achievementId,
            jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        byte[] posterBytes = achievementService.generateAchievementPoster(userId, achievementId);
        response.setContentType("image/png");
        response.getOutputStream().write(posterBytes);
        response.getOutputStream().flush();
    }
}
