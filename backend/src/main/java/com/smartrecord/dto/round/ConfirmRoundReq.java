package com.smartrecord.dto.round;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "确认本局录请求")
public class ConfirmRoundReq {

    @NotNull(message = "房间 ID 不能为空")
    @Schema(description = "房间 ID", example = "1750000000000010")
    private Long roomId;

    @NotNull(message = "agree 不能为空")
    @Schema(description = "是否同意：true-同意 false-驳回", example = "true")
    private Boolean agree;

    @Schema(description = "客户端请求 ID，用于幂等去重", example = "1718000000000-a3f8b2")
    private String clientRequestId;
}
