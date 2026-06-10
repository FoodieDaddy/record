package com.smartrecord.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(description = "创建管理员请求")
public class AdminCreateReq {

    @NotBlank
    @Schema(description = "用户名", example = "operator1")
    private String username;

    @NotBlank
    @Schema(description = "密码", example = "pass123")
    private String password;

    @Schema(description = "角色", example = "OPERATOR")
    private String role = "VIEWER";
}
