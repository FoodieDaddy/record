package com.mahjong.score.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("session_record")
public class SessionRecord {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long sessionId;

    private Long userId;

    /** 该用户本局总净胜分 */
    private Integer totalScore;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
