-- MBTI 存储重构：字符串 → 数字编号
-- 1. 添加 mbti_code 列
-- 2. 从旧字符串列迁移数据
-- 3. 删除旧列

ALTER TABLE user_mirror_profile ADD COLUMN mbti_code INT DEFAULT 0 AFTER user_id;

UPDATE user_mirror_profile SET mbti_code = CASE mbti_type
  WHEN 'INTJ' THEN 1  WHEN 'INTP' THEN 2  WHEN 'ENTJ' THEN 3  WHEN 'ENTP' THEN 4
  WHEN 'INFJ' THEN 5  WHEN 'INFP' THEN 6  WHEN 'ENFJ' THEN 7  WHEN 'ENFP' THEN 8
  WHEN 'ISTJ' THEN 9  WHEN 'ISFJ' THEN 10 WHEN 'ESTJ' THEN 11 WHEN 'ESFJ' THEN 12
  WHEN 'ISTP' THEN 13 WHEN 'ISFP' THEN 14 WHEN 'ESTP' THEN 15 WHEN 'ESFP' THEN 16
  ELSE 0 END;

ALTER TABLE user_mirror_profile DROP COLUMN mbti_type;
ALTER TABLE user_mirror_profile DROP COLUMN mbti_title;
