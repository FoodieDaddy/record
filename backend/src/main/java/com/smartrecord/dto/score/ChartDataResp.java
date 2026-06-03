package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@Schema(description = "折线图数据响应")
public class ChartDataResp {

    @Schema(description = "时间点列表（批次时间戳，毫秒）")
    private List<Long> timestamps;

    @Schema(description = "各成员积分序列")
    private List<Series> series;

    @Data
    @Builder
    @Schema(description = "成员积分序列")
    public static class Series {

        @Schema(description = "用户 ID", example = "1750000000000001")
        private Long userId;

        @Schema(description = "昵称", example = "记分达人")
        private String nickname;

        @Schema(description = "各时间点累计积分")
        private List<Integer> scores;
    }
}
