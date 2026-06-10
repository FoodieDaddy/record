-- V5__add_performance_indexes.sql
-- 性能优化：新增索引

-- fortune_log：按用户查询最近指令日志
CREATE INDEX idx_user_date ON fortune_log (user_id, created_at);

-- room：RoomTimeoutTask 扫描活跃编队
CREATE INDEX idx_status_active ON room (status, last_active_at);
