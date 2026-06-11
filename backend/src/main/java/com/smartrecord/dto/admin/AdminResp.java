package com.smartrecord.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Schema(description = "管理员响应")
public class AdminResp {
    @Schema(example = "123456")
    private Long id;
    @Schema(example = "admin")
    private String username;
    @Schema(example = "SUPER_ADMIN")
    private String role;
    @Schema(example = "1")
    private Integer status;
    private LocalDateTime lastLoginAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static AdminResp from(com.smartrecord.entity.Admin admin) {
        AdminResp resp = new AdminResp();
        resp.setId(admin.getId());
        resp.setUsername(admin.getUsername());
        resp.setRole(admin.getRole());
        resp.setStatus(admin.getStatus());
        resp.setLastLoginAt(admin.getLastLoginAt());
        resp.setCreatedAt(admin.getCreatedAt());
        resp.setUpdatedAt(admin.getUpdatedAt());
        return resp;
    }
}
