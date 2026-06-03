package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("room")
public class Room {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String roomNo;

    private Long ownerId;

    private Integer baseScore;

    /** 记分模式：1-自由流转 2-赢家统录 */
    private Integer scoreMode;

    /** 0-使用中 1-已归档 */
    private Integer status;

    /** 已进行轮数 */
    private Integer roundCount;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
