-- LuckyMart-TJ 终极数据库校准脚本 (2026-01-11)
-- 目标：恢复误删前的完整结构，统一字段命名，修复业务逻辑

DO $$ 
BEGIN
    -- 1. 统一支付配置表名 (payment_configs -> payment_config)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_configs') THEN
        ALTER TABLE payment_configs RENAME TO payment_config;
    END IF;

    -- 2. 修复 lotteries 表结构
    -- 处理 inventory_product_id 字段
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'lotteries' AND column_name = 'inventory_product_id') THEN
        -- 先删除可能存在的外键约束
        DECLARE
            constraint_name TEXT;
        BEGIN
            SELECT conname INTO constraint_name
            FROM pg_constraint
            WHERE conrelid = 'lotteries'::regclass AND confrelid = 'inventory_products'::regclass;
            
            IF constraint_name IS NOT NULL THEN
                EXECUTE 'ALTER TABLE lotteries DROP CONSTRAINT ' || constraint_name;
            END IF;
        END;
        
        -- 转换为 TEXT 类型以兼容 SKU
        ALTER TABLE lotteries ALTER COLUMN inventory_product_id TYPE TEXT USING inventory_product_id::TEXT;
    END IF;

    -- 3. 修复 group_buy_products 表结构 (统一使用 name_i18n 和 description_i18n)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'group_buy_products') THEN
        -- 如果存在 title_i18n 则重命名为 name_i18n
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'group_buy_products' AND column_name = 'title_i18n') THEN
            ALTER TABLE group_buy_products RENAME COLUMN title_i18n TO name_i18n;
        END IF;
        
        -- 确保 image_urls 字段存在 (复数)
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'group_buy_products' AND column_name = 'images') THEN
            ALTER TABLE group_buy_products RENAME COLUMN images TO image_urls;
        END IF;
    END IF;

    -- 4. 修复 shipment_batches 表结构
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shipment_batches') THEN
        -- 修复 shipped_at 必填项问题，添加默认值
        ALTER TABLE shipment_batches ALTER COLUMN shipped_at SET DEFAULT now();
        ALTER TABLE shipment_batches ALTER COLUMN shipped_at DROP NOT NULL;
    END IF;

    -- 5. 恢复转盘抽奖相关表
    CREATE TABLE IF NOT EXISTS public.user_spin_balance (
        user_id TEXT PRIMARY KEY,
        spin_count INT DEFAULT 0,
        total_earned INT DEFAULT 0,
        total_used INT DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.spin_rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reward_name VARCHAR(255),
        reward_name_i18n JSONB,
        reward_type VARCHAR(50), -- LUCKY_COIN, NONE
        reward_amount DECIMAL,
        probability DECIMAL,
        display_order INT,
        is_jackpot BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.spin_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT,
        reward_id UUID REFERENCES spin_rewards(id),
        reward_name TEXT,
        reward_amount DECIMAL,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- 6. 修复 group_buy_results 表缺失字段
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'group_buy_results') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'group_buy_results' AND column_name = 'claimed_at') THEN
            ALTER TABLE group_buy_results ADD COLUMN claimed_at TIMESTAMPTZ;
        END IF;
    END IF;

END $$;

-- 7. 重新定义核心积分发放函数 (add_user_lucky_coins)
CREATE OR REPLACE FUNCTION public.add_user_lucky_coins(
    p_user_id TEXT,
    p_amount DECIMAL,
    p_description TEXT DEFAULT 'Reward'
)
RETURNS VOID AS $$
DECLARE
    v_wallet_id UUID;
BEGIN
    -- 1. 获取或创建积分钱包 (LUCKY_COIN)
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id AND type = 'LUCKY_COIN';
    
    IF v_wallet_id IS NULL THEN
        INSERT INTO wallets (user_id, type, balance, currency)
        VALUES (p_user_id, 'LUCKY_COIN', 0, 'POINTS')
        RETURNING id INTO v_wallet_id;
    END IF;

    -- 2. 增加余额
    UPDATE wallets SET balance = balance + p_amount, updated_at = now() WHERE id = v_wallet_id;

    -- 3. 记录交易流水
    INSERT INTO wallet_transactions (wallet_id, amount, type, description, status)
    VALUES (v_wallet_id, p_amount, 'SPIN_REWARD', p_description, 'COMPLETED');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
