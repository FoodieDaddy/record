package com.mahjong.score.dto.room;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
@Schema(description = "创建房间请求")
public class CreateRoomReq {

    @Min(value = 1, message = "底分最小为 1")
    @Max(value = 1000, message = "底分最大为 1000")
    @Schema(description = "底分", example = "1")
    private Integer baseScore = 1;
}
