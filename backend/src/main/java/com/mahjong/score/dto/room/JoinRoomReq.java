package com.mahjong.score.dto.room;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(description = "加入房间请求（二选一）")
public class JoinRoomReq {

    @Schema(description = "房间号（手动输入）", example = "A3K7NP")
    private String roomNo;

    @Schema(description = "扫码携带的房间号参数", example = "A3K7NP")
    private String scanRoomNo;
}
