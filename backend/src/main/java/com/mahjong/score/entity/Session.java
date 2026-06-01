package com.mahjong.score.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("session")
public class Session {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long roomId;

    /** 房间内场次序号 */
    private Integer sessionNo;

    private String title;

    /** 0-进行中 1-已结算 */
    private Integer status;

    /** 记分笔数 */
    private Integer scoreCount;

    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    private LocalDateTime settledAt;
}
