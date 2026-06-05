package com.smartrecord.dto.round;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "发起本局录请求")
public class StartRoundReq {

    @NotNull(message = "房间 ID 不能为空")
    @Schema(description = "房间 ID", example = "1750000000000010")
    private Long roomId;
}
