package com.smartrecord.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "更新用户设置请求")
public class UpdateUserDetailReq {

    @Schema(description = "语音播报开关")
    private Boolean voiceEnabled;

    @Schema(description = "音色 ID", example = "std_01")
    private String voiceId;

    @Schema(description = "动画开关")
    private Boolean animEnabled;

    @Schema(description = "震动开关")
    private Boolean vibrateEnabled;
}
