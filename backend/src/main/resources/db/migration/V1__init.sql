-- V1__init.sql
-- 初始表结构，基于 MyBatis-Plus 实体类生成

-- 用户表
CREATE TABLE IF NOT EXISTS `user` (
    `id` BIGINT NOT NULL PRIMARY KEY,
    `openid` VARCHAR(128) DEFAULT NULL,
    `unionid` VARCHAR(128) DEFAULT NULL,
    `nickname` VARCHAR(64) DEFAULT NULL,
    `avatar_url` VARCHAR(512) DEFAULT NULL,
    `status` INT DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_openid` (`openid`),
    INDEX `idx_unionid` (`unionid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 用户详情表
CREATE TABLE IF NOT EXISTS `user_detail` (
    `id` BIGINT NOT NULL PRIMARY KEY,
    `voice_enabled` INT DEFAULT NULL,
    `voice_id` VARCHAR(64) DEFAULT NULL,
    `anim_enabled` INT DEFAULT NULL,
    `vibrate_enabled` INT DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户详情表';

-- 空间表
CREATE TABLE IF NOT EXISTS `room` (
    `id` BIGINT NOT NULL PRIMARY KEY,
    `room_no` VARCHAR(16) NOT NULL,
    `owner_id` BIGINT NOT NULL,
    `score_mode` INT DEFAULT NULL COMMENT '记分模式：1-自由流转 2-本局录入',
    `round_input_method` INT DEFAULT NULL COMMENT '本局录入方式：1-房主填写 2-成员自填',
    `trust_mode` INT DEFAULT NULL COMMENT '信任模式：0-关闭 1-开启',
    `zero_sum_required` INT DEFAULT NULL COMMENT '零和模式：0-关闭 1-开启',
    `status` INT DEFAULT NULL COMMENT '0-使用中 1-已归档',
    `all_record` JSON DEFAULT NULL COMMENT '对局流水明细（settle 时归档）',
    `last_active_at` DATETIME DEFAULT NULL COMMENT '最后一次记分/转账时间',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_room_no` (`room_no`),
    INDEX `idx_owner_id` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='空间表';

-- 空间成员表
CREATE TABLE IF NOT EXISTS `room_member` (
    `id` BIGINT NOT NULL PRIMARY KEY,
    `room_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `joined_at` DATETIME DEFAULT NULL,
    `quit_time` DATETIME DEFAULT NULL COMMENT '退出/结算时间',
    `final_score` INT DEFAULT NULL COMMENT '该用户本局最终净胜分',
    INDEX `idx_room_id` (`room_id`),
    INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='空间成员表';

-- 局记录表
CREATE TABLE IF NOT EXISTS `round_record` (
    `id` BIGINT NOT NULL PRIMARY KEY,
    `room_id` BIGINT NOT NULL,
    `status` INT DEFAULT NULL COMMENT '1-PENDING_MEMBER_INPUT 2-PENDING_CONFIRM 3-APPLIED 4-REJECTED 5-CANCELLED',
    `input_method` INT DEFAULT NULL COMMENT '1-房主填写 2-成员自填',
    `trust_mode` INT DEFAULT NULL COMMENT '0-关闭 1-开启',
    `zero_sum_required` INT DEFAULT NULL COMMENT '0-关闭 1-开启',
    `created_by` BIGINT DEFAULT NULL,
    `total_score` INT DEFAULT NULL,
    `rejected_by` BIGINT DEFAULT NULL,
    `applied_at` DATETIME DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_room_id` (`room_id`),
    INDEX `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='局记录表';

-- 局记录明细表
CREATE TABLE IF NOT EXISTS `round_record_detail` (
    `id` BIGINT NOT NULL PRIMARY KEY,
    `round_record_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `score` INT DEFAULT NULL,
    INDEX `idx_round_record_id` (`round_record_id`),
    INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='局记录明细表';

-- 用户身份等级表
CREATE TABLE IF NOT EXISTS `user_identity_level` (
    `user_id` BIGINT NOT NULL PRIMARY KEY,
    `level` INT DEFAULT NULL,
    `exp` INT DEFAULT NULL,
    `stability` INT DEFAULT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户身份等级表';

-- 用户镜像画像表
CREATE TABLE IF NOT EXISTS `user_mirror_profile` (
    `user_id` BIGINT NOT NULL PRIMARY KEY,
    `mbti_code` INT DEFAULT NULL,
    `mbti_source` VARCHAR(64) DEFAULT NULL,
    `mbti_confidence` DECIMAL(5,4) DEFAULT NULL,
    `mbti_test_version` VARCHAR(32) DEFAULT NULL,
    `mbti_answers_json` JSON DEFAULT NULL,
    `calibrated_at` DATETIME DEFAULT NULL,
    `battle_persona_tag` VARCHAR(64) DEFAULT NULL COMMENT '战绩人格标签',
    `battle_persona_title` VARCHAR(128) DEFAULT NULL COMMENT '战绩人格标题',
    `battle_persona_summary` VARCHAR(512) DEFAULT NULL COMMENT '战绩人格描述',
    `battle_persona_json` JSON DEFAULT NULL COMMENT '战绩画像详细数据 JSON',
    `sample_size` INT DEFAULT NULL COMMENT '样本数',
    `persona_calculated_at` DATETIME DEFAULT NULL COMMENT '画像计算时间',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户镜像画像表';

-- 镜像出生档案表
CREATE TABLE IF NOT EXISTS `mirror_birth_profile` (
    `user_id` BIGINT NOT NULL PRIMARY KEY,
    `calendar_type` VARCHAR(16) DEFAULT NULL,
    `birth_date` DATE DEFAULT NULL,
    `birth_time` VARCHAR(16) DEFAULT NULL,
    `birth_place` VARCHAR(128) DEFAULT NULL,
    `timezone` VARCHAR(32) DEFAULT NULL,
    `gender` VARCHAR(8) DEFAULT NULL,
    `extra_json` JSON DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='镜像出生档案表';

-- 策略日志表
CREATE TABLE IF NOT EXISTS `fortune_log` (
    `id` BIGINT NOT NULL PRIMARY KEY,
    `user_id` BIGINT DEFAULT NULL,
    `user_tag` VARCHAR(64) DEFAULT NULL,
    `source` VARCHAR(64) DEFAULT NULL,
    `model` VARCHAR(64) DEFAULT NULL,
    `prompt` TEXT DEFAULT NULL,
    `system_prompt` TEXT DEFAULT NULL,
    `raw_response` TEXT DEFAULT NULL,
    `result_json` TEXT DEFAULT NULL,
    `duration_ms` INT DEFAULT NULL,
    `success` INT DEFAULT NULL,
    `error_msg` VARCHAR(1024) DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_source` (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略日志表';
