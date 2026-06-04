-- 昵称长度限制迁移脚本：VARCHAR(64) → VARCHAR(6)
-- 执行顺序：先截断历史数据，再改表结构

-- Step 1: 截断历史超长昵称（UTF8mb4 下 CHAR_LENGTH 按字符计数）
UPDATE `user` SET `nickname` = LEFT(`nickname`, 6) WHERE CHAR_LENGTH(`nickname`) > 6;

-- Step 2: 修改列类型
ALTER TABLE `user` MODIFY COLUMN `nickname` VARCHAR(6) NOT NULL DEFAULT '' COMMENT '昵称（最长6字符）';
