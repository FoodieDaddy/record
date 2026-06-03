package com.smartrecord.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(description = "微信登录请求")
public class LoginReq {

    @NotBlank(message = "code 不能为空")
    @Schema(description = "微信登录 code（wx.login 获取）", example = "abc123def456")
    private String code;

    @Schema(description = "用户昵称", example = "记分达人")
    private String nickname;

    @Schema(description = "头像 URL", example = "https://thirdwx.qlogo.cn/mmopen/xxx/132")
    private String avatarUrl;
}
