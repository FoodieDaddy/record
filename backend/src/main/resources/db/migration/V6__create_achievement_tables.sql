-- db/migration/V6__create_achievement_tables.sql

-- 成就配置定义表
CREATE TABLE IF NOT EXISTS `achievement` (
  `id` bigint NOT NULL COMMENT '成就配置雪花ID',
  `name` varchar(64) NOT NULL COMMENT '成就名称',
  `description` varchar(255) NOT NULL COMMENT '达成条件描述',
  `cosmetic_type` int NOT NULL DEFAULT 0 COMMENT '解锁的装扮类型：0-无，1-特殊标识(badge)，2-头像框皮肤(border)，3-特殊语音(voice)，4-粒子特效(beam)',
  `cosmetic_payload` varchar(512) DEFAULT NULL COMMENT '装扮参数配置JSON/资源路径，例如 {"badge":"逆熵"} 或 {"avatarBorder":"matrix-blue"}',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='成就定义配置表';

-- 用户成就达成与装备关系表
CREATE TABLE IF NOT EXISTS `user_achievement` (
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `achievement_id` bigint NOT NULL COMMENT '成就配置ID',
  `status` int NOT NULL DEFAULT 0 COMMENT '状态：0-已解锁未装备，1-已装备',
  `unlocked_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '解锁达成时间',
  PRIMARY KEY (`user_id`, `achievement_id`),
  KEY `idx_achievement_id` (`achievement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户成就关系表';

-- 预置初始化系统内置成就
INSERT INTO `achievement` (`id`, `name`, `description`, `cosmetic_type`, `cosmetic_payload`) VALUES
(6001, '逆熵翻盘者', '在单场对局中，积分曾降至负分以下，但最终反超以正分完赛', 1, '{"badge":"逆熵"}'),
(6002, '星区领航员', '作为房间成员，累计在 5 场已结算的战局中获得第 1 名', 2, '{"avatarBorder":"apex-pilot-border"}'),
(6003, '慷慨信使', '在单场对局中，主动向他人发起转账记分次数达到 15 次以上', 1, '{"badge":"慷慨"}'),
(6004, '超导连接者', '在单场对局中，向至少 5 名不同的成员转账进行过记分互动', 4, '{"beamEffect":"superconductor-beam"}')
ON DUPLICATE KEY UPDATE 
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `cosmetic_type` = VALUES(`cosmetic_type`),
  `cosmetic_payload` = VALUES(`cosmetic_payload`);
