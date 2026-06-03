package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("score")
public class Score {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long sessionId;

    private Long roomId;

    /** 轮次号 */
    private Integer roundNo;

    /** 得分玩家 */
    private Long userId;

    /** 得分（可正可负） */
    private Integer score;

    /** 发起记分的人 */
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
