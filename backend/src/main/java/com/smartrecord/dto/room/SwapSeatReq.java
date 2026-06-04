package com.smartrecord.dto.room;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "换座请求")
public class SwapSeatReq {

    @NotNull(message = "目标座位号不能为空")
    @Min(value = 1, message = "座位号最小为 1")
    @Max(value = 16, message = "座位号最大为 16")
    @Schema(description = "目标座位号（1-16）", example = "3")
    private Integer targetSeatNo;
}
