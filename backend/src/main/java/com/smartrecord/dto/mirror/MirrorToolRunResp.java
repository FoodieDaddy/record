package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;

import java.util.Map;

@Data
@Builder
@Schema(description = "镜像工具运行响应")
public class MirrorToolRunResp {

    @Schema(description = "报告ID", example = "123456")
    private Long reportId;

    @Schema(description = "工具类型", example = "meihua")
    private String tool;

    @Schema(description = "工具名称", example = "梅花易数")
    private String toolName;

    @Schema(description = "标题", example = "梅花易数 · 雷风恒")
    private String title;

    @Schema(description = "标签", example = "守势")
    private String tag;

    @Schema(description = "主题色", example = "#0A84FF")
    private String themeColor;

    @Schema(description = "问题", example = "今晚适合主动进攻吗")
    private String question;

    @Schema(description = "标准化结果")
    private Map<String, Object> normalizedResult;

    @Schema(description = "解释结果")
    private MirrorInterpretation interpretation;

    @Schema(description = "数据来源", example = "taibu")
    private String source;
}
