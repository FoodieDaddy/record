package com.mahjong.score.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("transfer")
public class Transfer {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long roomId;

    private Long fromUserId;

    private Long toUserId;

    /** 金额（分） */
    private Integer amount;

    private String remark;

    /** 0-正常 1-已撤回 */
    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
