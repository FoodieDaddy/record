package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@Schema(description = "镜像首页聚合响应")
public class MirrorDashboardResp {

    @Schema(description = "MBTI人格信息")
    private ProfileInfo profile;

    @Schema(description = "今日场域")
    private DailyFieldInfo todayField;

    @Schema(description = "快速占测工具列表")
    private List<ToolItem> quickTools;

    @Schema(description = "命盘画像工具列表")
    private List<ToolItem> profileTools;

    @Schema(description = "高级推演工具列表")
    private List<ToolItem> advancedTools;

    @Schema(description = "最近测试结果")
    private List<RecentReport> recentReports;

    @Schema(description = "出生档案信息")
    private BirthProfileInfo birthProfile;

    @Data
    @Builder
    @Schema(description = "MBTI人格信息")
    public static class ProfileInfo {
        @Schema(description = "是否已校准", example = "true")
        private boolean calibrated;
        @Schema(description = "MBTI类型", example = "INTJ")
        private String mbtiType;
        @Schema(description = "中文称号", example = "冷静型控场者")
        private String mbtiTitle;
        @Schema(description = "置信度", example = "82.5")
        private BigDecimal confidence;
        @Schema(description = "来源", example = "test")
        private String mbtiSource;
        @Schema(description = "校准时间", example = "2026-06-05 14:30")
        private String calibratedAt;
    }

    @Data
    @Builder
    @Schema(description = "今日场域信息")
    public static class DailyFieldInfo {
        @Schema(description = "状态标签", example = "低频观察")
        private String tag;
        @Schema(description = "摘要", example = "今日适合复盘与稳定决策")
        private String summary;
        @Schema(description = "主题色", example = "#0A84FF")
        private String themeColor;
        @Schema(description = "日期", example = "2026-06-05")
        private String date;
    }

    @Data
    @Builder
    @Schema(description = "工具项")
    public static class ToolItem {
        @Schema(description = "工具标识", example = "tarot")
        private String key;
        @Schema(description = "工具code", example = "tarot")
        private String code;
        @Schema(description = "工具名称", example = "塔罗抽牌")
        private String name;
        @Schema(description = "工具描述", example = "探索潜意识与短期选择")
        private String desc;
        @Schema(description = "分类", example = "QUICK")
        private String category;
        @Schema(description = "是否锁定", example = "false")
        private boolean locked;
        @Schema(description = "锁定原因")
        private String lockReason;
        @Schema(description = "今日是否已用", example = "false")
        private boolean todayUsed;
    }

    @Data
    @Builder
    @Schema(description = "最近测试结果")
    public static class RecentReport {
        @Schema(description = "报告ID", example = "123456")
        private Long id;
        @Schema(description = "工具类型", example = "tarot")
        private String toolType;
        @Schema(description = "工具名称", example = "塔罗抽牌")
        private String toolName;
        @Schema(description = "标题", example = "塔罗抽牌 · 月亮逆位")
        private String title;
        @Schema(description = "标签", example = "守势")
        private String tag;
        @Schema(description = "创建时间", example = "2026-06-05 14:30")
        private String createdAt;
        @Schema(description = "时间描述", example = "3小时前")
        private String timeText;
    }

    @Data
    @Builder
    @Schema(description = "出生档案信息")
    public static class BirthProfileInfo {
        @Schema(description = "是否存在", example = "false")
        private boolean exists;
        @Schema(description = "简要描述", example = "1990年 阳历")
        private String briefText;
    }
}
