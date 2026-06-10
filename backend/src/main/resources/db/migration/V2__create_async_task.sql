-- V2__create_async_task.sql
-- 异步任务持久化表

CREATE TABLE IF NOT EXISTS `async_task` (
    `id` BIGINT NOT NULL PRIMARY KEY,
    `task_type` VARCHAR(64) NOT NULL COMMENT '任务类型',
    `biz_key` VARCHAR(128) NOT NULL COMMENT '业务唯一键',
    `payload` JSON COMMENT '任务参数',
    `status` TINYINT NOT NULL DEFAULT 0 COMMENT '0 pending, 1 running, 2 success, 3 failed',
    `retry_count` INT NOT NULL DEFAULT 0 COMMENT '已重试次数',
    `max_retry` INT NOT NULL DEFAULT 5 COMMENT '最大重试次数',
    `next_run_at` DATETIME NOT NULL COMMENT '下次执行时间',
    `last_error` VARCHAR(1024) COMMENT '最后错误信息',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_task_type_biz_key` (`task_type`, `biz_key`),
    INDEX `idx_status_next_run` (`status`, `next_run_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='异步任务表';
