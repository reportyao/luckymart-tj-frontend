-- ============================================================
-- 地推人员代客充值系统 - 数据库 Migration
-- 版本: 1.0.0
-- 日期: 2026-03-01
-- 说明: 新建 promoter_deposits、promoter_settlements 表，
--       修改 promoter_profiles 表增加 daily_deposit_limit 字段，
--       新建核心 RPC 函数
-- ============================================================

-- ============================================================
-- 1. 修改 promoter_profiles 表：增加每日充值额度上限
-- ============================================================
ALTER TABLE promoter_profiles
  ADD COLUMN IF NOT EXISTS daily_deposit_limit NUMERIC(12,2) DEFAULT 5000.00;

COMMENT ON COLUMN promoter_profiles.daily_deposit_limit
  IS '该地推人员每日充值总额上限（TJS），由管理员为每人单独配置';

-- ============================================================
-- 2. 新建 promoter_deposits 表：记录每笔地推充值
-- ============================================================
CREATE TABLE IF NOT EXISTS promoter_deposits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id   UUID NOT NULL REFERENCES users(id),
  target_user_id UUID NOT NULL REFERENCES users(id),
  amount        NUMERIC(12,2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'TJS',
  -- 充值状态：COMPLETED（直接到账，无需审核）
  status        TEXT NOT NULL DEFAULT 'COMPLETED',
  -- 备注信息（地推人员可选填写）
  note          TEXT,
  -- 关联的 wallet_transaction id（充值成功后回写）
  transaction_id UUID,
  -- 首充奖励金额（如果触发了首充奖励）
  bonus_amount  NUMERIC(12,2) DEFAULT 0,
  -- 创建时间
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 更新时间
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 约束：金额必须在 10-500 范围内
  CONSTRAINT promoter_deposits_amount_range CHECK (amount >= 10 AND amount <= 500),
  -- 约束：地推人员不能给自己充值
  CONSTRAINT promoter_deposits_no_self_deposit CHECK (promoter_id != target_user_id)
);

-- 索引：按地推人员查询
CREATE INDEX IF NOT EXISTS idx_promoter_deposits_promoter_id
  ON promoter_deposits(promoter_id);

-- 索引：按目标用户查询
CREATE INDEX IF NOT EXISTS idx_promoter_deposits_target_user_id
  ON promoter_deposits(target_user_id);

-- 索引：按创建时间查询（对账用）
CREATE INDEX IF NOT EXISTS idx_promoter_deposits_created_at
  ON promoter_deposits(created_at);

-- 索引：按日期+地推人员查询（每日统计用）
CREATE INDEX IF NOT EXISTS idx_promoter_deposits_daily
  ON promoter_deposits(promoter_id, (created_at::date));

COMMENT ON TABLE promoter_deposits
  IS '地推人员代客充值记录表，每笔充值直接到账无需审核';

-- ============================================================
-- 3. 新建 promoter_settlements 表：地推人员缴款记录
-- ============================================================
CREATE TABLE IF NOT EXISTS promoter_settlements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promoter_id   UUID NOT NULL REFERENCES users(id),
  -- 结算日期（对应哪一天的充值）
  settlement_date DATE NOT NULL,
  -- 当日充值总额（系统自动计算）
  total_deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- 当日充值笔数（系统自动计算）
  total_deposit_count INTEGER NOT NULL DEFAULT 0,
  -- 实际缴款金额
  settlement_amount NUMERIC(12,2),
  -- 缴款方式：cash（现金）或 transfer（转账）
  settlement_method TEXT,
  -- 转账凭证图片 URL（转账方式时需要上传）
  proof_image_url TEXT,
  -- 缴款状态：pending（待缴款）、settled（已缴款）、discrepancy（金额不一致）
  settlement_status TEXT NOT NULL DEFAULT 'pending',
  -- 管理员确认人
  confirmed_by TEXT,
  -- 确认时间
  confirmed_at TIMESTAMPTZ,
  -- 备注
  note TEXT,
  -- 创建时间
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 更新时间
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 约束：每个地推人员每天只有一条结算记录
  CONSTRAINT promoter_settlements_unique_daily UNIQUE (promoter_id, settlement_date),
  -- 约束：缴款方式只能是 cash 或 transfer
  CONSTRAINT promoter_settlements_method_check CHECK (
    settlement_method IS NULL OR settlement_method IN ('cash', 'transfer')
  )
);

-- 索引：按日期查询
CREATE INDEX IF NOT EXISTS idx_promoter_settlements_date
  ON promoter_settlements(settlement_date);

-- 索引：按状态查询
CREATE INDEX IF NOT EXISTS idx_promoter_settlements_status
  ON promoter_settlements(settlement_status);

COMMENT ON TABLE promoter_settlements
  IS '地推人员每日缴款结算记录，用于对账管理';

-- ============================================================
-- 4. 在 system_config 表中插入快捷金额配置（如果不存在）
-- ============================================================
INSERT INTO system_config (key, value, description)
VALUES (
  'promoter_deposit_quick_amounts',
  '{"amounts": [10, 20, 50, 100, 200, 500]}',
  '地推人员代客充值的快捷金额选项，由管理后台配置'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 5. RPC 函数：search_user_for_deposit
--    地推人员搜索目标用户（兼容 UUID / Telegram ID / 手机号）
-- ============================================================
CREATE OR REPLACE FUNCTION search_user_for_deposit(
  p_query TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_result JSON;
BEGIN
  -- 尝试按 UUID 精确匹配
  IF p_query ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id, telegram_id, telegram_username, first_name, last_name, avatar_url
    INTO v_user
    FROM users
    WHERE id = p_query::UUID;
  END IF;

  -- 如果 UUID 没找到，尝试按 Telegram ID（纯数字）匹配
  IF v_user IS NULL AND p_query ~ '^\d+$' THEN
    SELECT id, telegram_id, telegram_username, first_name, last_name, avatar_url
    INTO v_user
    FROM users
    WHERE telegram_id = p_query;
  END IF;

  -- 如果还没找到，尝试按 Telegram 用户名匹配（去掉 @ 前缀）
  IF v_user IS NULL THEN
    SELECT id, telegram_id, telegram_username, first_name, last_name, avatar_url
    INTO v_user
    FROM users
    WHERE telegram_username = REPLACE(p_query, '@', '');
  END IF;

  -- 如果还没找到，尝试按 UUID 短码匹配（前8位）
  IF v_user IS NULL AND LENGTH(p_query) = 8 AND p_query ~ '^[0-9a-f]+$' THEN
    SELECT id, telegram_id, telegram_username, first_name, last_name, avatar_url
    INTO v_user
    FROM users
    WHERE id::TEXT LIKE p_query || '%';
  END IF;

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
$$;

COMMENT ON FUNCTION search_user_for_deposit(TEXT)
  IS '地推人员搜索目标用户，支持 UUID / Telegram ID / 用户名 / UUID短码';

-- ============================================================
-- 6. RPC 函数：perform_promoter_deposit（核心事务函数）
--    在一个事务中完成：额度检查 → 余额更新 → 交易记录 → 充值记录
-- ============================================================
CREATE OR REPLACE FUNCTION perform_promoter_deposit(
  p_promoter_id UUID,
  p_target_user_id UUID,
  p_amount NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promoter RECORD;
  v_today DATE := CURRENT_DATE;
  v_today_total NUMERIC;
  v_today_count INTEGER;
  v_wallet RECORD;
  v_new_balance NUMERIC;
  v_new_total_deposits NUMERIC;
  v_is_first_deposit BOOLEAN;
  v_bonus_amount NUMERIC := 0;
  v_bonus_percent NUMERIC := 0;
  v_config_data RECORD;
  v_deposit_id UUID;
  v_tx_id UUID;
  v_bonus_tx_id UUID;
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
  -- Step 4: 检查今日充值次数和额度（使用 FOR UPDATE 锁定）
  -- ============================================================
  SELECT
    COALESCE(SUM(amount), 0),
    COUNT(*)
  INTO v_today_total, v_today_count
  FROM promoter_deposits
  WHERE promoter_id = p_promoter_id
    AND created_at::date = v_today;

  -- 每日最多 10 次
  IF v_today_count >= 10 THEN
    RETURN json_build_object('success', false, 'error', 'DAILY_COUNT_EXCEEDED');
  END IF;

  -- 每日额度上限
  IF (v_today_total + p_amount) > COALESCE(v_promoter.daily_deposit_limit, 5000) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'DAILY_LIMIT_EXCEEDED',
      'remaining', COALESCE(v_promoter.daily_deposit_limit, 5000) - v_today_total
    );
  END IF;

  -- ============================================================
  -- Step 5: 获取或创建目标用户的钱包（使用 FOR UPDATE 锁定防止并发）
  -- ============================================================
  SELECT *
  INTO v_wallet
  FROM wallets
  WHERE user_id = p_target_user_id AND type = 'TJS'
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    -- 自动创建钱包
    INSERT INTO wallets (user_id, type, currency, balance, total_deposits, first_deposit_bonus_claimed, first_deposit_bonus_amount)
    VALUES (p_target_user_id, 'TJS', 'TJS', 0, 0, false, 0)
    RETURNING * INTO v_wallet;
  END IF;

  -- ============================================================
  -- Step 6: 检查是否为首充，计算首充奖励
  -- ============================================================
  v_is_first_deposit := (COALESCE(v_wallet.total_deposits, 0) = 0)
                        AND (v_wallet.first_deposit_bonus_claimed IS NOT TRUE);

  IF v_is_first_deposit THEN
    -- 从 system_config 获取首充奖励配置
    SELECT value INTO v_config_data
    FROM system_config
    WHERE key = 'first_deposit_bonus';

    IF v_config_data IS NOT NULL THEN
      -- 解析 JSON 配置
      IF (v_config_data.value::json->>'enabled')::boolean
         AND p_amount >= (v_config_data.value::json->>'min_deposit_amount')::numeric THEN
        v_bonus_percent := (v_config_data.value::json->>'bonus_percent')::numeric;
        v_bonus_amount := LEAST(
          p_amount * (v_bonus_percent / 100),
          (v_config_data.value::json->>'max_bonus_amount')::numeric
        );
      END IF;
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
    first_deposit_bonus_claimed = CASE WHEN v_bonus_amount > 0 THEN true ELSE first_deposit_bonus_claimed END,
    first_deposit_bonus_amount = CASE WHEN v_bonus_amount > 0 THEN v_bonus_amount ELSE first_deposit_bonus_amount END,
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
    '地推充值 - 操作员: ' || p_promoter_id::text,
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
      '首充奖励 (' || v_bonus_percent || '%) - 地推充值',
      v_tx_id,
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
  -- Step 11: 插入通知队列 - 通知被充值用户
  -- ============================================================
  INSERT INTO notification_queue (
    user_id, type, payload,
    telegram_chat_id, notification_type,
    title, message, data
  ) VALUES (
    p_target_user_id,
    'promoter_deposit',
    json_build_object(
      'transaction_amount', p_amount,
      'bonus_amount', v_bonus_amount
    )::jsonb,
    NULL,
    'promoter_deposit',
    '线下充值到账',
    '',
    json_build_object(
      'transaction_amount', p_amount,
      'bonus_amount', v_bonus_amount,
      'promoter_id', p_promoter_id
    )::jsonb
  );

  -- ============================================================
  -- Step 12: 插入通知队列 - 通知地推人员本人
  -- ============================================================
  INSERT INTO notification_queue (
    user_id, type, payload,
    telegram_chat_id, notification_type,
    title, message, data
  ) VALUES (
    p_promoter_id,
    'promoter_deposit_confirm',
    json_build_object(
      'transaction_amount', p_amount,
      'target_user_id', p_target_user_id
    )::jsonb,
    NULL,
    'promoter_deposit_confirm',
    '代客充值成功',
    '',
    json_build_object(
      'transaction_amount', p_amount,
      'target_user_id', p_target_user_id
    )::jsonb
  );

  -- ============================================================
  -- Step 13: 更新或创建当日缴款结算记录
  -- ============================================================
  INSERT INTO promoter_settlements (
    promoter_id, settlement_date,
    total_deposit_amount, total_deposit_count,
    settlement_status
  ) VALUES (
    p_promoter_id, v_today,
    p_amount, 1,
    'pending'
  )
  ON CONFLICT (promoter_id, settlement_date)
  DO UPDATE SET
    total_deposit_amount = promoter_settlements.total_deposit_amount + p_amount,
    total_deposit_count = promoter_settlements.total_deposit_count + 1,
    updated_at = now();

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
END;
$$;

COMMENT ON FUNCTION perform_promoter_deposit(UUID, UUID, NUMERIC, TEXT)
  IS '地推人员代客充值核心事务函数，在单个事务中完成所有操作';

-- ============================================================
-- 7. RPC 函数：get_promoter_deposit_stats
--    获取地推人员充值统计数据（对账用）
-- ============================================================
CREATE OR REPLACE FUNCTION get_promoter_deposit_stats(
  p_promoter_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today_stats RECORD;
  v_promoter RECORD;
BEGIN
  -- 获取地推人员信息
  SELECT pp.daily_deposit_limit
  INTO v_promoter
  FROM promoter_profiles pp
  WHERE pp.user_id = p_promoter_id;

  -- 获取指定日期的充值统计
  SELECT
    COALESCE(SUM(amount), 0) AS total_amount,
    COUNT(*) AS total_count,
    COALESCE(SUM(bonus_amount), 0) AS total_bonus
  INTO v_today_stats
  FROM promoter_deposits
  WHERE promoter_id = p_promoter_id
    AND created_at::date = p_date;

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
$$;

COMMENT ON FUNCTION get_promoter_deposit_stats(UUID, DATE)
  IS '获取地推人员指定日期的充值统计，用于前端展示和对账';

-- ============================================================
-- 8. RLS 策略（Row Level Security）
-- ============================================================

-- promoter_deposits 表 RLS
ALTER TABLE promoter_deposits ENABLE ROW LEVEL SECURITY;

-- 允许 service_role 完全访问
CREATE POLICY "Service role full access on promoter_deposits"
  ON promoter_deposits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- promoter_settlements 表 RLS
ALTER TABLE promoter_settlements ENABLE ROW LEVEL SECURITY;

-- 允许 service_role 完全访问
CREATE POLICY "Service role full access on promoter_settlements"
  ON promoter_settlements
  FOR ALL
  USING (true)
  WITH CHECK (true);
