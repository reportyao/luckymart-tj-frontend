-- 允许 showoffs 表的 user_id 字段为空,以支持运营晒单功能
-- 运营晒单没有真实用户,因此 user_id 可以为 null

ALTER TABLE showoffs ALTER COLUMN user_id DROP NOT NULL;

-- 添加注释说明
COMMENT ON COLUMN showoffs.user_id IS '用户ID,运营晒单(source=ADMIN)时可以为空';
