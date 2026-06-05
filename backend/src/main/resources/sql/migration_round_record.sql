-- 本局录模式迁移脚本
-- 执行顺序：先 ALTER room 表，再创建新表

-- Step 1: room 表新增字段
ALTER TABLE `room`
  ADD COLUMN `round_input_method` TINYINT NOT NULL DEFAULT 1 COMMENT '本局录入方式：1-房主填写 2-成员自填' AFTER `score_mode`,
  ADD COLUMN `trust_mode` TINYINT NOT NULL DEFAULT 1 COMMENT '信任模式：0-关闭 1-开启' AFTER `round_input_method`,
  ADD COLUMN `zero_sum_required` TINYINT NOT NULL DEFAULT 1 COMMENT '零和模式：0-关闭 1-开启' AFTER `trust_mode`;

-- Step 2: round_record 表（归档用，活跃期数据在 Redis）
CREATE TABLE IF NOT EXISTS `round_record` (
  `id`                 BIGINT       NOT NULL COMMENT '雪花 ID',
  `room_id`            BIGINT       NOT NULL COMMENT '房间 ID',
  `status`             TINYINT      NOT NULL COMMENT '1-PENDING_MEMBER_INPUT 2-PENDING_CONFIRM 3-APPLIED 4-REJECTED 5-CANCELLED',
  `input_method`       TINYINT      NOT NULL COMMENT '1-房主填写 2-成员自填',
  `trust_mode`         TINYINT      NOT NULL DEFAULT 1 COMMENT '0-关闭 1-开启',
  `zero_sum_required`  TINYINT      NOT NULL DEFAULT 1 COMMENT '0-关闭 1-开启',
  `created_by`         BIGINT       NOT NULL COMMENT '发起人（房主）',
  `total_score`        INT          NOT NULL DEFAULT 0 COMMENT '合计分数',
  `rejected_by`        BIGINT       DEFAULT NULL COMMENT '驳回人',
  `applied_at`         DATETIME     DEFAULT NULL COMMENT '生效时间',
  `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_room_status` (`room_id`, `status`),
  KEY `idx_room_created` (`room_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='本局录记录（归档）';

-- Step 3: round_record_detail 表
CREATE TABLE IF NOT EXISTS `round_record_detail` (
  `id`               BIGINT NOT NULL COMMENT '雪花 ID',
  `round_record_id`  BIGINT NOT NULL COMMENT '本局录 ID',
  `user_id`          BIGINT NOT NULL COMMENT '用户 ID',
  `score`            INT    NOT NULL COMMENT '本局积分变化',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_record_user` (`round_record_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='本局录积分明细';
