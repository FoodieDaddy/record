-- 删除座位模式：移除 room_member 表的 seat_no 列及唯一约束
ALTER TABLE room_member DROP INDEX uk_room_seat;
ALTER TABLE room_member DROP COLUMN seat_no;
