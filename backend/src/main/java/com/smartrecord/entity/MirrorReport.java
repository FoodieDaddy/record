package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName(value = "mirror_report", autoResultMap = true)
public class MirrorReport {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long userId;

    private String toolType;

    private String question;

    private String title;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> rawResult;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> normalizedResult;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> mbtiSnapshot;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> interpretation;

    private String summary;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> suggestions;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> warnings;

    private String themeColor;

    private String tag;

    private String source;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
