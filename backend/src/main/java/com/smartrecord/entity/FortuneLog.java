package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("fortune_log")
public class FortuneLog {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long userId;

    private String userTag;

    private String source;

    private String model;

    private String prompt;

    private String systemPrompt;

    private String rawResponse;

    private String resultJson;

    private Integer durationMs;

    private Integer success;

    private String errorMsg;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
