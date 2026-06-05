package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "mirror_daily_field", autoResultMap = true)
public class MirrorDailyField {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long userId;

    private LocalDate fieldDate;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> almanacResult;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> taiyiResult;

    private String summary;

    private String tag;

    private String themeColor;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
