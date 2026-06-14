package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
@Schema(description = "计分请求")
public class TransferScoreReq {

    @NotNull(message = "房间 ID 不能为空")
    @Schema(description = "房间 ID", example = "1750000000000010")
    private Long roomId;

    @NotNull(message = "收款人不能为空")
    @Schema(description = "接收人用户 ID", example = "1750000000000020")
    private Long toUserId;

    @NotNull(message = "金额不能为空")
    @Min(value = 1, message = "金额必须大于 0")
    @Schema(description = "金额（分）", example = "1000")
    private Integer amount;

    @Schema(description = "备注", example = "本轮数值变化")
    private String remark;

    @NotBlank(message = "客户端请求 ID 不能为空")
    @Size(max = 64, message = "客户端请求 ID 不能超过 64 个字符")
    @Schema(description = "客户端请求 ID，用于幂等去重", example = "1718000000000-a3f8b2")
    private String clientRequestId;
}
