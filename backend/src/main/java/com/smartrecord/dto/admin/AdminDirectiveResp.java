package com.smartrecord.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Schema(description = "管理端指令日志响应")
public class AdminDirectiveResp {
    @Schema(example = "123456")
    private Long id;
    @Schema(example = "789")
    private Long userId;
    @Schema(example = "req-xxx")
    private String requestId;
    @Schema(example = "WINNING_STREAK")
    private String userTag;
    @Schema(example = "llm")
    private String source;
    @Schema(example = "gpt-4")
    private String model;
    @Schema(example = "2000")
    private Integer durationMs;
    @Schema(example = "1")
    private Integer success;
    private String errorMsg;
    private LocalDateTime createdAt;

    public static AdminDirectiveResp from(com.smartrecord.entity.FortuneLog log) {
        AdminDirectiveResp resp = new AdminDirectiveResp();
        resp.setId(log.getId());
        resp.setUserId(log.getUserId());
        resp.setRequestId(log.getRequestId());
        resp.setUserTag(log.getUserTag());
        resp.setSource(log.getSource());
        resp.setModel(log.getModel());
        resp.setDurationMs(log.getDurationMs());
        resp.setSuccess(log.getSuccess());
        resp.setErrorMsg(log.getErrorMsg());
        resp.setCreatedAt(log.getCreatedAt());
        return resp;
    }
}
