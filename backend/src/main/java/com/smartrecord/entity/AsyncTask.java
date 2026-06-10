package com.smartrecord.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 异步任务实体
 */
@Data
@TableName("async_task")
public class AsyncTask {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    /** 任务类型 */
    private String taskType;

    /** 业务唯一键 */
    private String bizKey;

    /** 任务参数（JSON 字符串） */
    private String payload;

    /** 0 pending, 1 running, 2 success, 3 failed */
    private Integer status;

    /** 已重试次数 */
    private Integer retryCount;

    /** 最大重试次数 */
    private Integer maxRetry;

    /** 下次执行时间 */
    private LocalDateTime nextRunAt;

    /** 最后错误信息 */
    private String lastError;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
