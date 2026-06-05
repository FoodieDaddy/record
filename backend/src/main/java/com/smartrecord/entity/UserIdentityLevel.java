package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("user_identity_level")
public class UserIdentityLevel {

    @TableId(type = IdType.ASSIGN_ID)
    private Long userId;

    private Integer level;

    private Integer exp;

    private Integer stability;

    @TableField(fill = TableField.FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
