package com.smartrecord.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
@Schema(description = "更新用户信息请求")
public class UpdateUserReq {

    @Size(max = 12, message = "昵称最长6个汉字")
    @Schema(description = "昵称（最长6个汉字宽度）", example = "星港调度员")
    private String nickname;

    @Schema(description = "头像 URL")
    private String avatarUrl;
}
