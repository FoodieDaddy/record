package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@Schema(description = "积分关系网络")
public class RoomNetworkResp {

    @Schema(description = "节点列表")
    private List<Node> nodes;

    @Schema(description = "连线列表")
    private List<Link> links;

    @Data
    @Builder
    @Schema(description = "网络节点")
    public static class Node {
        @Schema(description = "用户 ID", example = "123")
        private Long userId;

        @Schema(description = "昵称", example = "先天话痨")
        private String nickname;

        @Schema(description = "头像 URL")
        private String avatarUrl;

        @Schema(description = "当前积分", example = "143")
        private Integer score;
    }

    @Data
    @Builder
    @Schema(description = "网络连线")
    public static class Link {
        @Schema(description = "发起人 ID", example = "123")
        private Long from;

        @Schema(description = "接收人 ID", example = "456")
        private Long to;

        @Schema(description = "净流转额（正数=from→to 净流入）", example = "50")
        private Integer netAmount;

        @Schema(description = "交互次数", example = "5")
        private Integer count;
    }
}
