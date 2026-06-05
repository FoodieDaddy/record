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

    private Integer mbtiCode;

    private String mbtiSource;

    private BigDecimal mbtiConfidence;

    private String mbtiTestVersion;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Object> mbtiAnswersJson;

    private LocalDateTime calibratedAt;

    /** 战绩人格标签 */
    private String battlePersonaTag;

    /** 战绩人格标题 */
    private String battlePersonaTitle;

    /** 战绩人格描述 */
    private String battlePersonaSummary;

    /** 战绩画像详细数据 JSON */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private java.util.Map<String, Object> battlePersonaJson;

    /** 样本数 */
    private Integer sampleSize;

    /** 画像计算时间 */
    private LocalDateTime personaCalculatedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
