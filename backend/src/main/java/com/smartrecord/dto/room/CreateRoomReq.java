package com.smartrecord.dto.room;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "创建房间请求")
public class CreateRoomReq {

    @Schema(description = "记分模式：1-自由流转 2-本局录入", example = "1")
    private Integer scoreMode = 1;

    @Schema(description = "本局录入方式：1-房主填写 2-成员自填（仅本局录入时有效）", example = "1")
    private Integer roundInputMethod = 1;

    @Schema(description = "信任模式：0-关闭 1-开启（仅本局录入时有效）", example = "1")
    private Integer trustMode = 1;

    @Schema(description = "零和模式：0-关闭 1-开启（仅本局录入时有效）", example = "1")
    private Integer zeroSumRequired = 1;

    @Schema(description = "自动确认超时秒数（仅本局录入且信任关闭时有效）", example = "30")
    private Integer autoTimeoutSeconds = 30;

    @Schema(description = "超时行为：1-自动同意 2-自动取消（仅本局录入且信任关闭时有效）", example = "1")
    private Integer autoTimeoutAction = 1;
}
