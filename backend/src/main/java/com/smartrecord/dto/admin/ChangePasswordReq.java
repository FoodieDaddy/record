package com.smartrecord.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
@Schema(description = "修改密码请求")
public class ChangePasswordReq {

    @NotBlank
    @Schema(description = "原密码", example = "oldPass123")
    private String oldPassword;

    @NotBlank
    @Size(min = 8, message = "新密码长度不能少于 8 位")
    @Schema(description = "新密码（至少 8 位）", example = "newPass456")
    private String newPassword;
}
