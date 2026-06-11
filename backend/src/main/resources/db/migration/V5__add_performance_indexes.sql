-- V5__add_performance_indexes.sql
-- 性能优化：新增索引（幂等版本）

DROP PROCEDURE IF EXISTS CreateIndexIfNotExists;
DELIMITER $$
CREATE PROCEDURE CreateIndexIfNotExists(
    IN tableName VARCHAR(128),
    IN indexName VARCHAR(128),
    IN indexColumns VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = tableName
          AND index_name = indexName
    ) THEN
        SET @sql = CONCAT('CREATE INDEX ', indexName, ' ON ', tableName, ' (', indexColumns, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END $$
DELIMITER ;

CALL CreateIndexIfNotExists('fortune_log', 'idx_user_date', 'user_id, created_at');
CALL CreateIndexIfNotExists('room', 'idx_status_active', 'status, last_active_at');

DROP PROCEDURE CreateIndexIfNotExists;
