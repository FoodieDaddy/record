-- 智能记分器数据库初始化脚本

CREATE TABLE IF NOT EXISTS `user` (
  `id`          BIGINT       NOT NULL COMMENT '雪花 ID',
  `openid`      VARCHAR(64)  NOT NULL COMMENT '微信 openid',
  `unionid`     VARCHAR(64)  DEFAULT NULL COMMENT '微信 unionid',
  `nickname`    VARCHAR(6)   NOT NULL DEFAULT '' COMMENT '昵称（最长6字符）',
  `avatar_url`  VARCHAR(512) NOT NULL DEFAULT '' COMMENT '头像 URL',
  `status`      TINYINT      NOT NULL DEFAULT 0 COMMENT '账号状态 0-正常 1-封禁 2-已注销',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

CREATE TABLE IF NOT EXISTS `user_detail` (
  `id`              BIGINT   NOT NULL COMMENT '与 user.id 相同',
  `voice_enabled`   TINYINT  NOT NULL DEFAULT 1 COMMENT '语音播报 0-关 1-开',
  `voice_id`        VARCHAR(64) DEFAULT 'std_01' COMMENT '音色 ID',
  `anim_enabled`    TINYINT  NOT NULL DEFAULT 1 COMMENT '动画 0-关 1-开',
  `vibrate_enabled` TINYINT  NOT NULL DEFAULT 1 COMMENT '震动 0-关 1-开',
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户详情/设置表';

CREATE TABLE IF NOT EXISTS `room` (
  `id`          BIGINT       NOT NULL COMMENT '雪花 ID',
  `room_no`     VARCHAR(8)   NOT NULL COMMENT '唯一房间号',
  `owner_id`    BIGINT       NOT NULL COMMENT '房主',
  `score_mode`  TINYINT      NOT NULL DEFAULT 1 COMMENT '记分模式：1-自由流转 2-赢家统录',
  `status`      TINYINT      NOT NULL DEFAULT 0 COMMENT '0-使用中 1-已归档',
  `all_record`    JSON         DEFAULT NULL COMMENT '对局流水明细（settle 时归档）',
  `last_active_at` DATETIME    DEFAULT NULL COMMENT '最后一次记分/转账时间',
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
  `joined_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `quit_time`    DATETIME DEFAULT NULL COMMENT '退出/结算时间',
  `final_score`  INT      DEFAULT NULL COMMENT '该用户本局最终净胜分',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_room_user` (`room_id`, `user_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房间成员表';

