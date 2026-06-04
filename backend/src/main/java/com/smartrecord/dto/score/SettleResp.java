package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@Schema(description = "结算响应")
public class SettleResp {

    @Schema(description = "房间 ID")
    private Long roomId;

    @Schema(description = "房间号")
    private String roomNo;

    @Schema(description = "时间点列表（批次时间戳，毫秒）")
    private List<Long> timestamps;

    @Schema(description = "各成员积分序列")
    private List<ChartDataResp.Series> series;

    @Schema(description = "成员最终积分")
    private List<MemberScore> memberScores;

    @Schema(description = "是否超时自动结算")
    private boolean autoSettled;

    @Data
    @Builder
    @Schema(description = "成员最终积分")
    public static class MemberScore {

        @Schema(description = "用户 ID")
        private Long userId;

        @Schema(description = "昵称")
        private String nickname;

        @Schema(description = "头像 URL")
        private String avatarUrl;

        @Schema(description = "最终净胜分")
        private Integer finalScore;
    }
}
