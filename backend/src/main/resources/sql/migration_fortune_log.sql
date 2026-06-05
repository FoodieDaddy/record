-- 策略生成日志表：记录每次策略生成的 prompt、响应内容和耗时
CREATE TABLE IF NOT EXISTS `fortune_log` (
  `id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `user_tag` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '用户画像标签',
  `source` VARCHAR(10) NOT NULL DEFAULT '' COMMENT '数据来源: llm / fallback',
  `model` VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'LLM 模型名称',
  `prompt` TEXT COMMENT '用户 prompt 内容',
  `system_prompt` TEXT COMMENT '系统提示词',
  `raw_response` TEXT COMMENT 'LLM 原始响应 / fallback 描述',
  `result_json` TEXT COMMENT '最终 FortuneResp JSON',
  `duration_ms` INT NOT NULL DEFAULT 0 COMMENT '调用耗时(毫秒)',
  `success` TINYINT NOT NULL DEFAULT 1 COMMENT '是否成功: 1=成功 0=失败',
  `error_msg` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '错误信息',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='策略生成日志';
