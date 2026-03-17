-- ============================================================================
-- 修复 perform_promoter_deposit: 充值赠送打入 LUCKY_COIN 钱包 + 移除首充限制
-- 版本: 2.0.0
-- 日期: 2026-03-18
--
-- 核心修复:
--   1. bonus 打入 LUCKY_COIN 钱包（而非 TJS 钱包）
--   2. 移除首充限制：每次充值只要满足 min_deposit_amount 即可获得赠送
--   3. TJS 钱包余额不再包含 bonus（v_new_balance 只加本金）
--   4. 新增 LUCKY_COIN 钱包锁定和更新逻辑
-- ============================================================================

CREATE OR REPLACE FUNCTION public.perform_promoter_deposit(
  p_promoter_id text,
  p_target_user_id text,
  p_amount numeric,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_promoter        RECORD;
  v_today           DATE := (now() AT TIME ZONE 'Asia/Dushanbe')::date;
  v_today_total     NUMERIC;
  v_today_count     INTEGER;
  v_wallet          RECORD;
  v_lc_wallet       RECORD;
  v_new_balance     NUMERIC;
  v_new_total_deposits NUMERIC;
  v_bonus_amount    NUMERIC := 0;
  v_bonus_percent   NUMERIC := 0;
  v_config_value    JSONB;
  v_deposit_id      UUID;
  v_tx_id           UUID;
  v_bonus_tx_id     UUID;
  v_target_name     TEXT;
  v_promoter_name   TEXT;
  v_settlement      RECORD;
  v_lc_balance      NUMERIC;
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
  -- Step 3: 验证金额范围 (10 ~ 500 TJS) 且必须为整数
  -- ============================================================
  IF p_amount < 10 OR p_amount > 500 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  IF p_amount != FLOOR(p_amount) THEN
    RETURN json_build_object('success', false, 'error', 'AMOUNT_MUST_BE_INTEGER');
  END IF;

  -- ============================================================
  -- Step 3.5: 锁定或创建当日结算记录（并发锁）
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

  PERFORM 1 FROM promoter_settlements
  WHERE id = v_settlement.id
  FOR UPDATE;

  -- ============================================================
  -- Step 4: 检查今日充值次数和额度
  -- ============================================================
  SELECT
    COALESCE(SUM(amount), 0),
    COUNT(*)::INTEGER
  INTO v_today_total, v_today_count
  FROM promoter_deposits
  WHERE promoter_id = p_promoter_id
    AND created_at >= (v_today::timestamp AT TIME ZONE 'Asia/Dushanbe')
    AND created_at < ((v_today + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Dushanbe');

  IF v_today_count >= 10 THEN
    RETURN json_build_object('success', false, 'error', 'DAILY_COUNT_EXCEEDED');
  END IF;

  IF (v_today_total + p_amount) > COALESCE(v_promoter.daily_deposit_limit, 5000) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'DAILY_LIMIT_EXCEEDED',
      'remaining', COALESCE(v_promoter.daily_deposit_limit, 5000) - v_today_total
    );
  END IF;

  -- ============================================================
  -- Step 5: 锁定目标用户 TJS 钱包
  -- ============================================================
  SELECT *
  INTO v_wallet
  FROM wallets
  WHERE user_id = p_target_user_id AND type = 'TJS'
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    INSERT INTO wallets (
      user_id, type, currency, balance,
      total_deposits, first_deposit_bonus_claimed, first_deposit_bonus_amount, version
    )
    VALUES (p_target_user_id, 'TJS', 'TJS', 0, 0, false, 0, 1)
    RETURNING * INTO v_wallet;
  END IF;

  -- ============================================================
  -- Step 5.5: 锁定目标用户 LUCKY_COIN 钱包（用于赠送积分）
  -- 【新增】修复 bonus 打入错误钱包的 Bug
  -- ============================================================
  SELECT *
  INTO v_lc_wallet
  FROM wallets
  WHERE user_id = p_target_user_id AND type = 'LUCKY_COIN'
  FOR UPDATE;

  IF v_lc_wallet IS NULL THEN
    INSERT INTO wallets (
      user_id, type, currency, balance,
      total_deposits, version
    )
    VALUES (p_target_user_id, 'LUCKY_COIN', 'POINTS', 0, 0, 1)
    RETURNING * INTO v_lc_wallet;
  END IF;

  v_lc_balance := COALESCE(v_lc_wallet.balance, 0);

  -- ============================================================
  -- Step 6: 计算充值赠送（移除首充限制）
  -- 【修改】不再检查 is_first_deposit 和 first_deposit_bonus_claimed
  --         只要 enabled 且金额达标即可获得赠送
  -- ============================================================
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

  -- ============================================================
  -- Step 7: 更新 TJS 钱包余额（仅本金，不含 bonus）
  -- 【修复】v_new_balance 不再包含 v_bonus_amount
  -- ============================================================
  v_new_balance := COALESCE(v_wallet.balance, 0) + p_amount;
  v_new_total_deposits := COALESCE(v_wallet.total_deposits, 0) + p_amount;

  UPDATE wallets
  SET
    balance = v_new_balance,
    total_deposits = v_new_total_deposits,
    version = COALESCE(version, 1) + 1,
    updated_at = now()
  WHERE id = v_wallet.id;

  -- ============================================================
  -- Step 8: 创建充值交易记录（TJS 钱包）
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
    v_new_balance,
    '线下充值 - 操作员: ' || p_promoter_id,
    NULL,
    'COMPLETED',
    now()
  );

  -- ============================================================
  -- Step 9: 如果有赠送，更新 LUCKY_COIN 钱包并创建交易记录
  -- 【修复】bonus 打入 LUCKY_COIN 钱包而非 TJS 钱包
  -- ============================================================
  IF v_bonus_amount > 0 THEN
    UPDATE wallets
    SET
      balance = balance + v_bonus_amount,
      version = COALESCE(version, 1) + 1,
      updated_at = now()
    WHERE id = v_lc_wallet.id;

    v_bonus_tx_id := gen_random_uuid();

    INSERT INTO wallet_transactions (
      id, wallet_id, type, amount,
      balance_before, balance_after,
      description, reference_id, status, created_at
    ) VALUES (
      v_bonus_tx_id,
      v_lc_wallet.id,
      'BONUS',
      v_bonus_amount,
      v_lc_balance,
      v_lc_balance + v_bonus_amount,
      '充值赠送 (' || v_bonus_percent || '%) - 地推充值触发',
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
  -- Step 11: 获取用户名称（用于通知消息）
  -- ============================================================
  SELECT COALESCE(first_name, telegram_username, telegram_id, p_target_user_id)
  INTO v_target_name
  FROM users
  WHERE id = p_target_user_id;

  SELECT COALESCE(first_name, telegram_username, telegram_id, p_promoter_id)
  INTO v_promoter_name
  FROM users
  WHERE id = p_promoter_id;

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
           THEN '，另有充值赠送 ' || v_bonus_amount || ' 积分'
           ELSE ''
      END,
    json_build_object(
      'transaction_amount', p_amount,
      'bonus_amount', v_bonus_amount,
      'promoter_name', v_promoter_name,
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
      'transaction_amount', p_amount,
      'target_user_id', p_target_user_id,
      'target_user_name', v_target_name,
      'bonus_amount', v_bonus_amount,
      'deposit_id', v_deposit_id
    )::jsonb
  );

  -- ============================================================
  -- Step 14: 更新当日缴款结算记录
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
    'new_lc_balance', v_lc_balance + v_bonus_amount,
    'today_count', v_today_count + 1,
    'today_total', v_today_total + p_amount,
    'daily_limit', COALESCE(v_promoter.daily_deposit_limit, 5000)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'detail', SQLERRM
    );
END;
$function$;

COMMENT ON FUNCTION perform_promoter_deposit(TEXT, TEXT, NUMERIC, TEXT)
  IS '地推人员代客充值核心事务函数（v2.0.0 业务重构版），修复bonus打入LUCKY_COIN钱包+移除首充限制';
