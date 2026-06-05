package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "镜像画像聚合响应")
public class MirrorProfileResp {

    @Schema(description = "MBTI人格信息")
    private ProfileInfo mbti;

    @Schema(description = "战绩人格画像")
    private BattlePersonaInfo battlePersona;

    @Schema(description = "行为维度")
    private List<DimensionInfo> dimensions;

    @Schema(description = "镜像判读")
    private ReadingInfo reading;

    @Schema(description = "认知特征标签")
    private List<String> traits;

    @Schema(description = "人格与战绩匹配度")
    private PersonaMatchInfo personaMatch;

    @Schema(description = "人格可信度 0-100", example = "75")
    private Integer personaConfidence;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "MBTI人格信息")
    public static class ProfileInfo {
        @Schema(description = "是否已校准", example = "true")
        private boolean calibrated;
        @Schema(description = "MBTI类型编号", example = "1")
        private Integer mbtiCode;
        @Schema(description = "置信度", example = "82.5")
        private BigDecimal confidence;
        @Schema(description = "来源: test/direct", example = "test")
        private String mbtiSource;
        @Schema(description = "校准时间", example = "2026-06-05 20:30")
        private String calibratedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "人格与战绩匹配度")
    public static class PersonaMatchInfo {
        @Schema(description = "是否可用", example = "true")
        private boolean available;
        @Schema(description = "一致性百分比 0-100", example = "87")
        private int matchPercentage;
        @Schema(description = "人格预测倾向", example = "偏控场")
        private String prediction;
        @Schema(description = "实际表现摘要", example = "控场力 82 / 稳定性 90")
        private String actualSummary;
        @Schema(description = "一句话总结", example = "人格预测与实际表现高度一致")
        private String summary;
        @Schema(description = "推算MBTI类型", example = "ENTJ")
        private String inferredMbtiType;
        @Schema(description = "推算MBTI称号", example = "压迫型指挥者")
        private String inferredMbtiTitle;
        @Schema(description = "偏差程度百分比 0-100", example = "18")
        private int deviationPercent;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "战绩人格画像")
    public static class BattlePersonaInfo {
        @Schema(description = "是否已生成", example = "true")
        private boolean generated;
        @Schema(description = "样本数", example = "12")
        private int sampleSize;
        @Schema(description = "样本范围", example = "recent10")
        private String sampleRange;
        @Schema(description = "人格标签", example = "STABLE_CONTROL")
        private String tag;
        @Schema(description = "人格标题", example = "稳健控场型")
        private String title;
        @Schema(description = "人格描述", example = "打法偏向结构化执行，波动较低。")
        private String summary;
        @Schema(description = "计算时间", example = "2026-06-05 22:10")
        private String calculatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "行为维度")
    public static class DimensionInfo {
        @Schema(description = "维度key", example = "stability")
        private String key;
        @Schema(description = "维度标签", example = "稳定性")
        private String label;
        @Schema(description = "维度分值 0-100", example = "82")
        private int value;
        @Schema(description = "维度说明")
        private String desc;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "镜像判读")
    public static class ReadingInfo {
        @Schema(description = "是否可用", example = "true")
        private boolean available;
        @Schema(description = "判读文案（完整文本，向后兼容）")
        private String text;
        @Schema(description = "系统观测")
        private String observation;
        @Schema(description = "偏差描述")
        private String deviation;
        @Schema(description = "风险提示")
        private String risk;
        @Schema(description = "成长建议")
        private String growthAdvice;
    }
}
