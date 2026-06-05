-- user_mirror_profile: MBTI 博弈人格校准
CREATE TABLE IF NOT EXISTS user_mirror_profile (
    user_id       BIGINT       PRIMARY KEY COMMENT '用户ID',
    mbti_type     VARCHAR(4)   DEFAULT NULL COMMENT 'MBTI类型(如INTJ)',
    mbti_source   VARCHAR(16)  DEFAULT NULL COMMENT '来源: test/direct',
    mbti_confidence DECIMAL(5,2) DEFAULT NULL COMMENT '置信度 0-100',
    mbti_test_version VARCHAR(32) DEFAULT NULL COMMENT '测试版本',
    mbti_answers_json JSON      DEFAULT NULL COMMENT '测试原始答案',
    mbti_title    VARCHAR(64)  DEFAULT NULL COMMENT '中文称号',
    calibrated_at DATETIME     DEFAULT NULL COMMENT '校准时间',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='MBTI博弈人格校准';

-- mirror_birth_profile: 出生档案
CREATE TABLE IF NOT EXISTS mirror_birth_profile (
    user_id       BIGINT       PRIMARY KEY COMMENT '用户ID',
    calendar_type VARCHAR(16)  DEFAULT 'solar' COMMENT '历法: solar/lunar',
    birth_date    DATE         DEFAULT NULL COMMENT '出生日期',
    birth_time    VARCHAR(16)  DEFAULT NULL COMMENT '出生时间(HH:mm)',
    birth_place   VARCHAR(128) DEFAULT NULL COMMENT '出生地',
    timezone      VARCHAR(64)  DEFAULT 'Asia/Shanghai' COMMENT '时区',
    gender        VARCHAR(16)  DEFAULT NULL COMMENT '性别',
    extra_json    JSON         DEFAULT NULL COMMENT '扩展字段',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='出生档案';

-- mirror_report: 测试结果
CREATE TABLE IF NOT EXISTS mirror_report (
    id                BIGINT       PRIMARY KEY COMMENT '雪花ID',
    user_id           BIGINT       NOT NULL COMMENT '用户ID',
    tool_type         VARCHAR(64)  NOT NULL COMMENT '工具类型code',
    question          VARCHAR(512) DEFAULT NULL COMMENT '用户问题',
    title             VARCHAR(128) DEFAULT NULL COMMENT '结果标题',
    raw_result        JSON         DEFAULT NULL COMMENT 'taibu原始返回',
    normalized_result JSON         DEFAULT NULL COMMENT '标准化字段',
    mbti_snapshot     JSON         DEFAULT NULL COMMENT '当时MBTI快照',
    interpretation    JSON         DEFAULT NULL COMMENT '解释结果',
    summary           TEXT         DEFAULT NULL COMMENT '摘要',
    suggestions       JSON         DEFAULT NULL COMMENT '建议列表',
    warnings          JSON         DEFAULT NULL COMMENT '预警列表',
    theme_color       VARCHAR(16)  DEFAULT '#0A84FF' COMMENT '主题色',
    tag               VARCHAR(32)  DEFAULT NULL COMMENT '状态标签',
    source            VARCHAR(32)  DEFAULT 'taibu' COMMENT '来源: taibu/mimo/fallback',
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_user_tool (user_id, tool_type),
    INDEX idx_tool_created (tool_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='镜像测试结果';

-- mirror_daily_field: 每日场域缓存
CREATE TABLE IF NOT EXISTS mirror_daily_field (
    id              BIGINT       PRIMARY KEY COMMENT '雪花ID',
    user_id         BIGINT       NOT NULL COMMENT '用户ID',
    field_date      DATE         NOT NULL COMMENT '日期',
    almanac_result  JSON         DEFAULT NULL COMMENT '黄历结果',
    taiyi_result    JSON         DEFAULT NULL COMMENT '太乙结果',
    summary         VARCHAR(512) DEFAULT NULL COMMENT '摘要',
    tag             VARCHAR(32)  DEFAULT NULL COMMENT '状态标签',
    theme_color     VARCHAR(16)  DEFAULT '#0A84FF' COMMENT '主题色',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_date (user_id, field_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日场域缓存';
