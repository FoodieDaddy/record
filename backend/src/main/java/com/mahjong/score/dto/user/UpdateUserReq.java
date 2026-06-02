package com.mahjong.score.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "更新用户信息请求")
public class UpdateUserReq {

    @Schema(description = "昵称")
    private String nickname;

    @Schema(description = "头像 URL")
    private String avatarUrl;
}
