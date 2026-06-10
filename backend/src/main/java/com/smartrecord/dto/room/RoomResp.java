package com.smartrecord.dto.room;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "房间详情响应")
public class RoomResp {

    @Schema(description = "房间 ID", example = "1750000000000010")
    private Long roomId;

    @Schema(description = "房间号", example = "A3K7NP")
    private String roomNo;

    @Schema(description = "房主用户 ID", example = "1750000000000001")
    private Long ownerId;

    @Schema(description = "记分模式：1-自由流转 2-本局录入", example = "1")
    private Integer scoreMode;

    @Schema(description = "本局录入方式：1-房主填写 2-成员自填", example = "1")
    private Integer roundInputMethod;

    @Schema(description = "信任模式：0-关闭 1-开启", example = "1")
    private Integer trustMode;

    @Schema(description = "零和模式：0-关闭 1-开启", example = "1")
    private Integer zeroSumRequired;

    @Schema(description = "自动确认超时秒数", example = "30")
    private Integer autoTimeoutSeconds;

    @Schema(description = "超时行为：1-自动同意 2-自动取消", example = "1")
    private Integer autoTimeoutAction;

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
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "房间成员信息")
    public static class MemberVO {

        @Schema(description = "用户 ID", example = "1750000000000001")
        private Long userId;

        @Schema(description = "昵称", example = "记分达人")
        private String nickname;

        @Schema(description = "头像 URL")
        private String avatarUrl;

        @Schema(description = "最终净胜分（仅历史房间有值）")
        private Integer finalScore;
    }
}
