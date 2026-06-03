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
  `score_mode`  TINYINT      NOT NULL DEFAULT 1 COMMENT '记分模式：1-自由流转 2-赢家统录',
  `status`      TINYINT      NOT NULL DEFAULT 0 COMMENT '0-使用中 1-已归档',
  `all_record`  JSON         DEFAULT NULL COMMENT '对局流水明细（settle 时归档）',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_room_no` (`room_no`),
  KEY `idx_owner_id` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房间表';

CREATE TABLE IF NOT EXISTS `room_member` (
  `id`           BIGINT   NOT NULL COMMENT '雪花 ID',
  `room_id`      BIGINT   NOT NULL,
  `user_id`      BIGINT   NOT NULL,
  `seat_no`      TINYINT  NOT NULL COMMENT '座位号 1-16',
  `joined_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `quit_time`    DATETIME DEFAULT NULL COMMENT '退出/结算时间',
  `final_score`  INT      DEFAULT NULL COMMENT '该用户本局最终净胜分',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_room_user` (`room_id`, `user_id`),
  UNIQUE KEY `uk_room_seat` (`room_id`, `seat_no`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房间成员表';

CREATE TABLE IF NOT EXISTS `score` (
  `id`          BIGINT   NOT NULL COMMENT '雪花 ID',
  `room_id`     BIGINT   NOT NULL,
  `user_id`     BIGINT   NOT NULL,
  `score`       INT      NOT NULL,
  `created_by`  BIGINT   NOT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_room_user` (`room_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='得分记录表';

CREATE TABLE IF NOT EXISTS `score_image` (
  `id`         BIGINT       NOT NULL COMMENT '雪花 ID',
  `room_id`    BIGINT       NOT NULL,
  `user_id`    BIGINT       NOT NULL,
  `image_url`  VARCHAR(512) NOT NULL,
  `sort_order` TINYINT      NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_room_id` (`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='得分图片表';
