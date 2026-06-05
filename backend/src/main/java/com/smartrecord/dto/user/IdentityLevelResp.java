package com.smartrecord.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "身份等级响应")
public class IdentityLevelResp {

    @Schema(description = "当前等级 1-5", example = "2")
    private Integer level;

    @Schema(description = "等级称号", example = "桌面参与者")
    private String title;

    @Schema(description = "当前经验值", example = "280")
    private Integer exp;

    @Schema(description = "下一级所需经验", example = "500")
    private Integer nextLevelExp;

    @Schema(description = "当前等级进度百分比 0-100", example = "56")
    private Integer progress;

    @Schema(description = "人格稳定度 0-100，null 表示数据不足", example = "72")
    private Integer stability;
}
