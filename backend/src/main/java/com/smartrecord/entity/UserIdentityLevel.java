package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("user_identity_level")
public class UserIdentityLevel {

    @TableId(value = "user_id", type = IdType.INPUT)
    private Long userId;

    private Integer level;

    private Integer exp;

    private Integer stability;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
