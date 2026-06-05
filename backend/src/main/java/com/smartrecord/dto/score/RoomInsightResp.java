package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@Schema(description = "战局洞察")
public class RoomInsightResp {

    @Schema(description = "总流转量（所有 amount 之和）", example = "286")
    private Integer totalTransfer;

    @Schema(description = "单次最大流转额", example = "88")
    private Integer maxSingleTransfer;

    @Schema(description = "最活跃用户")
    private ActiveUser mostActiveUser;

    @Schema(description = "流转次数", example = "12")
    private Integer transferCount;

    @Schema(description = "互动密度 HIGH/MEDIUM/LOW", example = "HIGH")
    private String networkDensity;

    @Data
    @Builder
    @Schema(description = "最活跃用户")
    public static class ActiveUser {
        @Schema(description = "用户 ID", example = "123")
        private Long userId;

        @Schema(description = "昵称", example = "先天话痨")
        private String nickname;

        @Schema(description = "头像 URL")
        private String avatarUrl;

        @Schema(description = "互动次数", example = "14")
        private Integer count;
    }
}
