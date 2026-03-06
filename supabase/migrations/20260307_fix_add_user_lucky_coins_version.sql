-- ============================================
-- 修复 add_user_lucky_coins 函数
-- 问题：更新钱包余额时没有递增 version 字段
-- 影响：其他使用乐观锁的 Edge Function 基于过时的 version 值操作
--       可能导致并发冲突或余额覆盖
-- 修复：在 UPDATE wallets 时添加 version = COALESCE(version, 1) + 1
--       同时添加 FOR UPDATE 行锁防止并发
-- ============================================

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
    v_wallet_id UUID;
    v_current_balance DECIMAL(10,2);
    v_new_balance DECIMAL(10,2);
BEGIN
    -- 获取用户的积分钱包（添加 FOR UPDATE 行锁防止并发）
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM wallets
    WHERE user_id = p_user_id
      AND type::TEXT = 'LUCKY_COIN'
    LIMIT 1
    FOR UPDATE;
    
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION '未找到用户积分钱包';
    END IF;
    
    -- 增加积分（修复：添加 version 递增，保持与乐观锁模式一致）
    UPDATE wallets
    SET balance = balance + p_amount,
        version = COALESCE(version, 1) + 1,
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

COMMENT ON FUNCTION add_user_lucky_coins IS '增加用户积分（LUCKY_COIN钱包），并记录交易。已修复 version 递增和 FOR UPDATE 行锁。';
