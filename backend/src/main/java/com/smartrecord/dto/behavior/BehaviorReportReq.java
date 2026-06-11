package com.smartrecord.dto.behavior;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 前端行为日志上报请求数据模型
 */
@Data
@Schema(description = "行为日志上报项")
public class BehaviorReportReq {

    @Schema(description = "行为类型标识", example = "PULSE_TRANSFER", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "行为类型不能为空")
    private String actionType;

    @Schema(description = "页面路径", example = "pages/room/room")
    private String pagePath;

    @Schema(description = "附加详情 (JSON字符串)", example = "{\"amount\":100,\"targetId\":2001}")
    private String payload;
}
