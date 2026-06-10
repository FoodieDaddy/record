package com.smartrecord.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(description = "管理员登录请求")
public class AdminLoginReq {

    @NotBlank
    @Schema(description = "管理员账号", example = "admin")
    private String username;

    @NotBlank
    @Schema(description = "密码", example = "admin123")
    private String password;
}
