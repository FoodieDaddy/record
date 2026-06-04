package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("user_detail")
public class UserDetail {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Integer voiceEnabled;

    private String voiceId;

    private Integer animEnabled;

    private Integer vibrateEnabled;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
