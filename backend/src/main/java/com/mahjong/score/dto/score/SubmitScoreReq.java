package com.mahjong.score.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
@Schema(description = "提交记分请求（一次提交为一轮，包含多个玩家得分）")
public class SubmitScoreReq {

    @Schema(description = "场次 ID（与 roomId 二选一）", example = "1750000000000020")
    private Long sessionId;

    @Schema(description = "房间 ID（与 sessionId 二选一，传 roomId 时自动使用当前活跃场次）")
    private Long roomId;

    @NotEmpty(message = "得分列表不能为空")
    @Valid
    @Schema(description = "各玩家得分列表")
    private List<PlayerScore> scores;

    @Size(max = 9, message = "最多上传 9 张图片")
    @Schema(description = "图片 URL 列表（已通过直传上传到 MinIO 的 URL）")
    private List<String> imageUrls;

    @Data
    @Schema(description = "单个玩家得分")
    public static class PlayerScore {

        @NotNull(message = "userId 不能为空")
        @Schema(description = "得分玩家 ID", example = "1750000000000001")
        private Long userId;

        @NotNull(message = "score 不能为空")
        @Schema(description = "得分（可正可负）", example = "16")
        private Integer score;
    }
}
