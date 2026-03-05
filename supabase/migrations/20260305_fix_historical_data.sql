-- ============================================================================
-- 历史数据修复迁移 v4
-- 创建时间: 2026-03-05
-- ============================================================================
--
-- 修复内容:
--   1. 修复积分钱包的错误 currency 值: 'LUCKY_COIN' → 'POINTS'
--   2. 为 wallets 表的 version 列设置默认值
--   3. 初始化所有 NULL 的 version 为 1
--
-- 背景说明:
--   - 部分积分钱包在创建时错误地设置了 currency='LUCKY_COIN'
--   - 标准规范: 积分钱包 type='LUCKY_COIN', currency='POINTS'
--   - version 列用于乐观锁，所有钱包必须有有效的 version 值
--
-- ============================================================================

-- 1. 修复积分钱包的错误 currency 值
-- 将所有 type='LUCKY_COIN' 但 currency 不是 'POINTS' 的钱包统一修复
UPDATE wallets
SET
    currency = 'POINTS',
    updated_at = NOW()
WHERE type::TEXT = 'LUCKY_COIN'
  AND currency != 'POINTS';

-- 2. 为 version 列设置默认值（如果列已存在）
-- 确保新创建的钱包自动获得 version = 1
DO $$
BEGIN
    -- 检查 version 列是否存在
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wallets' AND column_name = 'version'
    ) THEN
        -- 设置默认值
        ALTER TABLE wallets ALTER COLUMN version SET DEFAULT 1;
        -- 初始化所有 NULL 的 version 为 1
        UPDATE wallets SET version = 1 WHERE version IS NULL;
    ELSE
        -- 如果 version 列不存在，创建它
        ALTER TABLE wallets ADD COLUMN version INTEGER DEFAULT 1;
        UPDATE wallets SET version = 1 WHERE version IS NULL;
    END IF;
END $$;

-- 3. 添加注释说明
COMMENT ON COLUMN wallets.version IS '乐观锁版本号，每次更新余额时递增。用于防止并发操作导致余额覆盖。';

-- ============================================================================
-- 迁移完成
-- ============================================================================
