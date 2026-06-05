package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;

@Data
@Builder
@Schema(description = "镜像档案列表项")
public class MirrorArchiveItem {

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

    @Schema(description = "问题摘要", example = "今晚适合主动进攻吗")
    private String questionBrief;

    @Schema(description = "创建时间", example = "2026-06-05 14:30")
    private String createdAt;

    @Schema(description = "时间描述", example = "3小时前")
    private String timeText;

    @Schema(description = "分类", example = "QUICK")
    private String category;
}
