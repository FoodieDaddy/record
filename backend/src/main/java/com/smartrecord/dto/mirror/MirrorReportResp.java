package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;

import java.util.List;
import java.util.Map;

@Data
@Builder
@Schema(description = "镜像测试结果详情")
public class MirrorReportResp {

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

    @Schema(description = "主题色", example = "#0A84FF")
    private String themeColor;

    @Schema(description = "用户问题")
    private String question;

    @Schema(description = "标准化结果")
    private Map<String, Object> normalizedResult;

    @Schema(description = "解释结果")
    private MirrorInterpretation interpretation;

    @Schema(description = "摘要")
    private String summary;

    @Schema(description = "建议列表")
    private List<String> suggestions;

    @Schema(description = "预警列表")
    private List<String> warnings;

    @Schema(description = "数据来源: taibu/mimo/fallback")
    private String source;

    @Schema(description = "创建时间", example = "2026-06-05 14:30")
    private String createdAt;

    @Schema(description = "MBTI快照")
    private Map<String, Object> mbtiSnapshot;

    @Schema(description = "原始结果(折叠)")
    private Map<String, Object> rawResult;
}
