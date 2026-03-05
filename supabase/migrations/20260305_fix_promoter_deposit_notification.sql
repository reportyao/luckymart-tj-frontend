-- ============================================================
-- 修复 Migration: 地推充值系统全面修复
-- 版本: 1.2.0
-- 日期: 2026-03-05
-- 
-- 修复内容:
--   1. BUG-001: perform_promoter_deposit 函数中 notification_queue.data 
--      字段名与 telegram-notification-sender 模板不匹配
--      - amount → transaction_amount
--      - promoter_id → promoter_name (改为实际名称)
--      - target_name → target_user_name
--   2. BUG-010: 新增查询地推人员名称 (v_promoter_name)
--   3. ISSUE-TZ-001: 时区修复 - CURRENT_DATE → Asia/Dushanbe 时区
--      数据库使用UTC，但业务在塔吉克斯坦(UTC+5)
--      在UTC 19:00-23:59期间（当地00:00-04:59），额度计算会跨日错误
--   4. ISSUE-AMT-001: 增加整数金额验证 (FLOOR检查)
--   5. ISSUE-SEARCH-001: search_user_for_deposit 增加 referral_code 搜索
-- ============================================================

-- ============================================================
-- Part 1: 修复 perform_promoter_deposit 函数
-- ============================================================
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
  v_promoter_name   TEXT;
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
  -- Step 3: 验证金额范围 (10 ~ 500 TJS) 且必须为整数
  -- [ISSUE-AMT-001 FIX] 增加整数验证
  -- ============================================================
  IF p_amount < 10 OR p_amount > 500 THEN
    RETURN json_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  IF p_amount != FLOOR(p_amount) THEN
    RETURN json_build_object('success', false, 'error', 'AMOUNT_MUST_BE_INTEGER');
  END IF;

  -- ============================================================
  -- Step 3.5: 锁定或创建当日结算记录
  -- [ISSUE-TZ-001 FIX] 使用塔吉克斯坦时区的日期
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
  -- [ISSUE-TZ-001 FIX] 使用塔吉克斯坦时区的日期范围
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
  -- Step 5: 锁定目标用户钱包（FOR UPDATE 防止余额并发修改）
  -- ============================================================
  SELECT *
  INTO v_wallet
  FROM wallets
  WHERE user_id = p_target_user_id AND type = 'TJS'
  FOR UPDATE;

  IF v_wallet IS NULL THEN
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
  -- Step 11: 获取用户名称（用于通知消息）
  -- [BUG-010 FIX] 新增查询地推人员名称
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
  -- Step 12: 通知被充值用户
  -- [BUG-001 FIX] 修正 data 字段名与通知模板一致
  -- ============================================================
  INSERT INTO notification_queue (
    user_id, notification_type, title, message, data
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
      'transaction_amount', p_amount,
      'bonus_amount', v_bonus_amount,
      'promoter_name', v_promoter_name,
      'deposit_id', v_deposit_id
    )::jsonb
  );

  -- ============================================================
  -- Step 13: 通知地推人员本人
  -- [BUG-001 FIX] 修正 data 字段名
  -- ============================================================
  INSERT INTO notification_queue (
    user_id, notification_type, title, message, data
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
  -- Step 14: 更新当日结算记录
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
    RETURN json_build_object(
      'success', false,
      'error', 'INTERNAL_ERROR',
      'detail', SQLERRM
    );
END;
$function$;

-- ============================================================
-- Part 2: 修复 search_user_for_deposit 函数
-- [ISSUE-SEARCH-001 FIX] 增加 referral_code 搜索支持
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_user_for_deposit(p_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user RECORD;
BEGIN
  -- 1. 完整 UUID 匹配
  IF p_query ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id, telegram_id, telegram_username, first_name, last_name, avatar_url
    INTO v_user
    FROM users
    WHERE id = p_query
      AND (is_blocked IS NOT TRUE)
      AND (deleted_at IS NULL);
  END IF;

  -- 2. 纯数字 -> Telegram ID 匹配
  IF v_user IS NULL AND p_query ~ '^\d+$' THEN
    SELECT id, telegram_id, telegram_username, first_name, last_name, avatar_url
    INTO v_user
    FROM users
    WHERE telegram_id = p_query
      AND (is_blocked IS NOT TRUE)
      AND (deleted_at IS NULL);
  END IF;

  -- 3. Telegram 用户名匹配（去@后不区分大小写）
  IF v_user IS NULL THEN
    SELECT id, telegram_id, telegram_username, first_name, last_name, avatar_url
    INTO v_user
    FROM users
    WHERE LOWER(telegram_username) = LOWER(REPLACE(p_query, '@', ''))
      AND (is_blocked IS NOT TRUE)
      AND (deleted_at IS NULL);
  END IF;

  -- 4. [ISSUE-SEARCH-001 FIX] referral_code 匹配（不区分大小写）
  IF v_user IS NULL THEN
    SELECT id, telegram_id, telegram_username, first_name, last_name, avatar_url
    INTO v_user
    FROM users
    WHERE UPPER(referral_code) = UPPER(p_query)
      AND (is_blocked IS NOT TRUE)
      AND (deleted_at IS NULL);
  END IF;

  -- 5. UUID 前8位 hex 前缀匹配
  IF v_user IS NULL AND LENGTH(p_query) = 8 AND p_query ~ '^[0-9a-f]+$' THEN
    SELECT id, telegram_id, telegram_username, first_name, last_name, avatar_url
    INTO v_user
    FROM users
    WHERE id LIKE p_query || '%'
      AND (is_blocked IS NOT TRUE)
      AND (deleted_at IS NULL)
    LIMIT 1;
  END IF;

  -- 未找到
  IF v_user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  RETURN json_build_object(
    'success', true,
    'user', json_build_object(
      'id', v_user.id,
      'telegram_id', v_user.telegram_id,
      'telegram_username', v_user.telegram_username,
      'first_name', v_user.first_name,
      'last_name', v_user.last_name,
      'avatar_url', v_user.avatar_url
    )
  );
END;
$function$;

-- ============================================================
-- Part 3: 修复 get_promoter_deposit_stats 函数
-- [ISSUE-TZ-001 FIX] 使用塔吉克斯坦时区
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_promoter_deposit_stats(
  p_promoter_id text,
  p_date date DEFAULT (now() AT TIME ZONE 'Asia/Dushanbe')::date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_promoter    RECORD;
  v_today_stats RECORD;
BEGIN
  SELECT pp.daily_deposit_limit
  INTO v_promoter
  FROM promoter_profiles pp
  WHERE pp.user_id = p_promoter_id;

  SELECT
    COALESCE(SUM(amount), 0)        AS total_amount,
    COUNT(*)::INTEGER               AS total_count,
    COALESCE(SUM(bonus_amount), 0)  AS total_bonus
  INTO v_today_stats
  FROM promoter_deposits
  WHERE promoter_id = p_promoter_id
    AND created_at >= (p_date::timestamp AT TIME ZONE 'Asia/Dushanbe')
    AND created_at < ((p_date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Dushanbe');

  RETURN json_build_object(
    'success', true,
    'date', p_date,
    'total_amount', v_today_stats.total_amount,
    'total_count', v_today_stats.total_count,
    'total_bonus', v_today_stats.total_bonus,
    'daily_limit', COALESCE(v_promoter.daily_deposit_limit, 5000),
    'remaining_limit', COALESCE(v_promoter.daily_deposit_limit, 5000) - v_today_stats.total_amount,
    'remaining_count', 10 - v_today_stats.total_count
  );
END;
$function$;
