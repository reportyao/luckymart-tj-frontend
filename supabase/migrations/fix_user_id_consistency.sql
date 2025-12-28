-- =====================================================
-- 修复用户ID不一致问题
-- 将拼团表的user_id从telegram_id改为UUID
-- =====================================================

-- 开始事务
BEGIN;

-- 1. 备份现有数据
CREATE TABLE IF NOT EXISTS group_buy_orders_backup AS SELECT * FROM group_buy_orders;
CREATE TABLE IF NOT EXISTS group_buy_sessions_backup AS SELECT * FROM group_buy_sessions;

-- 2. 删除现有外键约束
ALTER TABLE group_buy_orders DROP CONSTRAINT IF EXISTS group_buy_orders_user_id_fkey;
ALTER TABLE group_buy_sessions DROP CONSTRAINT IF EXISTS group_buy_sessions_initiator_id_fkey;
ALTER TABLE group_buy_sessions DROP CONSTRAINT IF EXISTS group_buy_sessions_winner_id_fkey;

-- 3. 添加新的UUID列
ALTER TABLE group_buy_orders ADD COLUMN IF NOT EXISTS user_uuid UUID;
ALTER TABLE group_buy_sessions ADD COLUMN IF NOT EXISTS initiator_uuid UUID;
ALTER TABLE group_buy_sessions ADD COLUMN IF NOT EXISTS winner_uuid UUID;

-- 4. 迁移数据: telegram_id → UUID
-- 更新 group_buy_orders.user_id
UPDATE group_buy_orders o
SET user_uuid = u.id
FROM users u
WHERE o.user_id = u.telegram_id;

-- 更新 group_buy_sessions.initiator_id
UPDATE group_buy_sessions s
SET initiator_uuid = u.id
FROM users u
WHERE s.initiator_id = u.telegram_id;

-- 更新 group_buy_sessions.winner_id (可能为NULL)
UPDATE group_buy_sessions s
SET winner_uuid = u.id
FROM users u
WHERE s.winner_id = u.telegram_id AND s.winner_id IS NOT NULL;

-- 5. 验证数据完整性
DO $$
DECLARE
  orders_null_count INTEGER;
  sessions_null_count INTEGER;
BEGIN
  -- 检查是否有未能转换的user_id
  SELECT COUNT(*) INTO orders_null_count
  FROM group_buy_orders
  WHERE user_uuid IS NULL;
  
  SELECT COUNT(*) INTO sessions_null_count
  FROM group_buy_sessions
  WHERE initiator_uuid IS NULL;
  
  IF orders_null_count > 0 THEN
    RAISE EXCEPTION 'Found % group_buy_orders with NULL user_uuid', orders_null_count;
  END IF;
  
  IF sessions_null_count > 0 THEN
    RAISE EXCEPTION 'Found % group_buy_sessions with NULL initiator_uuid', sessions_null_count;
  END IF;
  
  RAISE NOTICE 'Data integrity check passed';
END $$;

-- 6. 删除旧列
ALTER TABLE group_buy_orders DROP COLUMN user_id;
ALTER TABLE group_buy_sessions DROP COLUMN initiator_id;
ALTER TABLE group_buy_sessions DROP COLUMN winner_id;

-- 7. 重命名新列
ALTER TABLE group_buy_orders RENAME COLUMN user_uuid TO user_id;
ALTER TABLE group_buy_sessions RENAME COLUMN initiator_uuid TO initiator_id;
ALTER TABLE group_buy_sessions RENAME COLUMN winner_uuid TO winner_id;

-- 8. 设置NOT NULL约束(除了winner_id可以为NULL)
ALTER TABLE group_buy_orders ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE group_buy_sessions ALTER COLUMN initiator_id SET NOT NULL;
-- winner_id 可以为NULL,不设置NOT NULL约束

-- 9. 添加外键约束
ALTER TABLE group_buy_orders 
  ADD CONSTRAINT group_buy_orders_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE group_buy_sessions 
  ADD CONSTRAINT group_buy_sessions_initiator_id_fkey 
  FOREIGN KEY (initiator_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE group_buy_sessions 
  ADD CONSTRAINT group_buy_sessions_winner_id_fkey 
  FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL;

-- 10. 添加索引
CREATE INDEX IF NOT EXISTS idx_group_buy_orders_user_id ON group_buy_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_sessions_initiator_id ON group_buy_sessions(initiator_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_sessions_winner_id ON group_buy_sessions(winner_id);

-- 11. 更新group_buy_results表(如果存在winner_id字段)
DO $$
BEGIN
  -- 检查group_buy_results表是否存在winner_id列
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'group_buy_results' AND column_name = 'winner_id'
  ) THEN
    -- 备份
    CREATE TABLE IF NOT EXISTS group_buy_results_backup AS SELECT * FROM group_buy_results;
    
    -- 删除外键
    ALTER TABLE group_buy_results DROP CONSTRAINT IF EXISTS group_buy_results_winner_id_fkey;
    
    -- 添加新列
    ALTER TABLE group_buy_results ADD COLUMN IF NOT EXISTS winner_uuid UUID;
    
    -- 迁移数据
    UPDATE group_buy_results r
    SET winner_uuid = u.id
    FROM users u
    WHERE r.winner_id = u.telegram_id;
    
    -- 删除旧列,重命名新列
    ALTER TABLE group_buy_results DROP COLUMN winner_id;
    ALTER TABLE group_buy_results RENAME COLUMN winner_uuid TO winner_id;
    
    -- 添加外键
    ALTER TABLE group_buy_results 
      ADD CONSTRAINT group_buy_results_winner_id_fkey 
      FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL;
    
    -- 添加索引
    CREATE INDEX IF NOT EXISTS idx_group_buy_results_winner_id ON group_buy_results(winner_id);
    
    RAISE NOTICE 'group_buy_results table updated successfully';
  ELSE
    RAISE NOTICE 'group_buy_results.winner_id column not found, skipping';
  END IF;
END $$;

-- 提交事务
COMMIT;

-- 验证结果
DO $$
DECLARE
  orders_count INTEGER;
  sessions_count INTEGER;
  results_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orders_count FROM group_buy_orders;
  SELECT COUNT(*) INTO sessions_count FROM group_buy_sessions;
  SELECT COUNT(*) INTO results_count FROM group_buy_results WHERE winner_id IS NOT NULL;
  
  RAISE NOTICE '=== Migration Completed Successfully ===';
  RAISE NOTICE 'group_buy_orders: % rows', orders_count;
  RAISE NOTICE 'group_buy_sessions: % rows', sessions_count;
  RAISE NOTICE 'group_buy_results: % rows with winner_id', results_count;
  RAISE NOTICE '======================================';
END $$;
