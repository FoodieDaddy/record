package com.smartrecord.dto.mirror;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;

@Data
@Builder
@Schema(description = "今日场域响应")
public class DailyFieldResp {

    @Schema(description = "状态标签", example = "低频观察")
    private String tag;

    @Schema(description = "摘要", example = "今日适合复盘与稳定决策")
    private String summary;

    @Schema(description = "主题色", example = "#0A84FF")
    private String themeColor;

    @Schema(description = "日期", example = "2026-06-05")
    private String date;
}
