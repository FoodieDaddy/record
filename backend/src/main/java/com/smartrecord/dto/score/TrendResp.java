package com.smartrecord.dto.score;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@Schema(description = "多场趋势响应")
public class TrendResp {

    @Schema(description = "趋势数据点列表（按时间正序）")
    private List<Point> points;

    @Data
    @Builder
    @Schema(description = "单个趋势数据点")
    public static class Point {

        @Schema(description = "房间 ID")
        private Long roomId;

        @Schema(description = "游戏日期 (ISO)", example = "2026-06-05")
        private String date;

        @Schema(description = "该场净胜分")
        private Integer netScore;
    }
}
