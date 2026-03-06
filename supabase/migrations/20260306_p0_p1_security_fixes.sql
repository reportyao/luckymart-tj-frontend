-- ============================================================================
-- P0 & P1 安全修复迁移
-- 版本: 1.0.0
-- 日期: 2026-03-06
--
-- 修复内容:
--   P0-1: 创建 approve_deposit_atomic RPC 函数
--         - 使用 FOR UPDATE 行级锁防止 TOCTOU 竞态
--         - 所有操作在单个事务中执行，保证原子性
--         - 支持首充奖励计算
--         - 自动创建钱包（如果不存在）
--         - 插入通知队列（充值到账 + 首充奖励）
--
--   P0-2: 修复 approve_withdrawal_request RPC 函数
--         - 修复钱包类型查询（BALANCE -> TJS）
--         - 修复余额操作（同时减少 balance 和 frozen_balance）
--         - 修复交易记录（使用 balance 而非 frozen_balance）
--         - 添加 FOR UPDATE 行级锁
--         - 添加 version 递增
--
--   P0-3: 修复 reject_withdrawal_request RPC 函数
--         - 修复钱包类型查询（BALANCE -> TJS）
--         - 修复余额操作（拒绝时只减少 frozen_balance，不增加 balance）
--         - 添加 FOR UPDATE 行级锁
--         - 添加 version 递增
--
--   P1-1: 创建 revert_wallet_deduction RPC 函数
--         - 用于拼团回滚场景的安全余额恢复
--         - 使用原子操作 balance = balance + amount，避免使用过时快照
--         - 自动递增 version
-- ============================================================================


-- ============================================================================
-- P0-1: approve_deposit_atomic RPC 函数
-- ============================================================================
-- 
-- 设计说明:
--   此函数替代 approve-deposit Edge Function 中的多步数据库操作。
--   参照 perform_promoter_deposit 的最佳实践，使用 FOR UPDATE 行级锁
--   和数据库事务保证所有操作的原子性。
--
--   调用方式:
--     SELECT approve_deposit_atomic(
--       p_request_id := '<deposit_request_id>',
--       p_action := 'APPROVED',  -- 或 'REJECTED'
--       p_admin_id := '<admin_user_id>',
--       p_admin_note := '备注'
--     );
--
--   返回值: JSON 对象
--     成功: { "success": true, "deposit_amount": ..., "bonus_amount": ..., "new_balance": ..., ... }
--     失败: { "success": false, "error": "错误描述" }
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_deposit_atomic(
  p_request_id TEXT,
  p_action TEXT,        -- 'APPROVED' 或 'REJECTED'
  p_admin_id TEXT,
  p_admin_note TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deposit       RECORD;
  v_wallet        RECORD;
  v_new_balance   NUMERIC;
  v_new_total     NUMERIC;
  v_bonus         NUMERIC := 0;
  v_bonus_pct     NUMERIC := 0;
  v_config        JSONB;
  v_tx_id         UUID;
  v_bonus_tx_id   UUID;
  v_deposit_amount NUMERIC;
  v_balance_after_deposit NUMERIC;
BEGIN
  -- ============================================================
  -- Step 1: 参数校验
  -- ============================================================
  IF p_request_id IS NULL OR p_request_id = '' THEN
    RETURN json_build_object('success', false, 'error', '请求ID不能为空');
  END IF;

  IF p_action IS NULL OR p_action NOT IN ('APPROVED', 'REJECTED') THEN
    RETURN json_build_object('success', false, 'error', '无效的审核操作，必须为 APPROVED 或 REJECTED');
  END IF;

  -- ============================================================
  -- Step 2: 锁定充值申请并检查状态（原子操作，防止 TOCTOU）
  -- 使用 FOR UPDATE 行级锁，确保同一时间只有一个事务能处理此申请
  -- ============================================================
  SELECT * INTO v_deposit
  FROM deposit_requests
  WHERE id::TEXT = p_request_id
  FOR UPDATE;

  IF v_deposit IS NULL THEN
    RETURN json_build_object('success', false, 'error', '未找到充值申请');
  END IF;

  IF v_deposit.status != 'PENDING' THEN
    RETURN json_build_object('success', false, 'error', '该申请已被处理，当前状态: ' || v_deposit.status);
  END IF;

  v_deposit_amount := v_deposit.amount;

  -- ============================================================
  -- Step 3: 处理拒绝操作（简单路径）
  -- ============================================================
  IF p_action = 'REJECTED' THEN
    -- 更新申请状态为 REJECTED
    UPDATE deposit_requests SET
      status = 'REJECTED',
      processed_by = p_admin_id,
      admin_note = p_admin_note,
      processed_at = NOW(),
      updated_at = NOW()
    WHERE id = v_deposit.id;

    -- 插入拒绝通知
    INSERT INTO notifications (
      user_id, type, title, title_i18n,
      content, message_i18n,
      related_id, related_type
    ) VALUES (
      v_deposit.user_id,
      'PAYMENT_FAILED',
      '充值失败',
      '{"zh": "充值失败", "ru": "Ошибка пополнения", "tg": "Хатои пуркунӣ"}'::jsonb,
      '您的充值申请已被拒绝' || CASE WHEN p_admin_note IS NOT NULL AND p_admin_note != '' THEN '，原因: ' || p_admin_note ELSE '' END,
      json_build_object(
        'zh', '您的充值申请已被拒绝' || CASE WHEN p_admin_note IS NOT NULL AND p_admin_note != '' THEN '，原因：' || p_admin_note ELSE '' END,
        'ru', 'Ваш запрос на пополнение отклонён' || CASE WHEN p_admin_note IS NOT NULL AND p_admin_note != '' THEN '. Причина: ' || p_admin_note ELSE '' END,
        'tg', 'Дархости пуркунии шумо рад карда шуд' || CASE WHEN p_admin_note IS NOT NULL AND p_admin_note != '' THEN '. Сабаб: ' || p_admin_note ELSE '' END
      )::jsonb,
      p_request_id,
      'DEPOSIT_REQUEST'
    );

    -- 插入 Telegram 通知队列（充值被拒绝）
    INSERT INTO notification_queue (
      user_id, type, payload,
      notification_type, title, message, data,
      priority, status, scheduled_at,
      retry_count, max_retries,
      created_at, updated_at
    ) VALUES (
      v_deposit.user_id,
      'wallet_withdraw_failed',
      json_build_object(
        'transaction_amount', v_deposit_amount,
        'failure_reason', COALESCE(p_admin_note, '审核未通过'),
        'current_balance', 0
      )::jsonb,
      'wallet_withdraw_failed',
      '充值失败',
      '',
      json_build_object(
        'transaction_amount', v_deposit_amount,
        'failure_reason', COALESCE(p_admin_note, '审核未通过'),
        'current_balance', 0
      )::jsonb,
      2,
      'pending',
      NOW(),
      0, 3,
      NOW(), NOW()
    );

    -- 记录操作日志
    PERFORM log_edge_function_action(
      p_function_name := 'approve_deposit_atomic',
      p_action := 'REJECT_DEPOSIT',
      p_user_id := p_admin_id,
      p_target_type := 'deposit_request',
      p_target_id := p_request_id,
      p_details := json_build_object(
        'admin_id', p_admin_id,
        'user_id', v_deposit.user_id,
        'amount', v_deposit_amount,
        'currency', v_deposit.currency,
        'order_number', v_deposit.order_number,
        'admin_note', p_admin_note
      )::jsonb,
      p_status := 'success'
    );

    RETURN json_build_object(
      'success', true,
      'message', '已拒绝',
      'action', 'REJECTED'
    );
  END IF;

  -- ============================================================
  -- Step 4: 处理批准操作 - 锁定用户钱包
  -- ============================================================
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = v_deposit.user_id AND type = 'TJS'
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    -- 自动创建钱包（新用户可能还没有钱包）
    INSERT INTO wallets (
      user_id, type, currency, balance,
      total_deposits, first_deposit_bonus_claimed,
      first_deposit_bonus_amount, version
    ) VALUES (
      v_deposit.user_id, 'TJS', 'TJS', 0, 0, false, 0, 1
    )
    RETURNING * INTO v_wallet;
  END IF;

  -- ============================================================
  -- Step 5: 检查首充奖励
  -- ============================================================
  IF COALESCE(v_wallet.total_deposits, 0) = 0
     AND v_wallet.first_deposit_bonus_claimed IS NOT TRUE THEN
    -- 从 system_config 获取首充奖励配置
    SELECT value INTO v_config
    FROM system_config
    WHERE key = 'first_deposit_bonus';

    IF v_config IS NOT NULL
       AND (v_config->>'enabled')::boolean = true
       AND v_deposit_amount >= (v_config->>'min_deposit_amount')::numeric THEN
      v_bonus_pct := (v_config->>'bonus_percent')::numeric;
      v_bonus := LEAST(
        v_deposit_amount * (v_bonus_pct / 100),
        (v_config->>'max_bonus_amount')::numeric
      );
    END IF;
  END IF;

  -- ============================================================
  -- Step 6: 计算新余额并更新钱包
  -- ============================================================
  v_balance_after_deposit := COALESCE(v_wallet.balance, 0) + v_deposit_amount;
  v_new_balance := v_balance_after_deposit + v_bonus;
  v_new_total := COALESCE(v_wallet.total_deposits, 0) + v_deposit_amount;

  UPDATE wallets SET
    balance = v_new_balance,
    total_deposits = v_new_total,
    version = COALESCE(version, 1) + 1,
    first_deposit_bonus_claimed = CASE
      WHEN v_bonus > 0 THEN true
      ELSE first_deposit_bonus_claimed
    END,
    first_deposit_bonus_amount = CASE
      WHEN v_bonus > 0 THEN v_bonus
      ELSE first_deposit_bonus_amount
    END,
    updated_at = NOW()
  WHERE id = v_wallet.id;

  -- ============================================================
  -- Step 7: 更新充值申请状态
  -- ============================================================
  UPDATE deposit_requests SET
    status = 'APPROVED',
    processed_by = p_admin_id,
    admin_note = p_admin_note,
    processed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_deposit.id;

  -- ============================================================
  -- Step 8: 创建充值交易记录
  -- ============================================================
  v_tx_id := gen_random_uuid();

  INSERT INTO wallet_transactions (
    id, wallet_id, type, amount,
    balance_before, balance_after,
    description, related_id, status,
    processed_at, created_at
  ) VALUES (
    v_tx_id,
    v_wallet.id,
    'DEPOSIT',
    v_deposit_amount,
    COALESCE(v_wallet.balance, 0),
    v_balance_after_deposit,
    '充值审核通过 - 订单号: ' || COALESCE(v_deposit.order_number, 'N/A'),
    p_request_id,
    'COMPLETED',
    NOW(),
    NOW()
  );

  -- ============================================================
  -- Step 9: 如果有首充奖励，创建奖励交易记录
  -- ============================================================
  IF v_bonus > 0 THEN
    v_bonus_tx_id := gen_random_uuid();

    INSERT INTO wallet_transactions (
      id, wallet_id, type, amount,
      balance_before, balance_after,
      description, related_id, status,
      processed_at, created_at
    ) VALUES (
      v_bonus_tx_id,
      v_wallet.id,
      'BONUS',
      v_bonus,
      v_balance_after_deposit,
      v_new_balance,
      '首充奖励 (' || v_bonus_pct || '%) - 订单号: ' || COALESCE(v_deposit.order_number, 'N/A'),
      p_request_id,
      'COMPLETED',
      NOW(),
      NOW()
    );
  END IF;

  -- ============================================================
  -- Step 10: 插入应用内通知
  -- ============================================================
  INSERT INTO notifications (
    user_id, type, title, title_i18n,
    content, message_i18n,
    related_id, related_type
  ) VALUES (
    v_deposit.user_id,
    'PAYMENT_SUCCESS',
    '充值成功',
    '{"zh": "充值成功", "ru": "Пополнение успешно", "tg": "Пуркунӣ бомуваффақият"}'::jsonb,
    CASE WHEN v_bonus > 0
      THEN '您的充值申请已审核通过,金额' || v_deposit_amount || ' ' || v_deposit.currency || '已到账，首充奖励+' || v_bonus || ' ' || v_deposit.currency
      ELSE '您的充值申请已审核通过,金额' || v_deposit_amount || ' ' || v_deposit.currency || '已到账'
    END,
    CASE WHEN v_bonus > 0 THEN
      json_build_object(
        'zh', '您的充值申请已审核通过，金额 ' || v_deposit_amount || ' ' || v_deposit.currency || ' 已到账，首充奖励 +' || v_bonus || ' ' || v_deposit.currency,
        'ru', 'Ваш запрос на пополнение одобрен. ' || v_deposit_amount || ' ' || v_deposit.currency || ' зачислено, бонус за первое пополнение +' || v_bonus || ' ' || v_deposit.currency,
        'tg', 'Дархости пуркунии шумо тасдиқ шуд. ' || v_deposit_amount || ' ' || v_deposit.currency || ' ворид шуд, мукофоти аввалин пуркунӣ +' || v_bonus || ' ' || v_deposit.currency
      )::jsonb
    ELSE
      json_build_object(
        'zh', '您的充值申请已审核通过，金额 ' || v_deposit_amount || ' ' || v_deposit.currency || ' 已到账',
        'ru', 'Ваш запрос на пополнение одобрен. ' || v_deposit_amount || ' ' || v_deposit.currency || ' зачислено',
        'tg', 'Дархости пуркунии шумо тасдиқ шуд. ' || v_deposit_amount || ' ' || v_deposit.currency || ' ворид шуд'
      )::jsonb
    END,
    p_request_id,
    'DEPOSIT_REQUEST'
  );

  -- ============================================================
  -- Step 11: 插入 Telegram 通知队列 - 充值到账
  -- ============================================================
  INSERT INTO notification_queue (
    user_id, type, payload,
    notification_type, title, message, data,
    priority, status, scheduled_at,
    retry_count, max_retries,
    created_at, updated_at
  ) VALUES (
    v_deposit.user_id,
    'wallet_deposit',
    json_build_object('transaction_amount', v_deposit_amount)::jsonb,
    'wallet_deposit',
    '充值到账',
    '',
    json_build_object('transaction_amount', v_deposit_amount)::jsonb,
    1,
    'pending',
    NOW(),
    0, 3,
    NOW(), NOW()
  );

  -- 如果有首充奖励，发送首充奖励通知
  IF v_bonus > 0 THEN
    INSERT INTO notification_queue (
      user_id, type, payload,
      notification_type, title, message, data,
      priority, status, scheduled_at,
      retry_count, max_retries,
      created_at, updated_at
    ) VALUES (
      v_deposit.user_id,
      'first_deposit_bonus',
      json_build_object(
        'deposit_amount', v_deposit_amount,
        'bonus_amount', v_bonus,
        'bonus_percent', v_bonus_pct,
        'total_amount', v_deposit_amount + v_bonus
      )::jsonb,
      'first_deposit_bonus',
      '首充奖励到账',
      '',
      json_build_object(
        'deposit_amount', v_deposit_amount,
        'bonus_amount', v_bonus,
        'bonus_percent', v_bonus_pct,
        'total_amount', v_deposit_amount + v_bonus
      )::jsonb,
      1,
      'pending',
      NOW(),
      0, 3,
      NOW(), NOW()
    );
  END IF;

  -- ============================================================
  -- Step 12: 记录操作日志
  -- ============================================================
  PERFORM log_edge_function_action(
    p_function_name := 'approve_deposit_atomic',
    p_action := 'APPROVE_DEPOSIT',
    p_user_id := p_admin_id,
    p_target_type := 'deposit_request',
    p_target_id := p_request_id,
    p_details := json_build_object(
      'admin_id', p_admin_id,
      'user_id', v_deposit.user_id,
      'amount', v_deposit_amount,
      'bonus_amount', v_bonus,
      'currency', v_deposit.currency,
      'order_number', v_deposit.order_number,
      'admin_note', p_admin_note,
      'new_balance', v_new_balance
    )::jsonb,
    p_status := 'success'
  );

  -- ============================================================
  -- 返回成功结果
  -- ============================================================
  RETURN json_build_object(
    'success', true,
    'message', '审核通过',
    'action', 'APPROVED',
    'deposit_amount', v_deposit_amount,
    'bonus_amount', v_bonus,
    'bonus_percent', v_bonus_pct,
    'new_balance', v_new_balance,
    'user_id', v_deposit.user_id,
    'order_number', v_deposit.order_number
  );

EXCEPTION
  WHEN OTHERS THEN
    -- 捕获所有异常，返回错误信息（事务自动回滚）
    -- 记录错误日志（尽力而为，不影响异常传播）
    BEGIN
      PERFORM log_edge_function_action(
        p_function_name := 'approve_deposit_atomic',
        p_action := 'DEPOSIT_REVIEW_ERROR',
        p_user_id := p_admin_id,
        p_target_type := 'deposit_request',
        p_target_id := p_request_id,
        p_status := 'error',
        p_error_message := SQLERRM
      );
    EXCEPTION WHEN OTHERS THEN
      -- 日志写入失败不影响主流程
      NULL;
    END;

    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION approve_deposit_atomic(TEXT, TEXT, TEXT, TEXT)
  IS '充值审批原子操作函数（v1.0.0），使用 FOR UPDATE 行级锁 + 数据库事务保证原子性，替代 approve-deposit Edge Function 的多步操作';


-- ============================================================================
-- P0-2: 修复 approve_withdrawal_request RPC 函数
-- ============================================================================
--
-- 修复内容:
--   1. 钱包类型查询: BALANCE -> TJS（数据库中没有 BALANCE 类型）
--   2. 余额操作: 同时减少 balance 和 frozen_balance
--   3. 交易记录: balance_before/balance_after 使用 balance 字段值
--   4. 添加 FOR UPDATE 行级锁防止并发
--   5. 添加 version 递增保持乐观锁一致性
--   6. 添加 total_withdrawals 累计
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_withdrawal_request(
  p_withdrawal_id TEXT,
  p_admin_id TEXT,
  p_admin_note TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
  v_amount DECIMAL;
  v_currency TEXT;
  v_wallet RECORD;
  v_status TEXT;
  v_new_balance DECIMAL;
  v_new_frozen DECIMAL;
BEGIN
  -- 锁定提现申请（FOR UPDATE 防止并发处理同一笔提现）
  SELECT user_id, amount, currency::TEXT, status::TEXT
  INTO v_user_id, v_amount, v_currency, v_status
  FROM withdrawal_requests
  WHERE id::TEXT = p_withdrawal_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '提现申请不存在';
  END IF;
  IF v_status != 'PENDING' THEN
    RAISE EXCEPTION '提现申请状态不正确，当前状态: %', v_status;
  END IF;

  -- 锁定钱包（修复：使用 TJS 而非 BALANCE）
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = v_user_id AND type::TEXT = 'TJS' AND currency::TEXT = v_currency
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    RAISE EXCEPTION '未找到用户钱包';
  END IF;
  IF v_wallet.balance < v_amount THEN
    RAISE EXCEPTION '余额不足，当前余额: %, 提现金额: %', v_wallet.balance, v_amount;
  END IF;

  -- 修复：同时减少 balance 和 frozen_balance
  v_new_balance := v_wallet.balance - v_amount;
  v_new_frozen := GREATEST(0, COALESCE(v_wallet.frozen_balance, 0) - v_amount);

  UPDATE wallets SET
    balance = v_new_balance,
    frozen_balance = v_new_frozen,
    total_withdrawals = COALESCE(total_withdrawals, 0) + v_amount,
    version = COALESCE(version, 1) + 1,
    updated_at = NOW()
  WHERE id = v_wallet.id;

  -- 更新提现状态
  UPDATE withdrawal_requests SET
    status = 'APPROVED',
    reviewed_at = NOW(),
    admin_id = p_admin_id,
    admin_note = p_admin_note,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id::TEXT = p_withdrawal_id;

  -- 修复：使用 balance 而非 frozen_balance 记录交易
  INSERT INTO wallet_transactions (
    wallet_id, type, amount,
    balance_before, balance_after,
    description, status, created_at
  ) VALUES (
    v_wallet.id, 'WITHDRAWAL', -v_amount,
    v_wallet.balance, v_new_balance,
    '提现申请已批准: ' || p_withdrawal_id,
    'COMPLETED', NOW()
  );

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION approve_withdrawal_request(TEXT, TEXT, TEXT)
  IS '提现审批通过函数（v2.0.0 修复版），修复钱包类型查询、余额操作和交易记录，添加 FOR UPDATE 锁和 version 递增';


-- ============================================================================
-- P0-3: 修复 reject_withdrawal_request RPC 函数
-- ============================================================================
--
-- 修复内容:
--   1. 钱包类型查询: BALANCE -> TJS
--   2. 余额操作: 拒绝时只减少 frozen_balance，不增加 balance
--      （因为提现申请时只冻结了余额，没有扣除余额）
--   3. 添加 FOR UPDATE 行级锁防止并发
--   4. 添加 version 递增保持乐观锁一致性
-- ============================================================================

CREATE OR REPLACE FUNCTION reject_withdrawal_request(
  p_withdrawal_id TEXT,
  p_admin_id TEXT,
  p_admin_note TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id TEXT;
  v_amount DECIMAL;
  v_currency TEXT;
  v_wallet RECORD;
  v_status TEXT;
BEGIN
  -- 锁定提现申请（FOR UPDATE 防止并发处理同一笔提现）
  SELECT user_id, amount, currency::TEXT, status::TEXT
  INTO v_user_id, v_amount, v_currency, v_status
  FROM withdrawal_requests
  WHERE id::TEXT = p_withdrawal_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '提现申请不存在';
  END IF;
  IF v_status != 'PENDING' THEN
    RAISE EXCEPTION '提现申请状态不正确，当前状态: %', v_status;
  END IF;

  -- 锁定钱包（修复：使用 TJS 而非 BALANCE）
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = v_user_id AND type::TEXT = 'TJS' AND currency::TEXT = v_currency
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    RAISE EXCEPTION '未找到用户钱包';
  END IF;

  -- 修复：拒绝时只减少 frozen_balance，不增加 balance
  -- 原因：提现申请时只冻结了余额（frozen_balance += amount），
  -- 没有减少 balance，所以拒绝时只需要解冻（frozen_balance -= amount）
  UPDATE wallets SET
    frozen_balance = GREATEST(0, COALESCE(frozen_balance, 0) - v_amount),
    version = COALESCE(version, 1) + 1,
    updated_at = NOW()
  WHERE id = v_wallet.id;

  -- 更新提现申请状态
  UPDATE withdrawal_requests SET
    status = 'REJECTED',
    reviewed_at = NOW(),
    admin_id = p_admin_id,
    admin_note = p_admin_note,
    updated_at = NOW()
  WHERE id::TEXT = p_withdrawal_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION reject_withdrawal_request(TEXT, TEXT, TEXT)
  IS '提现审批拒绝函数（v2.0.0 修复版），修复钱包类型查询和余额操作逻辑，添加 FOR UPDATE 锁和 version 递增';


-- ============================================================================
-- P1-1: 创建 revert_wallet_deduction RPC 函数
-- ============================================================================
--
-- 用途:
--   在拼团（group-buy-join / group-buy-squad）扣款成功后，如果后续步骤
--   （如创建订单、创建会话）失败，需要安全地将扣除的金额退回用户钱包。
--
-- 设计原则:
--   1. 使用 balance = balance + p_amount 原子操作，避免使用过时的余额快照
--   2. 自动递增 version，保持与乐观锁模式的一致性
--   3. 同时创建退款交易记录，确保审计完整性
--
-- 调用方式:
--   SELECT revert_wallet_deduction(
--     p_wallet_id := '<wallet_uuid>',
--     p_amount := 100.00,
--     p_description := '拼团订单创建失败，退回扣款'
--   );
-- ============================================================================

CREATE OR REPLACE FUNCTION revert_wallet_deduction(
  p_wallet_id TEXT,
  p_amount NUMERIC,
  p_description TEXT DEFAULT '系统退款：操作失败退回扣款'
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet RECORD;
  v_new_balance NUMERIC;
BEGIN
  -- 参数校验
  IF p_wallet_id IS NULL OR p_wallet_id = '' THEN
    RETURN json_build_object('success', false, 'error', '钱包ID不能为空');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', '退回金额必须大于0');
  END IF;

  -- 锁定钱包
  SELECT * INTO v_wallet
  FROM wallets
  WHERE id::TEXT = p_wallet_id
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN json_build_object('success', false, 'error', '未找到钱包');
  END IF;

  -- 原子操作：余额加回 + version 递增
  v_new_balance := COALESCE(v_wallet.balance, 0) + p_amount;

  UPDATE wallets SET
    balance = v_new_balance,
    version = COALESCE(version, 1) + 1,
    updated_at = NOW()
  WHERE id = v_wallet.id;

  -- 创建退款交易记录
  INSERT INTO wallet_transactions (
    wallet_id, type, amount,
    balance_before, balance_after,
    description, status, created_at
  ) VALUES (
    v_wallet.id,
    'GROUP_BUY_REFUND',
    p_amount,
    v_wallet.balance,
    v_new_balance,
    p_description,
    'COMPLETED',
    NOW()
  );

  RETURN json_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'reverted_amount', p_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION revert_wallet_deduction(TEXT, NUMERIC, TEXT)
  IS '安全退回钱包扣款函数（v1.0.0），使用原子操作 balance = balance + amount 避免过时快照问题，用于拼团等场景的失败回滚';


-- ============================================================================
-- 迁移完成
-- ============================================================================
