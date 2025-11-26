-- ============================================
-- 1. 余额兑换为幸运币的 RPC 函数（修复参数类型为 TEXT）
-- ============================================
CREATE OR REPLACE FUNCTION exchange_real_to_bonus_balance(
  p_user_id TEXT,
  p_amount DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_wallet_id TEXT;
  v_lucky_coin_wallet_id TEXT;
  v_current_balance DECIMAL;
  v_lucky_coin_balance DECIMAL;
  v_currency TEXT;
BEGIN
  -- 参数验证
  IF p_amount <= 0 THEN
    RAISE EXCEPTION '兑换金额必须大于0';
  END IF;

  -- 获取用户的余额钱包（优先 TJS，如果没有则 USD）
  SELECT id, balance, currency::TEXT INTO v_balance_wallet_id, v_current_balance, v_currency
  FROM wallets
  WHERE user_id = p_user_id 
    AND type::TEXT = 'BALANCE'
    AND currency::TEXT IN ('TJS', 'USD')
  ORDER BY 
    CASE currency::TEXT 
      WHEN 'TJS' THEN 1
      WHEN 'USD' THEN 2
      ELSE 3
    END
  LIMIT 1;

  IF v_balance_wallet_id IS NULL THEN
    RAISE EXCEPTION '未找到余额钱包';
  END IF;

  -- 检查余额是否足够
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION '余额不足';
  END IF;

  -- 获取用户的幸运币钱包（使用相同货币）
  SELECT id INTO v_lucky_coin_wallet_id
  FROM wallets
  WHERE user_id = p_user_id 
    AND type::TEXT = 'LUCKY_COIN'
    AND currency::TEXT = v_currency;

  IF v_lucky_coin_wallet_id IS NULL THEN
    RAISE EXCEPTION '未找到幸运币钱包';
  END IF;

  -- 扣除余额
  UPDATE wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = v_balance_wallet_id;

  -- 增加幸运币（1:1 兑换）
  UPDATE wallets
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE id = v_lucky_coin_wallet_id;

  -- 记录交易（余额扣除）
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
    v_balance_wallet_id,
    'COIN_EXCHANGE',
    -p_amount,
    v_current_balance,
    v_current_balance - p_amount,
    '余额兑换为幸运币',
    'COMPLETED',
    NOW()
  );

  -- 记录交易（幸运币增加）
  -- 需要先查询幸运币钱包的当前余额
  SELECT balance INTO v_lucky_coin_balance FROM wallets WHERE id = v_lucky_coin_wallet_id;
  
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
    v_lucky_coin_wallet_id,
    'COIN_EXCHANGE',
    p_amount,
    v_lucky_coin_balance,
    v_lucky_coin_balance + p_amount,
    '余额兑换为常运币',
    'COMPLETED',
    NOW()
  );

  -- 返回新的余额
  RETURN v_current_balance - p_amount;
END;
$$;

-- ============================================
-- 2. 提现审批通过后的扣款 RPC 函数（修复参数类型为 TEXT）
-- ============================================
CREATE OR REPLACE FUNCTION approve_withdrawal_request(
  p_withdrawal_id TEXT,
  p_admin_id TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
  v_amount DECIMAL;
  v_currency TEXT;
  v_wallet_id TEXT;
  v_frozen_balance DECIMAL;
  v_status TEXT;
BEGIN
  -- 获取提现申请信息
  SELECT user_id, amount, currency::TEXT, status::TEXT
  INTO v_user_id, v_amount, v_currency, v_status
  FROM withdrawal_requests
  WHERE id::TEXT = p_withdrawal_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '提现申请不存在';
  END IF;

  IF v_status != 'PENDING' THEN
    RAISE EXCEPTION '提现申请状态不正确，当前状态: %', v_status;
  END IF;

  -- 获取用户的余额钱包
  SELECT id, frozen_balance INTO v_wallet_id, v_frozen_balance
  FROM wallets
  WHERE user_id = v_user_id 
    AND type::TEXT = 'BALANCE'
    AND currency::TEXT = v_currency;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION '未找到用户钱包';
  END IF;

  -- 检查冻结余额是否足够
  IF v_frozen_balance < v_amount THEN
    RAISE EXCEPTION '冻结余额不足';
  END IF;

  -- 扣除冻结余额（实际扣款）
  UPDATE wallets
  SET frozen_balance = frozen_balance - v_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  -- 更新提现申请状态
  UPDATE withdrawal_requests
  SET status = 'APPROVED',
      reviewed_at = NOW(),
      admin_id = p_admin_id,
      admin_note = p_admin_note,
      completed_at = NOW(),
      updated_at = NOW()
  WHERE id::TEXT = p_withdrawal_id;

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
    'WITHDRAWAL',
    -v_amount,
    v_frozen_balance,
    v_frozen_balance - v_amount,
    '提现申请已批准: ' || p_withdrawal_id,
    'COMPLETED',
    NOW()
  );

  RETURN TRUE;
END;
$$;

-- ============================================
-- 3. 提现审批拒绝后的解冻 RPC 函数（修复参数类型为 TEXT）
-- ============================================
CREATE OR REPLACE FUNCTION reject_withdrawal_request(
  p_withdrawal_id TEXT,
  p_admin_id TEXT,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
  v_amount DECIMAL;
  v_currency TEXT;
  v_wallet_id TEXT;
  v_status TEXT;
BEGIN
  -- 获取提现申请信息
  SELECT user_id, amount, currency::TEXT, status::TEXT
  INTO v_user_id, v_amount, v_currency, v_status
  FROM withdrawal_requests
  WHERE id::TEXT = p_withdrawal_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '提现申请不存在';
  END IF;

  IF v_status != 'PENDING' THEN
    RAISE EXCEPTION '提现申请状态不正确，当前状态: %', v_status;
  END IF;

  -- 获取用户的余额钱包
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = v_user_id 
    AND type::TEXT = 'BALANCE'
    AND currency::TEXT = v_currency;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION '未找到用户钱包';
  END IF;

  -- 解冻余额（退回到可用余额）
  UPDATE wallets
  SET balance = balance + v_amount,
      frozen_balance = frozen_balance - v_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  -- 更新提现申请状态
  UPDATE withdrawal_requests
  SET status = 'REJECTED',
      reviewed_at = NOW(),
      admin_id = p_admin_id,
      admin_note = p_admin_note,
      updated_at = NOW()
  WHERE id::TEXT = p_withdrawal_id;

  RETURN TRUE;
END;
$$;
