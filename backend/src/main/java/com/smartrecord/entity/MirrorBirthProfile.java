package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "mirror_birth_profile", autoResultMap = true)
public class MirrorBirthProfile {

    @TableId(type = IdType.INPUT)
    private Long userId;

    private String calendarType;

    private LocalDate birthDate;

    private String birthTime;

    private String birthPlace;

    private String timezone;

    private String gender;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> extraJson;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
