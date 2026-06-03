package com.smartrecord.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@Schema(description = "登录响应")
public class LoginResp {

    @Schema(description = "JWT Token", example = "eyJhbGciOiJIUzI1NiJ9.xxx.xxx")
    private String token;

    @Schema(description = "用户 ID", example = "1750000000000001")
    private Long userId;

    @Schema(description = "昵称", example = "记分达人")
    private String nickname;

    @Schema(description = "头像 URL", example = "https://bucket.oss-cn-hangzhou.aliyuncs.com/avatar/abc.jpg")
    private String avatarUrl;
}
