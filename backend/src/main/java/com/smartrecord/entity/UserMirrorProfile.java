package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName(value = "user_mirror_profile", autoResultMap = true)
public class UserMirrorProfile {

    @TableId(type = IdType.INPUT)
    private Long userId;

    private String mbtiType;

    private String mbtiSource;

    private BigDecimal mbtiConfidence;

    private String mbtiTestVersion;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Object> mbtiAnswersJson;

    private String mbtiTitle;

    private LocalDateTime calibratedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
