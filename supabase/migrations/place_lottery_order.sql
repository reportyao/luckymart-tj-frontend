-- 创建购买夺宝的存储过程(带行锁防止并发超卖)
-- 功能: 用户购买夺宝票,扣除夺宝币,分配连续票号,检查售罄并设置180秒倒计时

CREATE OR REPLACE FUNCTION place_lottery_order(
  p_user_id UUID,
  p_lottery_id UUID,
  p_ticket_count INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_lottery RECORD;
  v_total_cost NUMERIC;
  v_user_balance NUMERIC;
  v_ticket_numbers INTEGER[];
  v_start_ticket_number INTEGER;
  v_result JSONB;
BEGIN
  -- 参数校验
  IF p_ticket_count <= 0 THEN
    RAISE EXCEPTION '购买数量必须大于0';
  END IF;

  -- 使用 FOR UPDATE 行锁,防止并发超卖
  -- 这是关键:同一时刻只有一个事务能修改这条记录
  SELECT * INTO v_lottery
  FROM lotteries 
  WHERE id = p_lottery_id
  FOR UPDATE;
  
  -- 检查夺宝是否存在
  IF NOT FOUND THEN
    RAISE EXCEPTION '夺宝不存在';
  END IF;
  
  -- 检查夺宝状态
  IF v_lottery.status NOT IN ('ACTIVE', 'PENDING', 'STARTED') THEN
    RAISE EXCEPTION '夺宝未开始或已结束,当前状态: %', v_lottery.status;
  END IF;
  
  -- 检查票数是否充足(防止超卖的核心逻辑)
  IF v_lottery.sold_tickets + p_ticket_count > v_lottery.total_tickets THEN
    RAISE EXCEPTION '票数不足,剩余 % 张,您要购买 % 张', 
      v_lottery.total_tickets - v_lottery.sold_tickets, 
      p_ticket_count;
  END IF;
  
  -- 计算总价
  v_total_cost := v_lottery.ticket_price * p_ticket_count;
  
  -- 检查用户余额(假设使用 profiles 表的 balance 字段存储夺宝币)
  -- 注意: 根据实际表结构调整
  SELECT balance INTO v_user_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF v_user_balance IS NULL THEN
    RAISE EXCEPTION '用户不存在';
  END IF;
  
  IF v_user_balance < v_total_cost THEN
    RAISE EXCEPTION '夺宝币余额不足,需要 % 夺宝币,当前余额 % 夺宝币', 
      v_total_cost, 
      v_user_balance;
  END IF;
  
  -- 扣除夺宝币
  UPDATE profiles
  SET balance = balance - v_total_cost,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  -- 生成连续票号
  v_start_ticket_number := v_lottery.sold_tickets + 1;
  FOR i IN 0..(p_ticket_count - 1) LOOP
    v_ticket_numbers := array_append(v_ticket_numbers, v_start_ticket_number + i);
  END LOOP;
  
  -- 创建订单
  INSERT INTO orders (
    user_id, 
    lottery_id, 
    ticket_count, 
    total_amount, 
    currency, 
    status, 
    created_at,
    updated_at
  )
  VALUES (
    p_user_id, 
    p_lottery_id, 
    p_ticket_count, 
    v_total_cost, 
    v_lottery.currency, 
    'COMPLETED', 
    NOW(),
    NOW()
  )
  RETURNING id INTO v_order_id;
  
  -- 创建票记录(连续票号)
  INSERT INTO tickets (user_id, lottery_id, order_id, ticket_number, created_at, updated_at)
  SELECT 
    p_user_id, 
    p_lottery_id, 
    v_order_id, 
    unnest(v_ticket_numbers), 
    NOW(),
    NOW();
  
  -- 更新夺宝售出票数
  UPDATE lotteries
  SET sold_tickets = sold_tickets + p_ticket_count,
      updated_at = NOW()
  WHERE id = p_lottery_id;
  
  -- 检查是否售罄,如果售罄则设置180秒后开奖
  IF v_lottery.sold_tickets + p_ticket_count >= v_lottery.total_tickets THEN
    UPDATE lotteries
    SET status = 'SOLD_OUT',
        draw_time = NOW() + INTERVAL '180 seconds',
        updated_at = NOW()
    WHERE id = p_lottery_id;
  END IF;
  
  -- 返回结果
  v_result := jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'ticket_numbers', v_ticket_numbers,
    'total_cost', v_total_cost,
    'remaining_balance', v_user_balance - v_total_cost,
    'is_sold_out', (v_lottery.sold_tickets + p_ticket_count >= v_lottery.total_tickets),
    'draw_time', CASE 
      WHEN v_lottery.sold_tickets + p_ticket_count >= v_lottery.total_tickets 
      THEN NOW() + INTERVAL '180 seconds'
      ELSE NULL
    END
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- 发生任何错误时回滚事务
    RAISE EXCEPTION '购买失败: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 添加注释
COMMENT ON FUNCTION place_lottery_order IS '购买夺宝票(带行锁防止超卖),分配连续票号,售罄后自动设置180秒开奖倒计时';

-- 使用示例:
-- SELECT place_lottery_order(
--   'user-uuid'::uuid, 
--   'lottery-uuid'::uuid, 
--   3  -- 购买3张票
-- );

-- 返回示例:
-- {
--   "success": true,
--   "order_id": "order-uuid",
--   "ticket_numbers": [11, 12, 13],
--   "total_cost": 30.00,
--   "remaining_balance": 70.00,
--   "is_sold_out": false,
--   "draw_time": null
-- }
