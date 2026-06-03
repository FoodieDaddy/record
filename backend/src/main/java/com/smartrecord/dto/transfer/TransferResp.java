package com.smartrecord.dto.transfer;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@Schema(description = "转账记录")
public class TransferResp {

    @Schema(description = "转账 ID")
    private Long id;

    @Schema(description = "关联场次 ID")
    private Long sessionId;

    @Schema(description = "转账人信息")
    private UserInfo fromUser;

    @Schema(description = "收款人信息")
    private UserInfo toUser;

    @Schema(description = "金额（分）")
    private Integer amount;

    @Schema(description = "金额（元，用于显示）")
    private String amountDisplay;

    @Schema(description = "备注")
    private String remark;

    @Schema(description = "状态 0=正常 1=已撤回")
    private Integer status;

    @Schema(description = "转账时间")
    private LocalDateTime createdAt;

    @Data
    @Builder
    public static class UserInfo {
        private Long userId;
        private String nickname;
        private String avatarUrl;
    }
}
