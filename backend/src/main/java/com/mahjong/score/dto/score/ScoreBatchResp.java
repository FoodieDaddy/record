package com.mahjong.score.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@Schema(description = "记分批次响应（一轮得分）")
public class ScoreBatchResp {

    @Schema(description = "批次时间戳（同一轮共享）", example = "2026-06-01T15:30:00")
    private LocalDateTime batchTime;

    @Schema(description = "发起记分人 ID", example = "1750000000000001")
    private Long createdBy;

    @Schema(description = "本轮各玩家得分")
    private List<PlayerScoreVO> scores;

    @Schema(description = "本轮图片 URL 列表")
    private List<String> imageUrls;

    @Data
    @Builder
    @Schema(description = "玩家得分详情")
    public static class PlayerScoreVO {

        @Schema(description = "用户 ID", example = "1750000000000001")
        private Long userId;

        @Schema(description = "昵称", example = "麻将达人")
        private String nickname;

        @Schema(description = "得分", example = "16")
        private Integer score;
    }
}
