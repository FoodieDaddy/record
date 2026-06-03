package com.smartrecord.dto.room;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "创建房间请求")
public class CreateRoomReq {

    @Schema(description = "记分模式：1-自由流转 2-赢家统录", example = "1")
    private Integer scoreMode = 1;
}
