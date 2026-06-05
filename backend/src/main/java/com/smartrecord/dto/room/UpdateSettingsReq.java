package com.smartrecord.dto.room;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "更新房间记分设置")
public class UpdateSettingsReq {

    @Schema(description = "本局录入方式：1-房主填写 2-成员自填")
    private Integer roundInputMethod;

    @Schema(description = "信任模式：0-关闭 1-开启")
    private Integer trustMode;

    @Schema(description = "零和模式：0-关闭 1-开启")
    private Integer zeroSumRequired;

    @Schema(description = "自动确认超时秒数")
    private Integer autoTimeoutSeconds;

    @Schema(description = "超时行为：1-自动同意 2-自动取消")
    private Integer autoTimeoutAction;
}
