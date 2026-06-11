package com.smartrecord.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 个人生涯驾驶舱数据响应 DTO。
 * 用于展示用户的总局数、总得分、正分胜率、最强拍档以及天命宿敌画像。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "个人生涯驾驶舱数据响应")
public class CareerCockpitResp {

    @Schema(description = "总对局场次", example = "42")
    private Integer totalRooms;

    @Schema(description = "历史总净胜分", example = "1280")
    private Integer totalScore;

    @Schema(description = "正分率（%），即最终结算分数为正的场次占比", example = "65.4")
    private Double positiveRate;

    @Schema(description = "黄金拍档信息")
    private PartnerInfo bestPartner;

    @Schema(description = "天命宿敌信息")
    private PartnerInfo nemesis;

    /**
     * 共同游戏的伙伴/对手简要资料。
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "伴侣/宿敌简要资料")
    public static class PartnerInfo {

        @Schema(description = "用户 ID")
        private Long userId;

        @Schema(description = "用户昵称")
        private String nickname;

        @Schema(description = "头像 URL")
        private String avatarUrl;

        @Schema(description = "共同游戏场次")
        private Integer playCount;

        @Schema(description = "共同游戏时我的平均分")
        private Double avgScore;
    }
}
