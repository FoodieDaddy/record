package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "计分请求")
public class TransferScoreReq {

    @NotNull(message = "roomId 不能为空")
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
}
