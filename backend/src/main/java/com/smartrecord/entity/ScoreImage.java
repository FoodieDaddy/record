package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("score_image")
public class ScoreImage {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long sessionId;

    private Long roomId;

    /** 轮次号 */
    private Integer roundNo;

    /** 上传者 */
    private Long userId;

    private String imageUrl;

    private Integer sortOrder;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
