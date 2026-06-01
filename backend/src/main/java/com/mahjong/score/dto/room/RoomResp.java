package com.mahjong.score.dto.room;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@Schema(description = "房间详情响应")
public class RoomResp {

    @Schema(description = "房间 ID", example = "1750000000000010")
    private Long roomId;

    @Schema(description = "房间号", example = "A3K7NP")
    private String roomNo;

    @Schema(description = "房主用户 ID", example = "1750000000000001")
    private Long ownerId;

    @Schema(description = "底分", example = "1")
    private Integer baseScore;

    @Schema(description = "房间状态：0-使用中 1-已归档", example = "0")
    private Integer status;

    @Schema(description = "专属小程序码 URL")
    private String qrCodeUrl;

    @Schema(description = "成员列表")
    private List<MemberVO> members;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Data
    @Builder
    @Schema(description = "房间成员信息")
    public static class MemberVO {

        @Schema(description = "用户 ID", example = "1750000000000001")
        private Long userId;

        @Schema(description = "昵称", example = "麻将达人")
        private String nickname;

        @Schema(description = "头像 URL")
        private String avatarUrl;

        @Schema(description = "座位号", example = "1")
        private Integer seatNo;
    }
}
