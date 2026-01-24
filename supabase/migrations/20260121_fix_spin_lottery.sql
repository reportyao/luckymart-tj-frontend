-- ============================================
-- 修复转盘抽奖功能
-- 创建时间: 2026-01-21
-- 功能说明:
--   1. 修复 add_user_lucky_coins 函数的类型问题（v_wallet_id: TEXT -> UUID）
--   2. 添加缺失的 100积分 大奖配置
-- ============================================

-- 1. 修复 add_user_lucky_coins 函数
-- 问题：v_wallet_id 声明为 TEXT，但 wallets.id 是 UUID 类型
-- 解决：将 v_wallet_id 改为 UUID 类型
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
    v_wallet_id UUID;  -- 修改：从 TEXT 改为 UUID
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
        RAISE EXCEPTION '未找到用户积分钱包';
    END IF;
    
    -- 增加积分
    UPDATE wallets
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
    
    -- 获取新余额
    SELECT balance INTO v_new_balance
    FROM wallets
    WHERE id = v_wallet_id;
    
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

COMMENT ON FUNCTION add_user_lucky_coins IS '增加用户积分（LUCKY_COIN钱包），并记录交易';

-- 2. 添加 100积分 大奖配置（如果不存在）
INSERT INTO spin_rewards (reward_name, reward_name_i18n, reward_type, reward_amount, probability, display_order, is_active, is_jackpot)
SELECT '100积分', '{"zh": "100积分", "ru": "100 баллов", "tg": "100 хол"}'::jsonb, 'LUCKY_COIN', 100, 0.00100, 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM spin_rewards WHERE display_order = 0);

-- ============================================
-- 迁移完成
-- ============================================
