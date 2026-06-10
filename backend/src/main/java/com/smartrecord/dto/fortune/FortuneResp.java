package com.smartrecord.dto.fortune;

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
@Schema(description = "每日策略响应")
public class FortuneResp {

    @Schema(description = "策略提示", example = "今日状态平稳，先稳住节奏")
    private String verdict;

    @Schema(description = "系统增益 (Buff) 列表", example = "[\"节奏连续\", \"心态稳定\"]")
    private List<String> buffs;

    @Schema(description = "风险警告 (Debuff) 列表", example = "[\"注意冲动计分\"]")
    private List<String> debuffs;

    @Schema(description = "主题色 (HEX)", example = "#0A84FF")
    private String themeColor;

    @Schema(description = "光球颜色 (HEX)，兼容旧字段", example = "#0A84FF")
    private String glowColor;

    @Schema(description = "精简状态标签 (2-4字)", example = "稳健")
    private String tag;

    @Schema(description = "用户画像标签", example = "WINNING_STREAK")
    private String userTag;

    @Schema(description = "数据来源：llm=大模型, fallback=本地兜底", example = "llm")
    private String source;

    @Schema(description = "时间窗口标签（仅作节奏参考）", example = "2026.06.06")
    private String lunarDate;

    @Schema(description = "环境窗口标签", example = "MIDDAY")
    private String solarTerm;

    @Schema(description = "策略原型中文名", example = "控场者")
    private String title;

    @Schema(description = "策略原型英文名", example = "THE CONTROLLER")
    private String subtitle;

    @Schema(description = "策略标签列表", example = "[\"顺行\", \"连续\", \"控场\"]")
    private List<String> tags;

    @Schema(description = "下次可刷新时间 (HH:mm:ss)，null 表示今日已生成", example = "20:30:43")
    private String nextRefreshAt;

    @Schema(description = "下次可刷新时间戳（毫秒），前端优先使用此字段计算倒计时", example = "1717852243000")
    private Long nextRefreshAtEpochMs;

    @Schema(description = "画像缓存（供前端 CloudBase AI 快路径使用）")
    private PortraitCache portraitCache;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "用户画像缓存")
    public static class PortraitCache {

        @Schema(description = "用户画像标签", example = "STABLE")
        private String userTag;

        @Schema(description = "净积分", example = "120")
        private Integer netScore;

        @Schema(description = "近期积分走势", example = "[10, -5, 20]")
        private List<Integer> recentScores;

        @Schema(description = "样本数", example = "8")
        private Integer sampleCount;

        @Schema(description = "数据来源", example = "backend-llm")
        private String source;

        @Schema(description = "过期时间戳(ms)", example = "1717852243000")
        private Long expiresAt;

        @Schema(description = "prompt 版本号", example = "1")
        private String promptVersion;

        @Schema(description = "用户 ID", example = "1234567890")
        private String userId;
    }
}
