-- 智能记分器数据库初始化脚本

CREATE TABLE IF NOT EXISTS `user` (
  `id`          BIGINT       NOT NULL COMMENT '雪花 ID',
  `openid`      VARCHAR(64)  NOT NULL COMMENT '微信 openid',
  `unionid`     VARCHAR(64)  DEFAULT NULL COMMENT '微信 unionid',
  `nickname`    VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '昵称',
  `avatar_url`  VARCHAR(512) NOT NULL DEFAULT '' COMMENT '头像 URL',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

CREATE TABLE IF NOT EXISTS `room` (
  `id`          BIGINT       NOT NULL COMMENT '雪花 ID',
  `room_no`     VARCHAR(8)   NOT NULL COMMENT '唯一房间号',
  `owner_id`    BIGINT       NOT NULL COMMENT '房主',
  `base_score`  INT          NOT NULL DEFAULT 1 COMMENT '底分',
  `score_mode`  TINYINT      NOT NULL DEFAULT 1 COMMENT '记分模式：1-自由流转 2-赢家统录',
  `status`      TINYINT      NOT NULL DEFAULT 0 COMMENT '0-使用中 1-已归档',
  `round_count` INT          NOT NULL DEFAULT 0 COMMENT '已进行轮数',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_room_no` (`room_no`),
  KEY `idx_owner_id` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房间表';

CREATE TABLE IF NOT EXISTS `room_member` (
  `id`        BIGINT   NOT NULL COMMENT '雪花 ID',
  `room_id`   BIGINT   NOT NULL,
  `user_id`   BIGINT   NOT NULL,
  `seat_no`   TINYINT  NOT NULL COMMENT '座位号 1-8',
  `joined_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_room_user` (`room_id`, `user_id`),
  UNIQUE KEY `uk_room_seat` (`room_id`, `seat_no`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房间成员表';

CREATE TABLE IF NOT EXISTS `session` (
  `id`          BIGINT      NOT NULL COMMENT '雪花 ID',
  `room_id`     BIGINT      NOT NULL,
  `session_no`  INT         NOT NULL COMMENT '场次序号',
  `title`       VARCHAR(64) DEFAULT NULL,
  `status`      TINYINT     NOT NULL DEFAULT 0 COMMENT '0-进行中 1-已结算',
  `score_count` INT         NOT NULL DEFAULT 0,
  `created_by`  BIGINT      NOT NULL,
  `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `settled_at`  DATETIME    DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_room_session_no` (`room_id`, `session_no`),
  KEY `idx_room_id` (`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='场次表';

CREATE TABLE IF NOT EXISTS `score` (
  `id`          BIGINT   NOT NULL COMMENT '雪花 ID',
  `session_id`  BIGINT   NOT NULL DEFAULT 0 COMMENT '兼容旧数据',
  `room_id`     BIGINT   NOT NULL,
  `round_no`    INT      NOT NULL DEFAULT 1 COMMENT '轮次号',
  `user_id`     BIGINT   NOT NULL,
  `score`       INT      NOT NULL,
  `created_by`  BIGINT   NOT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_room_round` (`room_id`, `round_no`),
  KEY `idx_room_user` (`room_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='得分记录表';

CREATE TABLE IF NOT EXISTS `score_image` (
  `id`         BIGINT       NOT NULL COMMENT '雪花 ID',
  `session_id` BIGINT       NOT NULL DEFAULT 0 COMMENT '兼容旧数据',
  `room_id`    BIGINT       NOT NULL,
  `round_no`   INT          NOT NULL DEFAULT 1 COMMENT '轮次号',
  `user_id`    BIGINT       NOT NULL,
  `image_url`  VARCHAR(512) NOT NULL,
  `sort_order` TINYINT      NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_room_round` (`room_id`, `round_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='得分图片表';

-- 用户对局汇总表（永久保留）
CREATE TABLE IF NOT EXISTS `session_record` (
  `id`           BIGINT   NOT NULL COMMENT '雪花 ID',
  `session_id`   BIGINT   NOT NULL COMMENT '关联 session',
  `user_id`      BIGINT   NOT NULL COMMENT '用户 ID',
  `total_score`  INT      NOT NULL DEFAULT 0 COMMENT '该用户本局总净胜分',
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_user` (`session_id`, `user_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户对局汇总表';

-- 对局流水明细表（90天过期清理）
CREATE TABLE IF NOT EXISTS `session_event_log` (
  `id`           BIGINT  NOT NULL COMMENT '雪花 ID',
  `session_id`   BIGINT  NOT NULL COMMENT '关联 session',
  `events_data`  JSON    NOT NULL COMMENT '该局所有批次的结构化流水',
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对局流水明细表';
