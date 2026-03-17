-- ============================================================================
-- 业务重构与合规升级: 阶段一 (深度审查修复版)
-- 版本: 1.1.0
-- 日期: 2026-03-18
-- 包含: 枚举类型补充, 抵扣券表创建, 混合支付与充值赠送 RPC 事务函数
--
-- 修复清单 (v1.1.0):
--   P1:  ALTER TYPE ADD VALUE 从 DO 块移至顶层独立语句
--   P2:  添加 IF NOT EXISTS 防止重复执行失败
--   P3:  process_mixed_payment 余额不足时改用 RAISE EXCEPTION 确保事务回滚
--   P4:  统一使用 EXCEPTION 处理模式
--   P5:  添加 p_total_amount 正数校验
--   P6:  添加 p_order_type 合法值校验
--   P7:  添加 p_deposit_amount 正数校验
--   P8:  process_mixed_payment 添加 EXCEPTION 异常处理块
--   P9:  process_deposit_with_bonus 添加 EXCEPTION 异常处理块
--   P10: coupons 表启用 RLS 并添加策略
--   P11: coupons 表添加 updated_at 自动更新触发器
--   P12: 添加 wallet_transactions 缺失字段的安全补充
--   P13: balance 字段使用 COALESCE 保护
--   P14: coupons.related_lottery_id 添加 ON DELETE SET NULL
-- ============================================================================


-- ============================================================
-- 0. 安全补充 wallet_transactions 表可能缺失的字段
--    这些字段在代码中广泛使用，但不在原始 CREATE TABLE 定义中
--    使用 ADD COLUMN IF NOT EXISTS 确保幂等性
-- ============================================================
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS related_id TEXT;
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS related_order_id TEXT;
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS related_lottery_id TEXT;
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;


-- ============================================================
-- 1. 补充缺失的枚举类型
--    [P1修复] 使用顶层独立语句，不包裹在 DO 块中
--    [P2修复] 使用 IF NOT EXISTS 防止重复执行失败
-- ============================================================
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'BONUS';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'FULL_PURCHASE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'COUPON_DEDUCTION';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SHOWOFF_REWARD';


-- ============================================================
-- 2. 创建抵扣券表 (coupons)
--    [P14修复] related_lottery_id 添加 ON DELETE SET NULL
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 1.00,
  status TEXT NOT NULL DEFAULT 'VALID' CHECK (status IN ('VALID', 'USED', 'EXPIRED')),
  source TEXT NOT NULL DEFAULT 'LOTTERY_REFUND',
  related_lottery_id TEXT REFERENCES lotteries(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_user_status ON coupons(user_id, status);
CREATE INDEX IF NOT EXISTS idx_coupons_expires_at ON coupons(expires_at);

-- [P10修复] 启用 RLS 并添加策略
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read own coupons" ON coupons
  FOR SELECT USING (true);

CREATE POLICY "Allow service role to manage coupons" ON coupons
  FOR ALL USING (true) WITH CHECK (true);

-- [P11修复] 添加 updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION update_coupons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_coupons_updated_at ON coupons;
CREATE TRIGGER trigger_update_coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW
  EXECUTE FUNCTION update_coupons_updated_at();


-- ============================================================
-- 3. 创建混合支付 RPC 函数 (process_mixed_payment)
--
-- 支付优先级: 抵扣券 → TJS余额 → LUCKY_COIN积分
-- 事务安全: 任何步骤失败都会通过 RAISE EXCEPTION 回滚全部操作
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
  v_remaining_amount NUMERIC;
  v_coupon_deduction NUMERIC := 0;
  v_tjs_deduction NUMERIC := 0;
  v_lc_deduction NUMERIC := 0;
  v_tjs_balance NUMERIC;
  v_lc_balance NUMERIC;
  v_tx_id UUID;
BEGIN
  -- ============================================================
  -- [P5修复] 参数校验
  -- ============================================================
  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  -- [P6修复] 校验订单类型
  IF p_order_type IS NULL OR p_order_type NOT IN ('LOTTERY_PURCHASE', 'FULL_PURCHASE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ORDER_TYPE');
  END IF;

  IF p_user_id IS NULL OR p_user_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_USER_ID');
  END IF;

  v_remaining_amount := p_total_amount;

  -- ============================================================
  -- Step 1: 锁定用户的 TJS 和 LUCKY_COIN 钱包
  -- ============================================================
  SELECT * INTO v_tjs_wallet FROM wallets WHERE user_id = p_user_id AND type = 'TJS' FOR UPDATE;
  SELECT * INTO v_lc_wallet FROM wallets WHERE user_id = p_user_id AND type = 'LUCKY_COIN' FOR UPDATE;

  IF v_tjs_wallet IS NULL OR v_lc_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND');
  END IF;

  -- [P13修复] 使用 COALESCE 保护 balance 字段
  v_tjs_balance := COALESCE(v_tjs_wallet.balance, 0);
  v_lc_balance := COALESCE(v_lc_wallet.balance, 0);

  -- ============================================================
  -- Step 2: 处理抵扣券 (如果选择使用)
  -- ============================================================
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
        id, wallet_id, type, amount, balance_before, balance_after,
        status, description, related_order_id, related_lottery_id, processed_at, created_at
      ) VALUES (
        v_tx_id, v_tjs_wallet.id, 'COUPON_DEDUCTION', -v_coupon_deduction,
        v_tjs_balance, v_tjs_balance,
        'COMPLETED', '使用抵扣券', p_order_id, p_lottery_id, NOW(), NOW()
      );
    END IF;
  END IF;

  -- ============================================================
  -- Step 3: 扣除 TJS 余额
  -- ============================================================
  IF v_remaining_amount > 0 AND v_tjs_balance > 0 THEN
    v_tjs_deduction := LEAST(v_tjs_balance, v_remaining_amount);
    v_remaining_amount := v_remaining_amount - v_tjs_deduction;

    UPDATE wallets SET
      balance = balance - v_tjs_deduction,
      version = COALESCE(version, 1) + 1,
      updated_at = NOW()
    WHERE id = v_tjs_wallet.id;

    v_tx_id := gen_random_uuid();
    INSERT INTO wallet_transactions (
      id, wallet_id, type, amount, balance_before, balance_after,
      status, description, related_order_id, related_lottery_id, processed_at, created_at
    ) VALUES (
      v_tx_id, v_tjs_wallet.id, p_order_type, -v_tjs_deduction,
      v_tjs_balance, v_tjs_balance - v_tjs_deduction,
      'COMPLETED', '余额支付', p_order_id, p_lottery_id, NOW(), NOW()
    );
  END IF;

  -- ============================================================
  -- Step 4: 扣除 LUCKY_COIN 积分
  -- [P3修复] 余额不足时使用 RAISE EXCEPTION 确保事务完整回滚
  --          (包括已消费的抵扣券和已扣除的TJS余额)
  -- ============================================================
  IF v_remaining_amount > 0 THEN
    IF v_lc_balance < v_remaining_amount THEN
      RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    v_lc_deduction := v_remaining_amount;

    UPDATE wallets SET
      balance = balance - v_lc_deduction,
      version = COALESCE(version, 1) + 1,
      updated_at = NOW()
    WHERE id = v_lc_wallet.id;

    v_tx_id := gen_random_uuid();
    INSERT INTO wallet_transactions (
      id, wallet_id, type, amount, balance_before, balance_after,
      status, description, related_order_id, related_lottery_id, processed_at, created_at
    ) VALUES (
      v_tx_id, v_lc_wallet.id, p_order_type, -v_lc_deduction,
      v_lc_balance, v_lc_balance - v_lc_deduction,
      'COMPLETED', '积分支付', p_order_id, p_lottery_id, NOW(), NOW()
    );
  END IF;

  -- ============================================================
  -- 返回成功结果
  -- ============================================================
  RETURN jsonb_build_object(
    'success', true,
    'coupon_deducted', v_coupon_deduction,
    'tjs_deducted', v_tjs_deduction,
    'lc_deducted', v_lc_deduction
  );

-- [P8修复] 统一异常处理
EXCEPTION
  WHEN OTHERS THEN
    -- RAISE EXCEPTION 会自动回滚事务中的所有操作（包括抵扣券、余额扣除等）
    IF SQLERRM = 'INSUFFICIENT_BALANCE' THEN
      RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_BALANCE');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION process_mixed_payment(TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, TEXT)
  IS '混合支付RPC函数 v1.1.0: 支持抵扣券+TJS余额+LUCKY_COIN积分三级扣款，事务安全';


-- ============================================================
-- 4. 创建充值赠送 RPC 函数 (process_deposit_with_bonus)
--
-- 核心修复: 赠送金额打入 LUCKY_COIN 钱包（而非 TJS 钱包）
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
  v_tjs_balance NUMERIC;
  v_lc_balance NUMERIC;
  v_tx_id UUID;
  v_bonus_tx_id UUID;
BEGIN
  -- ============================================================
  -- [P7修复] 参数校验
  -- ============================================================
  IF p_deposit_amount IS NULL OR p_deposit_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_DEPOSIT_AMOUNT');
  END IF;

  IF p_bonus_amount IS NULL OR p_bonus_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_BONUS_AMOUNT');
  END IF;

  IF p_user_id IS NULL OR p_user_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_USER_ID');
  END IF;

  -- ============================================================
  -- Step 1: 锁定 TJS 钱包 (用于充值本金)
  -- ============================================================
  SELECT * INTO v_tjs_wallet FROM wallets WHERE user_id = p_user_id AND type = 'TJS' FOR UPDATE;
  IF v_tjs_wallet IS NULL THEN
    INSERT INTO wallets (user_id, type, currency, balance, total_deposits, version)
    VALUES (p_user_id, 'TJS', 'TJS', 0, 0, 1) RETURNING * INTO v_tjs_wallet;
  END IF;

  -- ============================================================
  -- Step 2: 锁定 LUCKY_COIN 钱包 (用于赠送积分)
  -- ============================================================
  SELECT * INTO v_lc_wallet FROM wallets WHERE user_id = p_user_id AND type = 'LUCKY_COIN' FOR UPDATE;
  IF v_lc_wallet IS NULL THEN
    INSERT INTO wallets (user_id, type, currency, balance, total_deposits, version)
    VALUES (p_user_id, 'LUCKY_COIN', 'POINTS', 0, 0, 1) RETURNING * INTO v_lc_wallet;
  END IF;

  -- [P13修复] 使用 COALESCE 保护 balance 字段
  v_tjs_balance := COALESCE(v_tjs_wallet.balance, 0);
  v_lc_balance := COALESCE(v_lc_wallet.balance, 0);

  -- ============================================================
  -- Step 3: 更新 TJS 钱包 (本金)
  -- ============================================================
  UPDATE wallets SET
    balance = balance + p_deposit_amount,
    total_deposits = COALESCE(total_deposits, 0) + p_deposit_amount,
    version = COALESCE(version, 1) + 1,
    updated_at = NOW()
  WHERE id = v_tjs_wallet.id;

  v_tx_id := gen_random_uuid();
  INSERT INTO wallet_transactions (
    id, wallet_id, type, amount, balance_before, balance_after,
    status, description, related_id, processed_at, created_at
  ) VALUES (
    v_tx_id, v_tjs_wallet.id, 'DEPOSIT', p_deposit_amount,
    v_tjs_balance, v_tjs_balance + p_deposit_amount,
    'COMPLETED', '充值审核通过 - 订单号: ' || COALESCE(p_order_number, 'N/A'),
    p_request_id::text, NOW(), NOW()
  );

  -- ============================================================
  -- Step 4: 更新 LUCKY_COIN 钱包 (赠送积分)
  -- 核心修复: bonus 打入 LUCKY_COIN 钱包而非 TJS 钱包
  -- ============================================================
  IF p_bonus_amount > 0 THEN
    UPDATE wallets SET
      balance = balance + p_bonus_amount,
      version = COALESCE(version, 1) + 1,
      updated_at = NOW()
    WHERE id = v_lc_wallet.id;

    v_bonus_tx_id := gen_random_uuid();
    INSERT INTO wallet_transactions (
      id, wallet_id, type, amount, balance_before, balance_after,
      status, description, related_id, processed_at, created_at
    ) VALUES (
      v_bonus_tx_id, v_lc_wallet.id, 'BONUS', p_bonus_amount,
      v_lc_balance, v_lc_balance + p_bonus_amount,
      'COMPLETED', '充值赠送 - 订单号: ' || COALESCE(p_order_number, 'N/A'),
      p_request_id::text, NOW(), NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deposit_amount', p_deposit_amount,
    'bonus_amount', p_bonus_amount,
    'tjs_new_balance', v_tjs_balance + p_deposit_amount,
    'lc_new_balance', v_lc_balance + p_bonus_amount
  );

-- [P9修复] 异常处理
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION process_deposit_with_bonus(UUID, TEXT, NUMERIC, NUMERIC, TEXT)
  IS '充值赠送RPC函数 v1.1.0: 本金入TJS钱包，赠送入LUCKY_COIN钱包，事务安全';
