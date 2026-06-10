CREATE TABLE IF NOT EXISTS `audit_log` (
  `id`          BIGINT       NOT NULL,
  `admin_id`    BIGINT       DEFAULT NULL,
  `admin_name`  VARCHAR(64)  DEFAULT NULL,
  `action_type` VARCHAR(32)  NOT NULL,
  `target_type` VARCHAR(32)  DEFAULT NULL,
  `target_id`   VARCHAR(64)  DEFAULT NULL,
  `ip`          VARCHAR(64)  DEFAULT NULL,
  `result`      VARCHAR(16)  DEFAULT '成功',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_id`   (`admin_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
