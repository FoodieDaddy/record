-- 扩展 behavior_log.user_agent 字段长度
ALTER TABLE behavior_log MODIFY COLUMN user_agent VARCHAR(1024) DEFAULT NULL;
