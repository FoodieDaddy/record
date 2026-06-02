package com.mahjong.score.dto.room;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
@Schema(description = "房主调整座位请求")
public class RearrangeSeatsReq {

    @NotNull(message = "座位调整列表不能为空")
    @Size(min = 1, max = 8, message = "调整列表长度 1-8")
    @Valid
    @Schema(description = "座位调整列表")
    private List<SeatAssignment> assignments;

    @Data
    @Schema(description = "单个座位分配")
    public static class SeatAssignment {

        @NotNull(message = "用户 ID 不能为空")
        @Schema(description = "用户 ID", example = "1750000000000001")
        private Long userId;

        @NotNull(message = "目标座位号不能为空")
        @Min(value = 1, message = "座位号最小为 1")
        @Max(value = 8, message = "座位号最大为 8")
        @Schema(description = "目标座位号（1-8）", example = "3")
        private Integer targetSeatNo;
    }
}
