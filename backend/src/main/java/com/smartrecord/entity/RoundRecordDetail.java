package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("round_record_detail")
public class RoundRecordDetail {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long roundRecordId;

    private Long userId;

    private Integer score;
}
