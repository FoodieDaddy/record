package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "五维战力雷达图数据")
public class MirrorStatsResp {

    @Schema(description = "五个维度")
    private List<StatDimension> dimensions;

    @Schema(description = "样本数", example = "12")
    private int sampleSize;

    @Schema(description = "计算时间", example = "2026-06-05 22:10")
    private String calculatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "维度数据")
    public static class StatDimension {
        @Schema(description = "维度key", example = "aggression")
        private String key;
        @Schema(description = "维度标签", example = "进攻性")
        private String label;
        @Schema(description = "维度分值 0-100", example = "72")
        private int value;
        @Schema(description = "维度说明")
        private String desc;
    }
}
