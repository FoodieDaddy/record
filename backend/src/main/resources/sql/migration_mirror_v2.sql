-- 镜像模块 v2: 新增战绩人格画像字段
ALTER TABLE user_mirror_profile
  ADD COLUMN battle_persona_tag VARCHAR(64) DEFAULT NULL COMMENT '战绩人格标签' AFTER mbti_title,
  ADD COLUMN battle_persona_title VARCHAR(64) DEFAULT NULL COMMENT '战绩人格标题' AFTER battle_persona_tag,
  ADD COLUMN battle_persona_summary TEXT DEFAULT NULL COMMENT '战绩人格描述' AFTER battle_persona_title,
  ADD COLUMN battle_persona_json JSON DEFAULT NULL COMMENT '画像详细数据' AFTER battle_persona_summary,
  ADD COLUMN sample_size INT DEFAULT 0 COMMENT '样本数' AFTER battle_persona_json,
  ADD COLUMN persona_calculated_at DATETIME DEFAULT NULL COMMENT '画像计算时间' AFTER sample_size;
