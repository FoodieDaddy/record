package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName(value = "room", autoResultMap = true)
public class Room {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String roomNo;

    private Long ownerId;

    /** 记分模式：1-自由流转 2-赢家统录 */
    private Integer scoreMode;

    /** 0-使用中 1-已归档 */
    private Integer status;

    /** 对局流水明细（settle 时归档） */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> allRecord;

    /** 最后一次记分/转账时间（超时判断依据） */
    private LocalDateTime lastActiveAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
