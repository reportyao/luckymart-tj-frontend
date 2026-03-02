-- ============================================================
-- 安全修复 Migration - 地推代充系统
-- 版本: 1.2.0
-- 日期: 2026-03-02
-- 修复内容:
--   PD-001: 撤销 anon/authenticated 对 SECURITY DEFINER 函数的直接调用权限
--   PD-003: 修复并发竞态条件，将额度检查与扣减原子化
--   PD-004: 在 admin-user-financial 的 getTransactionTypeName 和 isIncomeType 中
--           添加 PROMOTER_DEPOSIT（此修复在 Edge Function 代码中完成）
-- ============================================================

-- ============================================================
-- 1. PD-001 修复：撤销 public/anon/authenticated 角色对
--    SECURITY DEFINER 函数的 EXECUTE 权限
--    只允许 service_role（即 Edge Function）调用
-- ============================================================

-- 撤销 perform_promoter_deposit 的公开执行权限
REVOKE EXECUTE ON FUNCTION perform_promoter_deposit(TEXT, TEXT, NUMERIC, TEXT) FROM public, anon, authenticated;

-- 撤销 search_user_for_deposit 的公开执行权限
REVOKE EXECUTE ON FUNCTION search_user_for_deposit(TEXT) FROM public, anon, authenticated;

-- 撤销 get_promoter_deposit_stats 的公开执行权限
REVOKE EXECUTE ON FUNCTION get_promoter_deposit_stats(TEXT, DATE) FROM public, anon, authenticated;

-- 明确授予 service_role 执行权限（Edge Function 使用 service_role 调用）
GRANT EXECUTE ON FUNCTION perform_promoter_deposit(TEXT, TEXT, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION search_user_for_deposit(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_promoter_deposit_stats(TEXT, DATE) TO service_role;

-- ============================================================
-- 2. PD-003 修复：重写 perform_promoter_deposit 函数
--    核心改动：在 Step 4 额度检查之前，先锁定当日结算记录
--    利用 promoter_settlements 的 UNIQUE(promoter_id, settlement_date) 约束
--    实现行级锁，串行化同一地推人员的并发请求
-- ============================================================

CREATE OR REPLACE FUNCTION perform_promoter_deposit(
  p_promoter_id     TEXT,
  p_target_user_id  TEXT,
  p_amount          NUMERIC,
  p_note            TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promoter        RECORD;
  v_today           DATE := CURRENT_DATE;
  v_today_total     NUMERIC;
  v_today_count     INTEGER;
  v_wallet          RECORD;
  v_new_balance     NUMERIC;
  v_new_total_deposits NUMERIC;
  v_is_first_deposit BOOLEAN;
  v_bonus_amount    NUMERIC := 0;
  v_bonus_percent   NUMERIC := 0;
  v_config_value    JSONB;
  v_deposit_id      UUID;
  v_tx_id           UUID;
  v_bonus_tx_id     UUID;
  v_target_name     TEXT;
  v_settlement      RECORD;
BEGIN
  -- ============================================================
  -- Step 1: 验证地推人员身份和状态
  -- ============================================================
  SELECT pp.user_id, pp.promoter_status, pp.daily_deposit_limit
  INTO v_promoter
  FROM promoter_profiles pp
  WHERE pp.user_id = p_promoter_id;

  IF v_promoter IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'NOT_PROMOTER');
  END IF;

  IF v_promoter.promoter_status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'PROMOTER_INACTIVE');
  END IF;

  -- ============================================================
  -- Step 2: 禁止给自己充值
  -- ============================================================
  IF p_promoter_id = p_target_user_id THEN
    RETURN json_build_object('success', false, 'error', 'SELF_DEPOSIT_FORBIDDEN');
  END IF;

  -- ============================================================
  -- Step 3: 验证金额范围 (10 ~ 500 TJS)
  -- ============================================================
  IF p_amount < 10 OR p_amount > 500 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  -- ============================================================
  -- Step 3.5 (PD-003 修复): 锁定或创建当日结算记录
  --   利用 UNIQUE(promoter_id, settlement_date) 约束实现行级锁
  --   所有并发请求在此处排队等待，确保后续额度检查的准确性
  -- ============================================================
  INSERT INTO promoter_settlements (
    promoter_id, settlement_date,
    total_deposit_amount, total_deposit_count,
    settlement_status
  ) VALUES (
    p_promoter_id, v_today,
    0, 0,
    'pending'
  )
  ON CONFLICT (promoter_id, settlement_date)
  DO UPDATE SET updated_at = now()
  RETURNING * INTO v_settlement;

  -- 对结算记录加行级排他锁，确保串行化
  PERFORM 1 FROM promoter_settlements
  WHERE id = v_settlement.id
  FOR UPDATE;

  -- ============================================================
  -- Step 4: 检查今日充值次数和额度（现在是在锁保护下执行）
  -- ============================================================
  SELECT
    COALESCE(SUM(amount), 0),
    COUNT(*)::INTEGER
  INTO v_today_total, v_today_count
  FROM promoter_deposits
  WHERE promoter_id = p_promoter_id
    AND created_at::date = v_today;

  -- 每日最多 10 次
  IF v_today_count >= 10 THEN
    RETURN json_build_object('success', false, 'error', 'DAILY_COUNT_EXCEEDED');
  END IF;

  -- 每日额度上限（默认 5000 TJS）
  IF (v_today_total + p_amount) > COALESCE(v_promoter.daily_deposit_limit, 5000) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'DAILY_LIMIT_EXCEEDED',
      'remaining', COALESCE(v_promoter.daily_deposit_limit, 5000) - v_today_total
    );
  END IF;

  -- ============================================================
  -- Step 5: 锁定目标用户钱包（FOR UPDATE 防止余额并发修改）
  -- ============================================================
  SELECT *
  INTO v_wallet
  FROM wallets
  WHERE user_id = p_target_user_id AND type = 'TJS'
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    -- 自动创建钱包（新用户可能还没有钱包）
    INSERT INTO wallets (
      user_id, type, currency, balance,
      total_deposits, first_deposit_bonus_claimed, first_deposit_bonus_amount
    )
    VALUES (p_target_user_id, 'TJS', 'TJS', 0, 0, false, 0)
    RETURNING * INTO v_wallet;
  END IF;

  -- ============================================================
  -- Step 6: 检查是否为首充，计算首充奖励
  -- ============================================================
  v_is_first_deposit := (COALESCE(v_wallet.total_deposits, 0) = 0)
                        AND (v_wallet.first_deposit_bonus_claimed IS NOT TRUE);

  IF v_is_first_deposit THEN
    -- 从 system_config 获取首充奖励配置（key = 'first_deposit_bonus'）
    SELECT value INTO v_config_value
    FROM system_config
    WHERE key = 'first_deposit_bonus';

    IF v_config_value IS NOT NULL
       AND (v_config_value->>'enabled')::boolean = true
       AND p_amount >= (v_config_value->>'min_deposit_amount')::numeric THEN
      v_bonus_percent := (v_config_value->>'bonus_percent')::numeric;
      v_bonus_amount := LEAST(
        p_amount * (v_bonus_percent / 100),
        (v_config_value->>'max_bonus_amount')::numeric
      );
    END IF;
  END IF;

  -- ============================================================
  -- Step 7: 更新钱包余额（原子操作）
  -- ============================================================
  v_new_balance := COALESCE(v_wallet.balance, 0) + p_amount + v_bonus_amount;
  v_new_total_deposits := COALESCE(v_wallet.total_deposits, 0) + p_amount;

  UPDATE wallets
  SET
    balance = v_new_balance,
    total_deposits = v_new_total_deposits,
    first_deposit_bonus_claimed = CASE
      WHEN v_bonus_amount > 0 THEN true
      ELSE first_deposit_bonus_claimed
    END,
    first_deposit_bonus_amount = CASE
      WHEN v_bonus_amount > 0 THEN v_bonus_amount
      ELSE first_deposit_bonus_amount
    END,
    updated_at = now()
  WHERE id = v_wallet.id;

  -- ============================================================
  -- Step 8: 创建充值交易记录
  -- ============================================================
  v_tx_id := gen_random_uuid();

  INSERT INTO wallet_transactions (
    id, wallet_id, type, amount,
    balance_before, balance_after,
    description, reference_id, status, created_at
  ) VALUES (
    v_tx_id,
    v_wallet.id,
    'PROMOTER_DEPOSIT',
    p_amount,
    COALESCE(v_wallet.balance, 0),
    COALESCE(v_wallet.balance, 0) + p_amount,
    '线下充值 - 操作员: ' || p_promoter_id,
    NULL,
    'COMPLETED',
    now()
  );

  -- ============================================================
  -- Step 9: 如果有首充奖励，创建奖励交易记录
  -- ============================================================
  IF v_bonus_amount > 0 THEN
    v_bonus_tx_id := gen_random_uuid();

    INSERT INTO wallet_transactions (
      id, wallet_id, type, amount,
      balance_before, balance_after,
      description, reference_id, status, created_at
    ) VALUES (
      v_bonus_tx_id,
      v_wallet.id,
      'BONUS',
      v_bonus_amount,
      COALESCE(v_wallet.balance, 0) + p_amount,
      v_new_balance,
      '首充奖励 (' || v_bonus_percent || '%) - 地推充值触发',
      v_tx_id::text,
      'COMPLETED',
      now()
    );
  END IF;

  -- ============================================================
  -- Step 10: 创建地推充值记录
  -- ============================================================
  v_deposit_id := gen_random_uuid();

  INSERT INTO promoter_deposits (
    id, promoter_id, target_user_id, amount, currency,
    status, note, transaction_id, bonus_amount, created_at, updated_at
  ) VALUES (
    v_deposit_id,
    p_promoter_id,
    p_target_user_id,
    p_amount,
    'TJS',
    'COMPLETED',
    p_note,
    v_tx_id,
    v_bonus_amount,
    now(),
    now()
  );

  -- ============================================================
  -- Step 11: 获取目标用户名称（用于通知消息）
  -- ============================================================
  SELECT COALESCE(first_name, telegram_username, telegram_id, p_target_user_id)
  INTO v_target_name
  FROM users
  WHERE id = p_target_user_id;

  -- ============================================================
  -- Step 12: 插入通知队列 - 通知被充值用户
  -- ============================================================
  INSERT INTO notification_queue (
    user_id,
    notification_type,
    title,
    message,
    data
  ) VALUES (
    p_target_user_id,
    'promoter_deposit',
    '线下充值到账',
    '您已收到 ' || p_amount || ' TJS 线下充值' ||
      CASE WHEN v_bonus_amount > 0
           THEN '，另有首充奖励 ' || v_bonus_amount || ' TJS'
           ELSE ''
      END,
    json_build_object(
      'amount', p_amount,
      'bonus_amount', v_bonus_amount,
      'promoter_id', p_promoter_id,
      'deposit_id', v_deposit_id
    )::jsonb
  );

  -- ============================================================
  -- Step 13: 插入通知队列 - 通知地推人员本人
  -- ============================================================
  INSERT INTO notification_queue (
    user_id,
    notification_type,
    title,
    message,
    data
  ) VALUES (
    p_promoter_id,
    'promoter_deposit_confirm',
    '代客充值成功',
    '已为用户 ' || COALESCE(v_target_name, p_target_user_id) ||
      ' 充值 ' || p_amount || ' TJS',
    json_build_object(
      'amount', p_amount,
      'target_user_id', p_target_user_id,
      'target_name', v_target_name,
      'deposit_id', v_deposit_id
    )::jsonb
  );

  -- ============================================================
  -- Step 14: 更新当日缴款结算记录（已在 Step 3.5 创建/锁定）
  -- ============================================================
  UPDATE promoter_settlements
  SET
    total_deposit_amount = total_deposit_amount + p_amount,
    total_deposit_count = total_deposit_count + 1,
    updated_at = now()
  WHERE id = v_settlement.id;

  -- ============================================================
  -- 返回成功结果
  -- ============================================================
  RETURN json_build_object(
    'success', true,
    'deposit_id', v_deposit_id,
    'amount', p_amount,
    'bonus_amount', v_bonus_amount,
    'new_balance', v_new_balance,
    'today_count', v_today_count + 1,
    'today_total', v_today_total + p_amount,
    'daily_limit', COALESCE(v_promoter.daily_deposit_limit, 5000),
    'is_first_deposit', v_is_first_deposit
  );

EXCEPTION
  WHEN OTHERS THEN
    -- 捕获所有异常，返回错误信息（事务自动回滚）
    RETURN json_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'detail', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION perform_promoter_deposit(TEXT, TEXT, NUMERIC, TEXT)
  IS '地推人员代客充值核心事务函数（v1.2.0 安全修复版），在单个事务中完成所有操作，含并发锁保护';
