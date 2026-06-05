package com.smartrecord.dto.round;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@Schema(description = "本局录响应")
public class RoundRecordResp {

    @Schema(description = "记录 ID")
    private Long id;

    @Schema(description = "房间 ID")
    private Long roomId;

    @Schema(description = "状态：1-等待成员填写 2-等待全员确认 3-已生效 4-已驳回 5-已取消")
    private Integer status;

    @Schema(description = "录入方式：1-房主填写 2-成员自填")
    private Integer inputMethod;

    @Schema(description = "信任模式：0-关闭 1-开启")
    private Integer trustMode;

    @Schema(description = "零和模式：0-关闭 1-开启")
    private Integer zeroSumRequired;

    @Schema(description = "发起人用户 ID")
    private Long createdBy;

    @Schema(description = "合计分数")
    private Integer totalScore;

    @Schema(description = "驳回人用户 ID")
    private Long rejectedBy;

    @Schema(description = "积分明细")
    private List<DetailVO> details;

    @Schema(description = "成员自填已提交数")
    private Integer memberSubmitted;

    @Schema(description = "成员总数")
    private Integer memberTotal;

    @Schema(description = "已确认数")
    private Integer confirmCount;

    @Schema(description = "需确认总数")
    private Integer confirmTotal;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Data
    @Builder
    @Schema(description = "积分明细条目")
    public static class DetailVO {

        @Schema(description = "用户 ID")
        private Long userId;

        @Schema(description = "昵称")
        private String nickname;

        @Schema(description = "头像 URL")
        private String avatarUrl;

        @Schema(description = "本局积分变化")
        private Integer score;

        @Schema(description = "成员自填阶段：是否已提交")
        private Boolean submitted;

        @Schema(description = "确认阶段：是否已同意（仅信任关闭时有值）")
        private Boolean confirmed;
    }
}
