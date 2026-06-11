CREATE TABLE IF NOT EXISTS `behavior_log` (
  `id`          BIGINT       NOT NULL,
  `user_id`     BIGINT       DEFAULT NULL,
  `action_type` VARCHAR(64)  NOT NULL,
  `page_path`   VARCHAR(128) DEFAULT NULL,
  `payload`     TEXT         DEFAULT NULL,
  `ip`          VARCHAR(64)  DEFAULT NULL,
  `user_agent`  VARCHAR(256) DEFAULT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id`    (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
