package com.smartrecord.dto.round;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
@Schema(description = "提交本局录分数请求")
public class SubmitRoundReq {

    @NotNull(message = "房间 ID 不能为空")
    @Schema(description = "房间 ID", example = "1750000000000010")
    private Long roomId;

    @NotEmpty(message = "得分列表不能为空")
    @Valid
    @Schema(description = "各玩家得分列表")
    private List<PlayerScore> scores;

    @Data
    @Schema(description = "单个玩家得分")
    public static class PlayerScore {

        @NotNull(message = "userId 不能为空")
        @Schema(description = "用户 ID", example = "1750000000000001")
        private Long userId;

        @NotNull(message = "score 不能为空")
        @Schema(description = "积分变化（可正可负可零）", example = "16")
        private Integer score;
    }
}
