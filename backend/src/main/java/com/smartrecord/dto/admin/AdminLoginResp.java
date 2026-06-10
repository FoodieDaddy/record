package com.smartrecord.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@Schema(description = "管理员登录响应")
public class AdminLoginResp {

    @Schema(description = "JWT Token")
    private String token;

    @Schema(description = "管理员用户名", example = "admin")
    private String username;

    @Schema(description = "角色", example = "SUPER_ADMIN")
    private String role;
}
