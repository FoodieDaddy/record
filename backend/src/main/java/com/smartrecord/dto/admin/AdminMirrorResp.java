package com.smartrecord.dto.admin;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Schema(description = "管理端镜像档案响应")
public class AdminMirrorResp {
    @Schema(example = "789")
    private Long userId;
    @Schema(example = "1")
    private Integer mbtiCode;
    @Schema(example = "test")
    private String mbtiSource;
    private BigDecimal mbtiConfidence;
    @Schema(example = "STRATEGIST")
    private String battlePersonaTag;
    @Schema(example = "策略家")
    private String battlePersonaTitle;
    @Schema(example = "10")
    private Integer sampleSize;
    private LocalDateTime calibratedAt;
    private LocalDateTime createdAt;

    public static AdminMirrorResp from(com.smartrecord.entity.UserMirrorProfile p) {
        AdminMirrorResp resp = new AdminMirrorResp();
        resp.setUserId(p.getUserId());
        resp.setMbtiCode(p.getMbtiCode());
        resp.setMbtiSource(p.getMbtiSource());
        resp.setMbtiConfidence(p.getMbtiConfidence());
        resp.setBattlePersonaTag(p.getBattlePersonaTag());
        resp.setBattlePersonaTitle(p.getBattlePersonaTitle());
        resp.setSampleSize(p.getSampleSize());
        resp.setCalibratedAt(p.getCalibratedAt());
        resp.setCreatedAt(p.getCreatedAt());
        return resp;
    }
}
