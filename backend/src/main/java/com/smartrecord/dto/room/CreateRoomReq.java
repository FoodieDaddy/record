package com.smartrecord.dto.room;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
@Schema(description = "创建房间请求")
public class CreateRoomReq {

    @Min(value = 1, message = "记分模式最小为 1")
    @Max(value = 2, message = "记分模式最大为 2")
    @Schema(description = "记分模式：1-自由流转 2-本局录入", example = "1")
    private Integer scoreMode = 1;

    @Min(value = 1, message = "录入方式最小为 1")
    @Max(value = 2, message = "录入方式最大为 2")
    @Schema(description = "本局录入方式：1-房主填写 2-成员自填（仅本局录入时有效）", example = "1")
    private Integer roundInputMethod = 1;

    @Min(value = 0, message = "信任模式最小为 0")
    @Max(value = 1, message = "信任模式最大为 1")
    @Schema(description = "信任模式：0-关闭 1-开启（仅本局录入时有效）", example = "1")
    private Integer trustMode = 1;

    @Min(value = 0, message = "零和模式最小为 0")
    @Max(value = 1, message = "零和模式最大为 1")
    @Schema(description = "零和模式：0-关闭 1-开启（仅本局录入时有效）", example = "1")
    private Integer zeroSumRequired = 1;

    @Min(value = 5, message = "超时秒数最小为 5")
    @Max(value = 300, message = "超时秒数最大为 300")
    @Schema(description = "自动确认超时秒数（仅本局录入且信任关闭时有效）", example = "30")
    private Integer autoTimeoutSeconds = 30;

    @Min(value = 1, message = "超时行为最小为 1")
    @Max(value = 2, message = "超时行为最大为 2")
    @Schema(description = "超时行为：1-自动同意 2-自动取消（仅本局录入且信任关闭时有效）", example = "1")
    private Integer autoTimeoutAction = 1;
}
