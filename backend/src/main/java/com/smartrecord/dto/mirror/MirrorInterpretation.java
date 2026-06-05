package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;

import java.util.List;

@Data
@Builder
@Schema(description = "镜像解释结果")
public class MirrorInterpretation {

    @Schema(description = "标题", example = "低频观察")
    private String title;

    @Schema(description = "标签", example = "守势")
    private String tag;

    @Schema(description = "主题色", example = "#0A84FF")
    private String themeColor;

    @Schema(description = "置信度: LOW/MEDIUM/HIGH", example = "MEDIUM")
    private String confidence;

    @Schema(description = "摘要")
    private String summary;

    @Schema(description = "建议列表")
    private List<String> suggestions;

    @Schema(description = "预警列表")
    private List<String> warnings;
}
