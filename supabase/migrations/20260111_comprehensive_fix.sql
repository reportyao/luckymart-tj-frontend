-- ============================================
-- 全面修复脚本 - 2026年1月11日
-- 修复以下问题：
-- 1. payment_config 表名不一致
-- 2. lotteries.inventory_product_id 字段类型问题
-- 3. group_buy_results.claimed_at 字段缺失
-- 4. 转盘奖励积分相关函数
-- ============================================

-- ============================================
-- 1. 修复 payment_config 表名问题
-- 创建 payment_config 视图指向 payment_configs 表
-- ============================================

-- 如果 payment_config 表不存在，创建一个视图指向 payment_configs
DO $$
BEGIN
    -- 检查 payment_config 表是否存在
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_config') THEN
        -- 检查 payment_configs 表是否存在
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_configs') THEN
            -- 创建视图
            CREATE OR REPLACE VIEW payment_config AS SELECT * FROM payment_configs;
            RAISE NOTICE 'Created view payment_config pointing to payment_configs';
        ELSE
            -- 创建 payment_config 表
            CREATE TABLE payment_config (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                type VARCHAR(50) NOT NULL,
                config_type VARCHAR(50) NOT NULL DEFAULT 'DEPOSIT',
                account_info JSONB,
                qr_code_url TEXT,
                instructions TEXT,
                instructions_i18n JSONB,
                is_enabled BOOLEAN DEFAULT true,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            RAISE NOTICE 'Created table payment_config';
        END IF;
    END IF;
END $$;

-- 确保 payment_configs 表有 provider 字段（如果使用的是 payment_configs）
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_configs') THEN
        -- 添加 provider 字段（如果不存在）
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment_configs' AND column_name = 'provider') THEN
            ALTER TABLE payment_configs ADD COLUMN provider VARCHAR(100);
        END IF;
        -- 添加 config_type 字段（如果不存在）
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment_configs' AND column_name = 'config_type') THEN
            ALTER TABLE payment_configs ADD COLUMN config_type VARCHAR(50) DEFAULT 'DEPOSIT';
        END IF;
    END IF;
END $$;

-- ============================================
-- 2. 修复 lotteries.inventory_product_id 字段
-- 将类型从 integer 改为 TEXT（兼容 UUID 和 SKU）
-- ============================================

DO $$
DECLARE
    col_type TEXT;
BEGIN
    -- 获取当前字段类型
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'lotteries' AND column_name = 'inventory_product_id';
    
    IF col_type IS NOT NULL THEN
        IF col_type = 'integer' THEN
            -- 如果是 integer 类型，先删除再重新添加为 TEXT
            ALTER TABLE lotteries DROP COLUMN inventory_product_id;
            ALTER TABLE lotteries ADD COLUMN inventory_product_id TEXT;
            RAISE NOTICE 'Changed lotteries.inventory_product_id from integer to TEXT';
        ELSIF col_type = 'uuid' THEN
            -- 如果是 UUID 类型，转换为 TEXT
            ALTER TABLE lotteries ALTER COLUMN inventory_product_id TYPE TEXT USING inventory_product_id::TEXT;
            RAISE NOTICE 'Changed lotteries.inventory_product_id from uuid to TEXT';
        END IF;
    ELSE
        -- 字段不存在，添加为 TEXT 类型
        ALTER TABLE lotteries ADD COLUMN inventory_product_id TEXT;
        RAISE NOTICE 'Added lotteries.inventory_product_id as TEXT';
    END IF;
END $$;

-- 添加其他可能缺失的字段
ALTER TABLE lotteries ADD COLUMN IF NOT EXISTS full_purchase_enabled BOOLEAN DEFAULT false;
ALTER TABLE lotteries ADD COLUMN IF NOT EXISTS full_purchase_price DECIMAL(10,2);
ALTER TABLE lotteries ADD COLUMN IF NOT EXISTS price_comparisons JSONB;
ALTER TABLE lotteries ADD COLUMN IF NOT EXISTS image_urls TEXT[];

-- ============================================
-- 3. 修复 group_buy_results 表
-- 添加缺失的 claimed_at 字段
-- ============================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'group_buy_results') THEN
        -- 添加 claimed_at 字段
        ALTER TABLE group_buy_results ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;
        -- 添加其他可能缺失的字段
        ALTER TABLE group_buy_results ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(20);
        ALTER TABLE group_buy_results ADD COLUMN IF NOT EXISTS pickup_status VARCHAR(50) DEFAULT 'PENDING_CLAIM';
        ALTER TABLE group_buy_results ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE group_buy_results ADD COLUMN IF NOT EXISTS pickup_point_id UUID;
        RAISE NOTICE 'Added missing columns to group_buy_results';
    END IF;
END $$;

-- ============================================
-- 4. 确保转盘奖励相关表和函数存在
-- ============================================

-- 确保 spin_records 表存在
CREATE TABLE IF NOT EXISTS spin_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    reward_id UUID,
    reward_name VARCHAR(100),
    reward_type VARCHAR(50),
    reward_amount DECIMAL(10,2),
    is_winner BOOLEAN DEFAULT false,
    spin_source VARCHAR(50) DEFAULT 'user_spin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 确保 user_spin_balance 表存在
CREATE TABLE IF NOT EXISTS user_spin_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    spin_count INTEGER DEFAULT 0,
    total_spins_used INTEGER DEFAULT 0,
    last_spin_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 确保 spin_rewards 表存在
CREATE TABLE IF NOT EXISTS spin_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reward_name VARCHAR(100) NOT NULL,
    reward_name_i18n JSONB,
    reward_type VARCHAR(50) NOT NULL DEFAULT 'LUCKY_COIN',
    reward_amount DECIMAL(10,2) DEFAULT 0,
    probability DECIMAL(10,5) NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_jackpot BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建或替换 deduct_user_spin_count 函数
CREATE OR REPLACE FUNCTION deduct_user_spin_count(
    p_user_id TEXT,
    p_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_count INTEGER;
BEGIN
    -- 获取当前抽奖次数
    SELECT spin_count INTO v_current_count
    FROM user_spin_balance
    WHERE user_id = p_user_id;
    
    IF v_current_count IS NULL OR v_current_count < p_count THEN
        RETURN FALSE;
    END IF;
    
    -- 扣减抽奖次数
    UPDATE user_spin_balance
    SET spin_count = spin_count - p_count,
        total_spins_used = total_spins_used + p_count,
        last_spin_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN TRUE;
END;
$$;

-- 创建或替换 add_user_lucky_coins 函数
CREATE OR REPLACE FUNCTION add_user_lucky_coins(
    p_user_id TEXT,
    p_amount DECIMAL(10,2),
    p_description VARCHAR(255) DEFAULT '转盘抽奖奖励'
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id TEXT;
    v_current_balance DECIMAL(10,2);
    v_new_balance DECIMAL(10,2);
BEGIN
    -- 获取用户的积分钱包
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM wallets
    WHERE user_id = p_user_id
      AND type::TEXT = 'LUCKY_COIN'
    LIMIT 1;
    
    IF v_wallet_id IS NULL THEN
        -- 如果钱包不存在，尝试创建
        INSERT INTO wallets (user_id, type, currency, balance, updated_at)
        VALUES (p_user_id, 'LUCKY_COIN', 'TJS', p_amount, NOW())
        ON CONFLICT (user_id, type) DO UPDATE SET balance = wallets.balance + p_amount, updated_at = NOW()
        RETURNING id, balance INTO v_wallet_id, v_new_balance;
        
        v_current_balance := 0;
    ELSE
        -- 增加积分
        UPDATE wallets
        SET balance = balance + p_amount,
            updated_at = NOW()
        WHERE id = v_wallet_id;
        
        -- 获取新余额
        SELECT balance INTO v_new_balance
        FROM wallets
        WHERE id = v_wallet_id;
    END IF;
    
    -- 记录交易
    INSERT INTO wallet_transactions (
        wallet_id,
        type,
        amount,
        balance_before,
        balance_after,
        description,
        status,
        created_at
    ) VALUES (
        v_wallet_id,
        'SPIN_REWARD',
        p_amount,
        v_current_balance,
        v_new_balance,
        p_description,
        'COMPLETED',
        NOW()
    );
    
    RETURN v_new_balance;
END;
$$;

-- ============================================
-- 5. 添加索引优化查询性能
-- ============================================

CREATE INDEX IF NOT EXISTS idx_spin_records_user_id ON spin_records(user_id);
CREATE INDEX IF NOT EXISTS idx_spin_records_created_at ON spin_records(created_at);
CREATE INDEX IF NOT EXISTS idx_user_spin_balance_user_id ON user_spin_balance(user_id);
CREATE INDEX IF NOT EXISTS idx_lotteries_inventory_product_id ON lotteries(inventory_product_id);

-- ============================================
-- 6. 添加 wallet_transactions 表的 SPIN_REWARD 类型支持
-- ============================================

DO $$
BEGIN
    -- 检查 TransactionType 枚举是否存在 SPIN_REWARD
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'SPIN_REWARD' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transactiontype')
    ) THEN
        -- 添加 SPIN_REWARD 到枚举
        ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SPIN_REWARD';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add SPIN_REWARD to TransactionType enum: %', SQLERRM;
END $$;

-- ============================================
-- 完成
-- ============================================

COMMENT ON TABLE spin_records IS '转盘抽奖记录表';
COMMENT ON TABLE user_spin_balance IS '用户抽奖次数余额表';
COMMENT ON TABLE spin_rewards IS '转盘奖励配置表';
