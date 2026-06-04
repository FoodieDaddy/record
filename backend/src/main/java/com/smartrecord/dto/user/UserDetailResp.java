package com.smartrecord.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@Schema(description = "用户设置响应")
public class UserDetailResp {

    @Schema(description = "语音播报开关", example = "true")
    private Boolean voiceEnabled;

    @Schema(description = "音色 ID", example = "std_01")
    private String voiceId;

    @Schema(description = "动画开关", example = "true")
    private Boolean animEnabled;

    @Schema(description = "震动开关", example = "true")
    private Boolean vibrateEnabled;
}
