package com.mahjong.score.dto.session;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "创建场次请求")
public class CreateSessionReq {

    @NotNull(message = "roomId 不能为空")
    @Schema(description = "房间 ID", example = "1750000000000010")
    private Long roomId;

    @Schema(description = "场次标题（如：下午场）", example = "下午场")
    private String title;
}
