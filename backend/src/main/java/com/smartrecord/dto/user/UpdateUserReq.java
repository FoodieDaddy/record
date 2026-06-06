package com.smartrecord.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
@Schema(description = "更新用户信息请求")
public class UpdateUserReq {

    @Size(max = 6, message = "昵称不能超过6个字符")
    @Schema(description = "昵称", example = "星港")
    private String nickname;

    @Schema(description = "头像 URL")
    private String avatarUrl;
}
