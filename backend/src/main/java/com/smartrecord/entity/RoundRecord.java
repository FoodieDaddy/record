package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("round_record")
public class RoundRecord {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long roomId;

    /** 1-PENDING_MEMBER_INPUT 2-PENDING_CONFIRM 3-APPLIED 4-REJECTED 5-CANCELLED */
    private Integer status;

    /** 1-房主填写 2-成员自填 */
    private Integer inputMethod;

    /** 0-关闭 1-开启 */
    private Integer trustMode;

    /** 0-关闭 1-开启 */
    private Integer zeroSumRequired;

    private Long createdBy;

    private Integer totalScore;

    private Long rejectedBy;

    private LocalDateTime appliedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
