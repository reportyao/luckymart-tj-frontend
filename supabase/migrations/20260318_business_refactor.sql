-- ============================================================================
-- 业务重构与合规升级: 阶段一
-- 包含: 枚举类型补充, 抵扣券表创建, 混合支付与充值赠送 RPC 函数
-- ============================================================================

-- ============================================================
-- 1. 补充缺失的枚举类型
-- ============================================================
-- 检查并添加 TransactionType 枚举值 (如果已存在则忽略)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'BONUS' AND enumtypid = '"TransactionType"'::regtype) THEN
        ALTER TYPE "TransactionType" ADD VALUE 'BONUS';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'FULL_PURCHASE' AND enumtypid = '"TransactionType"'::regtype) THEN
        ALTER TYPE "TransactionType" ADD VALUE 'FULL_PURCHASE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'COUPON_DEDUCTION' AND enumtypid = '"TransactionType"'::regtype) THEN
        ALTER TYPE "TransactionType" ADD VALUE 'COUPON_DEDUCTION';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SHOWOFF_REWARD' AND enumtypid = '"TransactionType"'::regtype) THEN
        ALTER TYPE "TransactionType" ADD VALUE 'SHOWOFF_REWARD';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

-- ============================================================
-- 2. 创建抵扣券表 (coupons)
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 1.00,
  status TEXT NOT NULL DEFAULT 'VALID' CHECK (status IN ('VALID', 'USED', 'EXPIRED')),
  source TEXT NOT NULL DEFAULT 'LOTTERY_REFUND',
  related_lottery_id TEXT REFERENCES lotteries(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_user_status ON coupons(user_id, status);
CREATE INDEX IF NOT EXISTS idx_coupons_expires_at ON coupons(expires_at);

-- ============================================================
-- 3. 创建混合支付 RPC 函数 (process_mixed_payment)
-- ============================================================
CREATE OR REPLACE FUNCTION process_mixed_payment(
  p_user_id TEXT,
  p_lottery_id TEXT,
  p_order_id TEXT,
  p_total_amount NUMERIC,
  p_use_coupon BOOLEAN,
  p_order_type TEXT -- 'LOTTERY_PURCHASE' 或 'FULL_PURCHASE'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tjs_wallet RECORD;
  v_lc_wallet RECORD;
  v_coupon RECORD;
  v_remaining_amount NUMERIC := p_total_amount;
  v_coupon_deduction NUMERIC := 0;
  v_tjs_deduction NUMERIC := 0;
  v_lc_deduction NUMERIC := 0;
  v_tx_id UUID;
BEGIN
  -- 1. 锁定用户的 TJS 和 LUCKY_COIN 钱包
  SELECT * INTO v_tjs_wallet FROM wallets WHERE user_id = p_user_id AND type = 'TJS' FOR UPDATE;
  SELECT * INTO v_lc_wallet FROM wallets WHERE user_id = p_user_id AND type = 'LUCKY_COIN' FOR UPDATE;

  IF v_tjs_wallet IS NULL OR v_lc_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND');
  END IF;

  -- 2. 处理抵扣券 (如果选择使用)
  IF p_use_coupon THEN
    SELECT * INTO v_coupon FROM coupons 
    WHERE user_id = p_user_id AND status = 'VALID' AND expires_at > NOW() 
    ORDER BY expires_at ASC LIMIT 1 FOR UPDATE;

    IF v_coupon IS NOT NULL THEN
      v_coupon_deduction := LEAST(v_coupon.amount, v_remaining_amount);
      v_remaining_amount := v_remaining_amount - v_coupon_deduction;
      
      UPDATE coupons SET status = 'USED', used_at = NOW(), updated_at = NOW() WHERE id = v_coupon.id;
      
      -- 记录抵扣券使用流水
      v_tx_id := gen_random_uuid();
      INSERT INTO wallet_transactions (
        id, wallet_id, type, amount, balance_before, balance_after, status, description, related_order_id, processed_at, created_at
      ) VALUES (
        v_tx_id, v_tjs_wallet.id, 'COUPON_DEDUCTION', -v_coupon_deduction, v_tjs_wallet.balance, v_tjs_wallet.balance, 'COMPLETED', '使用抵扣券', p_order_id, NOW(), NOW()
      );
    END IF;
  END IF;

  -- 3. 扣除 TJS 余额
  IF v_remaining_amount > 0 AND v_tjs_wallet.balance > 0 THEN
    v_tjs_deduction := LEAST(v_tjs_wallet.balance, v_remaining_amount);
    v_remaining_amount := v_remaining_amount - v_tjs_deduction;
    
    UPDATE wallets SET balance = balance - v_tjs_deduction, version = COALESCE(version, 1) + 1, updated_at = NOW() WHERE id = v_tjs_wallet.id;
    
    v_tx_id := gen_random_uuid();
    INSERT INTO wallet_transactions (
      id, wallet_id, type, amount, balance_before, balance_after, status, description, related_order_id, related_lottery_id, processed_at, created_at
    ) VALUES (
      v_tx_id, v_tjs_wallet.id, p_order_type, -v_tjs_deduction, v_tjs_wallet.balance, v_tjs_wallet.balance - v_tjs_deduction, 'COMPLETED', '余额支付', p_order_id, p_lottery_id, NOW(), NOW()
    );
  END IF;

  -- 4. 扣除 LUCKY_COIN 积分
  IF v_remaining_amount > 0 THEN
    IF v_lc_wallet.balance < v_remaining_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_BALANCE');
    END IF;
    
    v_lc_deduction := v_remaining_amount;
    
    UPDATE wallets SET balance = balance - v_lc_deduction, version = COALESCE(version, 1) + 1, updated_at = NOW() WHERE id = v_lc_wallet.id;
    
    v_tx_id := gen_random_uuid();
    INSERT INTO wallet_transactions (
      id, wallet_id, type, amount, balance_before, balance_after, status, description, related_order_id, related_lottery_id, processed_at, created_at
    ) VALUES (
      v_tx_id, v_lc_wallet.id, p_order_type, -v_lc_deduction, v_lc_wallet.balance, v_lc_wallet.balance - v_lc_deduction, 'COMPLETED', '积分支付', p_order_id, p_lottery_id, NOW(), NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'coupon_deducted', v_coupon_deduction, 
    'tjs_deducted', v_tjs_deduction, 
    'lc_deducted', v_lc_deduction
  );
END;
$$;

-- ============================================================
-- 4. 创建充值赠送 RPC 函数 (process_deposit_with_bonus)
-- ============================================================
CREATE OR REPLACE FUNCTION process_deposit_with_bonus(
  p_request_id UUID,
  p_user_id TEXT,
  p_deposit_amount NUMERIC,
  p_bonus_amount NUMERIC,
  p_order_number TEXT
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tjs_wallet RECORD;
  v_lc_wallet RECORD;
  v_tx_id UUID;
  v_bonus_tx_id UUID;
BEGIN
  -- 1. 锁定 TJS 钱包 (用于充值本金)
  SELECT * INTO v_tjs_wallet FROM wallets WHERE user_id = p_user_id AND type = 'TJS' FOR UPDATE;
  IF v_tjs_wallet IS NULL THEN
    INSERT INTO wallets (user_id, type, currency, balance, total_deposits, version) 
    VALUES (p_user_id, 'TJS', 'TJS', 0, 0, 1) RETURNING * INTO v_tjs_wallet;
  END IF;

  -- 2. 锁定 LUCKY_COIN 钱包 (用于赠送积分)
  SELECT * INTO v_lc_wallet FROM wallets WHERE user_id = p_user_id AND type = 'LUCKY_COIN' FOR UPDATE;
  IF v_lc_wallet IS NULL THEN
    INSERT INTO wallets (user_id, type, currency, balance, total_deposits, version) 
    VALUES (p_user_id, 'LUCKY_COIN', 'POINTS', 0, 0, 1) RETURNING * INTO v_lc_wallet;
  END IF;

  -- 3. 更新 TJS 钱包 (本金)
  UPDATE wallets SET 
    balance = balance + p_deposit_amount, 
    total_deposits = COALESCE(total_deposits, 0) + p_deposit_amount,
    version = COALESCE(version, 1) + 1, 
    updated_at = NOW() 
  WHERE id = v_tjs_wallet.id;

  v_tx_id := gen_random_uuid();
  INSERT INTO wallet_transactions (
    id, wallet_id, type, amount, balance_before, balance_after, status, description, related_id, processed_at, created_at
  ) VALUES (
    v_tx_id, v_tjs_wallet.id, 'DEPOSIT', p_deposit_amount, v_tjs_wallet.balance, v_tjs_wallet.balance + p_deposit_amount, 'COMPLETED', '充值审核通过 - 订单号: ' || p_order_number, p_request_id::text, NOW(), NOW()
  );

  -- 4. 更新 LUCKY_COIN 钱包 (赠送积分)
  IF p_bonus_amount > 0 THEN
    UPDATE wallets SET 
      balance = balance + p_bonus_amount, 
      version = COALESCE(version, 1) + 1, 
      updated_at = NOW() 
    WHERE id = v_lc_wallet.id;

    v_bonus_tx_id := gen_random_uuid();
    INSERT INTO wallet_transactions (
      id, wallet_id, type, amount, balance_before, balance_after, status, description, related_id, processed_at, created_at
    ) VALUES (
      v_bonus_tx_id, v_lc_wallet.id, 'BONUS', p_bonus_amount, v_lc_wallet.balance, v_lc_wallet.balance + p_bonus_amount, 'COMPLETED', '充值赠送 - 订单号: ' || p_order_number, p_request_id::text, NOW(), NOW()
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
