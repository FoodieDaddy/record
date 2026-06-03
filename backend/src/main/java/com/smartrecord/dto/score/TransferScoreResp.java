package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@Schema(description = "计分记录")
public class TransferScoreResp {

    @Schema(description = "记录 ID")
    private Long id;

    @Schema(description = "发起人信息")
    private UserInfo fromUser;

    @Schema(description = "接收人信息")
    private UserInfo toUser;

    @Schema(description = "分值")
    private Integer amount;

    @Schema(description = "分值（元，用于显示）")
    private String amountDisplay;

    @Schema(description = "备注")
    private String remark;

    @Schema(description = "计分时间")
    private LocalDateTime createdAt;

    @Data
    @Builder
    public static class UserInfo {
        private Long userId;
        private String nickname;
        private String avatarUrl;
    }
}
