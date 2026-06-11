package com.smartrecord.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Schema(description = "管理端用户响应")
public class AdminUserResp {
    @Schema(example = "123456")
    private Long id;
    @Schema(example = "航船A")
    private String nickname;
    @Schema(example = "https://...")
    private String avatarUrl;
    @Schema(example = "1")
    private Integer status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static AdminUserResp from(com.smartrecord.entity.User user) {
        AdminUserResp resp = new AdminUserResp();
        resp.setId(user.getId());
        resp.setNickname(user.getNickname());
        resp.setAvatarUrl(user.getAvatarUrl());
        resp.setStatus(user.getStatus());
        resp.setCreatedAt(user.getCreatedAt());
        resp.setUpdatedAt(user.getUpdatedAt());
        return resp;
    }
}
