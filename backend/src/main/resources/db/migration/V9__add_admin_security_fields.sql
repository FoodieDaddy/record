ALTER TABLE admin ADD COLUMN failed_attempts INT NOT NULL DEFAULT 0 AFTER status;
ALTER TABLE admin ADD COLUMN locked_until DATETIME NULL AFTER failed_attempts;
