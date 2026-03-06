-- ============================================================================
-- Migration: BUG-008/009/011/012/013 修复
-- Date: 2026-03-06
-- Description: 
--   BUG-009: increase_user_balance 创建钱包时补充缺失字段
--   BUG-011: 清理未使用的数据库索引
--   BUG-012: 备份表添加主键
--   BUG-013: 创建充值拒绝通知模板（代码层修复）
-- ============================================================================

-- ============================================================================
-- BUG-009: 修复 increase_user_balance RPC 函数
-- 问题: 创建新钱包时只设置了 user_id, type, balance，缺少 currency, version 等字段
-- 修复: 补充 currency, version, frozen_balance, total_deposits 等字段
-- ============================================================================

CREATE OR REPLACE FUNCTION increase_user_balance(
    p_user_id TEXT,
    p_amount DECIMAL,
    p_wallet_type TEXT DEFAULT 'TJS'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id UUID;
    v_current_balance DECIMAL(10,2);
    v_currency TEXT;
BEGIN
    -- 根据钱包类型确定对应的 currency 值
    -- 生产数据: TJS 钱包 → currency='TJS', LUCKY_COIN 钱包 → currency='POINTS'
    IF p_wallet_type = 'TJS' THEN
        v_currency := 'TJS';
    ELSIF p_wallet_type = 'LUCKY_COIN' THEN
        v_currency := 'POINTS';
    ELSE
        v_currency := p_wallet_type;
    END IF;

    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM wallets
    WHERE user_id = p_user_id AND type = p_wallet_type
    FOR UPDATE;
    
    IF v_wallet_id IS NULL THEN
        -- 创建新钱包时设置所有必要字段
        INSERT INTO wallets (
            user_id, 
            type, 
            currency,
            balance, 
            frozen_balance,
            version,
            total_deposits,
            total_withdrawals,
            first_deposit_bonus_claimed,
            first_deposit_bonus_amount,
            is_active,
            is_bonus,
            created_at,
            updated_at
        )
        VALUES (
            p_user_id, 
            p_wallet_type, 
            v_currency,
            p_amount, 
            0,           -- frozen_balance
            1,           -- version
            0,           -- total_deposits
            0,           -- total_withdrawals
            false,       -- first_deposit_bonus_claimed
            0,           -- first_deposit_bonus_amount
            true,        -- is_active
            false,       -- is_bonus
            NOW(),
            NOW()
        )
        RETURNING id INTO v_wallet_id;
        v_current_balance := 0;
    ELSE
        UPDATE wallets
        SET balance = balance + p_amount, 
            updated_at = NOW()
        WHERE id = v_wallet_id;
    END IF;
    
    INSERT INTO wallet_transactions (wallet_id, type, amount, balance_before, balance_after, status, created_at)
    VALUES (v_wallet_id, 'INCREASE', p_amount, v_current_balance, v_current_balance + p_amount, 'COMPLETED', NOW());
    
    RETURN TRUE;
END;
$$;

-- 确保权限正确
GRANT EXECUTE ON FUNCTION increase_user_balance(TEXT, DECIMAL, TEXT) TO service_role;

-- ============================================================================
-- BUG-011: 清理未使用的数据库索引
-- 条件: idx_scan = 0（从未被查询使用过）
-- 排除: 主键索引（_pkey）、唯一约束索引（_key）—— 这些有数据完整性作用
-- 排除: 可能在 RPC 函数中隐式使用的索引
-- ============================================================================

-- 安全删除的非唯一索引（纯查询优化索引，从未被使用）
-- error_logs 表的索引（日志表，查询频率低）
DROP INDEX IF EXISTS idx_error_logs_page_route;
DROP INDEX IF EXISTS idx_error_logs_error_type;
DROP INDEX IF EXISTS idx_error_logs_status;
DROP INDEX IF EXISTS idx_error_logs_user_id;

-- prizes 表的索引（未使用的查询索引）
DROP INDEX IF EXISTS idx_prizes_user_id;
DROP INDEX IF EXISTS idx_prizes_lottery_id;
DROP INDEX IF EXISTS idx_prizes_status;
DROP INDEX IF EXISTS idx_prizes_pickup_code;
DROP INDEX IF EXISTS idx_prizes_expires_at;

-- pickup_logs 表的索引
DROP INDEX IF EXISTS idx_pickup_logs_prize_id;

-- shipment_batches 表的索引
DROP INDEX IF EXISTS idx_shipment_batches_batch_no;
DROP INDEX IF EXISTS idx_shipment_batches_shipped_at;

-- batch_order_items 表的索引
DROP INDEX IF EXISTS idx_batch_order_items_user_id;
DROP INDEX IF EXISTS idx_batch_order_items_product_sku;

-- group_buy_products 表的索引
DROP INDEX IF EXISTS idx_group_buy_products_is_active;

-- promoter_settlements 表的索引
DROP INDEX IF EXISTS idx_promoter_settlements_status;

-- dead_letter_queue 表的索引
DROP INDEX IF EXISTS idx_dead_letter_queue_status;
DROP INDEX IF EXISTS idx_dead_letter_queue_created_at;

-- users 表的非唯一索引（保留唯一约束索引）
DROP INDEX IF EXISTS idx_users_referred_by;

-- 注意：以下索引虽然 idx_scan=0，但属于唯一约束，不能删除：
-- wallets_user_id_type_key (唯一约束，保证每用户每类型只有一个钱包)
-- users_telegram_id_key (唯一约束，保证 telegram_id 唯一)
-- users_referral_code_key (唯一约束，保证推荐码唯一)
-- group_buy_results_session_id_key (唯一约束)
-- full_purchase_orders_order_number_key (唯一约束)

-- ============================================================================
-- BUG-012: 备份表和临时表添加主键
-- 涉及表: group_buy_orders_backup, group_buy_sessions_backup, 
--         sessions_null_count, col_type
-- ============================================================================

-- group_buy_orders_backup: 已有 id (uuid) 列，直接设为主键
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'group_buy_orders_backup' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE group_buy_orders_backup ADD PRIMARY KEY (id);
    END IF;
END $$;

-- group_buy_sessions_backup: 已有 id (uuid) 列，直接设为主键
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'group_buy_sessions_backup' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE group_buy_sessions_backup ADD PRIMARY KEY (id);
    END IF;
END $$;

-- sessions_null_count: 只有一个 count 列，添加自增主键
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sessions_null_count' 
        AND column_name = 'id'
    ) THEN
        ALTER TABLE sessions_null_count ADD COLUMN id SERIAL PRIMARY KEY;
    END IF;
END $$;

-- col_type: 只有一个 data_type 列，添加自增主键
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'col_type' 
        AND column_name = 'id'
    ) THEN
        ALTER TABLE col_type ADD COLUMN id SERIAL PRIMARY KEY;
    END IF;
END $$;
