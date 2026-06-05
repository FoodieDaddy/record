package com.smartrecord.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@Schema(description = "用户信息响应")
public class UserInfoResp {

    @Schema(description = "用户 ID", example = "1750000000000001")
    private Long userId;

    @Schema(description = "昵称", example = "记分达人")
    private String nickname;

    @Schema(description = "头像 URL", example = "https://bucket.oss-cn-hangzhou.aliyuncs.com/avatar/abc.jpg")
    private String avatarUrl;

    @Schema(description = "注册时间", example = "2026-05-01 10:30:00")
    private String createdAt;

    @Schema(description = "用户设置")
    private UserDetailResp userDetail;
}
