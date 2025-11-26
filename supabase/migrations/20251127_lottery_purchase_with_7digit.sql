-- 创建带并发控制的夺宝购买RPC函数（7位数参与码版本）
-- 功能：
-- 1. 使用 FOR UPDATE 行锁防止并发超卖
-- 2. 连续分配7位数参与码（从1000000开始）
-- 3. 原子操作保证数据一致性
-- 4. 自动检测售罄并设置180秒开奖倒计时

CREATE OR REPLACE FUNCTION purchase_lottery_with_concurrency_control(
  p_user_id UUID,
  p_lottery_id UUID,
  p_quantity INTEGER,
  p_payment_method TEXT,
  p_wallet_id UUID,
  p_total_amount NUMERIC,
  p_order_number TEXT
) RETURNS JSONB AS $$
DECLARE
  v_lottery RECORD;
  v_wallet RECORD;
  v_order_id UUID;
  v_participation_codes TEXT[];
  v_start_number INTEGER;
  v_new_sold_tickets INTEGER;
  v_is_sold_out BOOLEAN;
  v_draw_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- 1. 参数校验
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION '购买数量必须大于0';
  END IF;

  IF p_quantity > 100 THEN
    RAISE EXCEPTION '单次购买数量不能超过100';
  END IF;

  -- 2. 使用 FOR UPDATE 行锁锁定lottery记录（防止并发超卖的关键）
  SELECT * INTO v_lottery
  FROM lotteries
  WHERE id = p_lottery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '夺宝商品不存在';
  END IF;

  -- 3. 检查lottery状态
  IF v_lottery.status != 'ACTIVE' THEN
    RAISE EXCEPTION '夺宝商品未激活，当前状态: %', v_lottery.status;
  END IF;

  -- 4. 检查库存是否充足（防止超卖的核心逻辑）
  IF v_lottery.sold_tickets + p_quantity > v_lottery.total_tickets THEN
    RAISE EXCEPTION '库存不足，剩余 % 份，您要购买 % 份',
      v_lottery.total_tickets - v_lottery.sold_tickets,
      p_quantity;
  END IF;

  -- 5. 锁定钱包记录并检查余额
  SELECT * INTO v_wallet
  FROM wallets
  WHERE id = p_wallet_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '钱包不存在';
  END IF;

  IF v_wallet.balance < p_total_amount THEN
    RAISE EXCEPTION '余额不足，需要 % %，当前余额 % %',
      p_total_amount,
      v_wallet.currency,
      v_wallet.balance,
      v_wallet.currency;
  END IF;

  -- 6. 创建订单
  INSERT INTO orders (
    user_id,
    order_number,
    type,
    total_amount,
    currency,
    payment_method,
    lottery_id,
    quantity,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_order_number,
    'LOTTERY_PURCHASE',
    p_total_amount,
    v_lottery.currency,
    p_payment_method,
    p_lottery_id,
    p_quantity,
    'PAID',
    NOW(),
    NOW()
  ) RETURNING id INTO v_order_id;

  -- 7. 生成连续7位数参与码
  -- 从 1000000 + sold_tickets 开始分配
  v_start_number := 1000000 + v_lottery.sold_tickets;
  v_participation_codes := ARRAY[]::TEXT[];

  FOR i IN 0..(p_quantity - 1) LOOP
    v_participation_codes := array_append(v_participation_codes, (v_start_number + i)::TEXT);
  END LOOP;

  -- 8. 创建lottery_entries记录
  INSERT INTO lottery_entries (
    user_id,
    lottery_id,
    order_id,
    numbers,
    is_winning,
    status,
    is_from_market,
    created_at,
    updated_at
  )
  SELECT
    p_user_id,
    p_lottery_id,
    v_order_id,
    unnest(v_participation_codes),
    false,
    'ACTIVE',
    false,
    NOW(),
    NOW();

  -- 9. 扣除钱包余额
  UPDATE wallets
  SET balance = balance - p_total_amount,
      version = version + 1,
      updated_at = NOW()
  WHERE id = p_wallet_id;

  -- 10. 创建钱包交易记录
  INSERT INTO wallet_transactions (
    wallet_id,
    type,
    amount,
    balance_before,
    balance_after,
    status,
    description,
    related_order_id,
    related_lottery_id,
    created_at
  ) VALUES (
    p_wallet_id,
    'LOTTERY_PURCHASE',
    -p_total_amount,
    v_wallet.balance,
    v_wallet.balance - p_total_amount,
    'COMPLETED',
    '夺宝购买 - 订单 ' || p_order_number,
    v_order_id,
    p_lottery_id,
    NOW()
  );

  -- 11. 更新lottery已售数量
  v_new_sold_tickets := v_lottery.sold_tickets + p_quantity;
  v_is_sold_out := v_new_sold_tickets >= v_lottery.total_tickets;

  -- 12. 如果售罄，设置开奖时间为180秒后
  IF v_is_sold_out THEN
    v_draw_time := NOW() + INTERVAL '180 seconds';
    
    UPDATE lotteries
    SET sold_tickets = v_new_sold_tickets,
        status = 'SOLD_OUT',
        draw_time = v_draw_time,
        updated_at = NOW()
    WHERE id = p_lottery_id;
  ELSE
    UPDATE lotteries
    SET sold_tickets = v_new_sold_tickets,
        updated_at = NOW()
    WHERE id = p_lottery_id;
  END IF;

  -- 13. 返回结果
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', p_order_number,
    'participation_codes', v_participation_codes,
    'total_amount', p_total_amount,
    'remaining_balance', v_wallet.balance - p_total_amount,
    'is_sold_out', v_is_sold_out,
    'draw_time', v_draw_time,
    'new_sold_tickets', v_new_sold_tickets
  );

EXCEPTION
  WHEN OTHERS THEN
    -- 发生任何错误时自动回滚事务
    RAISE EXCEPTION '购买失败: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 添加函数注释
COMMENT ON FUNCTION purchase_lottery_with_concurrency_control IS 
'夺宝购买函数（带并发控制）- 使用FOR UPDATE行锁防止超卖，连续分配7位数参与码（从1000000开始），售罄后自动设置180秒开奖倒计时';

-- 使用示例:
-- SELECT purchase_lottery_with_concurrency_control(
--   'user-uuid'::uuid,           -- p_user_id
--   'lottery-uuid'::uuid,         -- p_lottery_id
--   3,                            -- p_quantity (购买3份)
--   'LUCKY_COIN',                 -- p_payment_method
--   'wallet-uuid'::uuid,          -- p_wallet_id
--   30.00,                        -- p_total_amount
--   'LT1234567890ABCD'            -- p_order_number
-- );

-- 返回示例:
-- {
--   "success": true,
--   "order_id": "order-uuid",
--   "order_number": "LT1234567890ABCD",
--   "participation_codes": ["1000000", "1000001", "1000002"],
--   "total_amount": 30.00,
--   "remaining_balance": 70.00,
--   "is_sold_out": false,
--   "draw_time": null,
--   "new_sold_tickets": 3
-- }
