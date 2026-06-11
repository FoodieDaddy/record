package com.smartrecord.dto.achievement;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 用户成就信息响应 DTO。
 * 用于展示系统所有成就、用户当前解锁状态、装备状态以及解锁时间。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "用户成就信息响应")
public class UserAchievementResp {

    @Schema(description = "成就 ID", example = "6001")
    private Long id;

    @Schema(description = "成就名称", example = "逆熵翻盘者")
    private String name;

    @Schema(description = "成就描述", example = "在单场对局中，积分曾降至负分以下，但最终反超以正分完赛")
    private String description;

    @Schema(description = "装扮类型：0-无，1-特殊标识(badge)，2-头像框皮肤(border)，3-特殊语音(voice)，4-粒子特效(beam)", example = "1")
    private Integer cosmeticType;

    @Schema(description = "装扮配置，例如：{\"badge\":\"逆熵\"}", example = "{\"badge\":\"逆熵\"}")
    private String cosmeticPayload;

    @Schema(description = "是否已解锁：0-未解锁，1-已解锁", example = "1")
    private Integer unlocked;

    @Schema(description = "装备状态：0-未装备，1-已装备", example = "0")
    private Integer status;

    @Schema(description = "解锁时间")
    private LocalDateTime unlockedAt;
}
