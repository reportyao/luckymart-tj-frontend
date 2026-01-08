-- ============================================
-- 批次管理系统数据库迁移脚本
-- 创建时间: 2026-01-09
-- 目的: 实现从中国集运发货到塔吉克斯坦自提的完整物流管理流程
-- ============================================

-- ============================================
-- 1. 创建发货批次表 (shipment_batches)
-- ============================================
CREATE TABLE IF NOT EXISTS shipment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 批次基本信息
  batch_no VARCHAR(50) UNIQUE NOT NULL,              -- 批次号，如 BATCH-20260108-01
  china_tracking_no VARCHAR(100),                    -- 中国段物流单号
  tajikistan_tracking_no VARCHAR(100),               -- 塔吉克斯坦段物流单号
  
  -- 批次状态
  status VARCHAR(30) NOT NULL DEFAULT 'IN_TRANSIT_CHINA' CHECK (status IN (
    'IN_TRANSIT_CHINA',      -- 运输中（中国段）
    'IN_TRANSIT_TAJIKISTAN', -- 运输中（塔吉克斯坦段）
    'ARRIVED',               -- 已到达
    'CANCELLED'              -- 已取消
  )),
  
  -- 时间信息
  shipped_at TIMESTAMPTZ NOT NULL,                   -- 发货时间
  estimated_arrival_date DATE,                       -- 预计到达日期
  arrived_at TIMESTAMPTZ,                            -- 实际到达时间
  
  -- 到货确认信息
  arrival_photos TEXT[] DEFAULT '{}',                -- 到货照片URLs
  arrival_notes TEXT,                                -- 到货备注
  confirmed_by UUID,                                 -- 确认人（管理员ID）
  confirmed_at TIMESTAMPTZ,                          -- 确认时间
  
  -- 统计信息（冗余存储，便于快速查询）
  total_orders INTEGER DEFAULT 0,                    -- 总订单数
  normal_orders INTEGER DEFAULT 0,                   -- 正常订单数
  missing_orders INTEGER DEFAULT 0,                  -- 缺货订单数
  damaged_orders INTEGER DEFAULT 0,                  -- 损坏订单数
  
  -- 备注和元数据
  admin_note TEXT,                                   -- 管理员备注
  metadata JSONB DEFAULT '{}',                       -- 扩展元数据
  
  -- 创建信息
  created_by UUID NOT NULL,                          -- 创建人（管理员ID）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_shipment_batches_status ON shipment_batches(status);
CREATE INDEX IF NOT EXISTS idx_shipment_batches_batch_no ON shipment_batches(batch_no);
CREATE INDEX IF NOT EXISTS idx_shipment_batches_shipped_at ON shipment_batches(shipped_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_batches_created_at ON shipment_batches(created_at DESC);

-- 创建触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_shipment_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_shipment_batches_updated_at ON shipment_batches;
CREATE TRIGGER trigger_update_shipment_batches_updated_at
  BEFORE UPDATE ON shipment_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_shipment_batches_updated_at();

-- 添加注释
COMMENT ON TABLE shipment_batches IS '发货批次表 - 管理从中国到塔吉克斯坦的物流批次';
COMMENT ON COLUMN shipment_batches.batch_no IS '批次号，格式如 BATCH-20260108-01';
COMMENT ON COLUMN shipment_batches.status IS '批次状态：IN_TRANSIT_CHINA(中国段运输中), IN_TRANSIT_TAJIKISTAN(塔国段运输中), ARRIVED(已到达), CANCELLED(已取消)';
COMMENT ON COLUMN shipment_batches.arrival_photos IS '到货确认照片URLs数组';

-- ============================================
-- 2. 创建批次订单关联表 (batch_order_items)
-- ============================================
CREATE TABLE IF NOT EXISTS batch_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 批次关联
  batch_id UUID NOT NULL REFERENCES shipment_batches(id) ON DELETE CASCADE,
  
  -- 订单关联（三种订单类型）
  order_type VARCHAR(20) NOT NULL CHECK (order_type IN (
    'FULL_PURCHASE',  -- 全款购买
    'LOTTERY_PRIZE',  -- 一元购物中奖
    'GROUP_BUY'       -- 拼团
  )),
  order_id UUID NOT NULL,  -- 对应订单ID（full_purchase_orders.id / prizes.id / group_buy_results.id）
  
  -- 商品信息（冗余存储，便于统计和展示）
  product_name TEXT,
  product_name_i18n JSONB DEFAULT '{}',
  product_sku VARCHAR(100),
  product_image TEXT,
  quantity INTEGER DEFAULT 1,
  
  -- 用户信息（冗余存储，便于展示）
  user_id UUID,
  user_telegram_id BIGINT,
  user_name TEXT,
  
  -- 到货状态
  arrival_status VARCHAR(20) DEFAULT 'PENDING' CHECK (arrival_status IN (
    'PENDING',   -- 待确认
    'NORMAL',    -- 正常到货
    'MISSING',   -- 缺货
    'DAMAGED'    -- 损坏
  )),
  arrival_notes TEXT,  -- 到货备注
  
  -- 提货码（到货确认后生成）
  pickup_code VARCHAR(20),
  pickup_code_generated_at TIMESTAMPTZ,
  pickup_code_expires_at TIMESTAMPTZ,
  
  -- 通知状态
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,
  
  -- 时间戳
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建唯一索引：同一订单不能重复加入批次
CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_order_items_unique_order 
  ON batch_order_items(order_type, order_id);

-- 创建其他索引
CREATE INDEX IF NOT EXISTS idx_batch_order_items_batch_id ON batch_order_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_order_type ON batch_order_items(order_type);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_product_sku ON batch_order_items(product_sku);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_arrival_status ON batch_order_items(arrival_status);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_user_id ON batch_order_items(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_pickup_code ON batch_order_items(pickup_code);

-- 创建触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_batch_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_batch_order_items_updated_at ON batch_order_items;
CREATE TRIGGER trigger_update_batch_order_items_updated_at
  BEFORE UPDATE ON batch_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_order_items_updated_at();

-- 添加注释
COMMENT ON TABLE batch_order_items IS '批次订单关联表 - 记录批次中的订单明细';
COMMENT ON COLUMN batch_order_items.order_type IS '订单类型：FULL_PURCHASE(全款购买), LOTTERY_PRIZE(一元购物中奖), GROUP_BUY(拼团)';
COMMENT ON COLUMN batch_order_items.arrival_status IS '到货状态：PENDING(待确认), NORMAL(正常), MISSING(缺货), DAMAGED(损坏)';

-- ============================================
-- 3. 修改 full_purchase_orders 表
-- ============================================
-- 添加批次关联字段
ALTER TABLE full_purchase_orders 
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES shipment_batches(id);

-- 添加物流状态字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'full_purchase_orders' AND column_name = 'logistics_status'
  ) THEN
    ALTER TABLE full_purchase_orders 
      ADD COLUMN logistics_status VARCHAR(30) DEFAULT 'PENDING_SHIPMENT';
  END IF;
END $$;

-- 添加约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'full_purchase_orders_logistics_status_check'
  ) THEN
    ALTER TABLE full_purchase_orders
      ADD CONSTRAINT full_purchase_orders_logistics_status_check
      CHECK (logistics_status IN (
        'PENDING_SHIPMENT',       -- 待发货
        'IN_TRANSIT_CHINA',       -- 运输中（中国段）
        'IN_TRANSIT_TAJIKISTAN',  -- 运输中（塔吉克斯坦段）
        'READY_FOR_PICKUP',       -- 待自提
        'PICKED_UP'               -- 已提货
      ));
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_batch_id ON full_purchase_orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_logistics_status ON full_purchase_orders(logistics_status);

-- 添加注释
COMMENT ON COLUMN full_purchase_orders.batch_id IS '关联的发货批次ID';
COMMENT ON COLUMN full_purchase_orders.logistics_status IS '物流状态：PENDING_SHIPMENT(待发货), IN_TRANSIT_CHINA(中国段运输中), IN_TRANSIT_TAJIKISTAN(塔国段运输中), READY_FOR_PICKUP(待自提), PICKED_UP(已提货)';

-- ============================================
-- 4. 修改 prizes 表
-- ============================================
-- 添加批次关联字段
ALTER TABLE prizes 
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES shipment_batches(id);

-- 添加物流状态字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prizes' AND column_name = 'logistics_status'
  ) THEN
    ALTER TABLE prizes 
      ADD COLUMN logistics_status VARCHAR(30) DEFAULT 'PENDING_SHIPMENT';
  END IF;
END $$;

-- 添加约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prizes_logistics_status_check'
  ) THEN
    ALTER TABLE prizes
      ADD CONSTRAINT prizes_logistics_status_check
      CHECK (logistics_status IN (
        'PENDING_SHIPMENT',       -- 待发货
        'IN_TRANSIT_CHINA',       -- 运输中（中国段）
        'IN_TRANSIT_TAJIKISTAN',  -- 运输中（塔吉克斯坦段）
        'READY_FOR_PICKUP',       -- 待自提
        'PICKED_UP'               -- 已提货
      ));
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_prizes_batch_id ON prizes(batch_id);
CREATE INDEX IF NOT EXISTS idx_prizes_logistics_status ON prizes(logistics_status);

-- 添加注释
COMMENT ON COLUMN prizes.batch_id IS '关联的发货批次ID';
COMMENT ON COLUMN prizes.logistics_status IS '物流状态：PENDING_SHIPMENT(待发货), IN_TRANSIT_CHINA(中国段运输中), IN_TRANSIT_TAJIKISTAN(塔国段运输中), READY_FOR_PICKUP(待自提), PICKED_UP(已提货)';

-- ============================================
-- 5. 修改 group_buy_results 表
-- ============================================
-- 添加批次关联字段
ALTER TABLE group_buy_results 
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES shipment_batches(id);

-- 添加物流状态字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'group_buy_results' AND column_name = 'logistics_status'
  ) THEN
    ALTER TABLE group_buy_results 
      ADD COLUMN logistics_status VARCHAR(30) DEFAULT 'PENDING_SHIPMENT';
  END IF;
END $$;

-- 添加约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_buy_results_logistics_status_check'
  ) THEN
    ALTER TABLE group_buy_results
      ADD CONSTRAINT group_buy_results_logistics_status_check
      CHECK (logistics_status IN (
        'PENDING_SHIPMENT',       -- 待发货
        'IN_TRANSIT_CHINA',       -- 运输中（中国段）
        'IN_TRANSIT_TAJIKISTAN',  -- 运输中（塔吉克斯坦段）
        'READY_FOR_PICKUP',       -- 待自提
        'PICKED_UP'               -- 已提货
      ));
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_group_buy_results_batch_id ON group_buy_results(batch_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_results_logistics_status ON group_buy_results(logistics_status);

-- 添加注释
COMMENT ON COLUMN group_buy_results.batch_id IS '关联的发货批次ID';
COMMENT ON COLUMN group_buy_results.logistics_status IS '物流状态：PENDING_SHIPMENT(待发货), IN_TRANSIT_CHINA(中国段运输中), IN_TRANSIT_TAJIKISTAN(塔国段运输中), READY_FOR_PICKUP(待自提), PICKED_UP(已提货)';

-- ============================================
-- 6. 启用RLS (Row Level Security)
-- ============================================
ALTER TABLE shipment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_order_items ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：允许所有用户读取批次信息（用于前端展示物流状态）
CREATE POLICY "Allow public read access to shipment_batches" ON shipment_batches
  FOR SELECT USING (true);

-- 创建RLS策略：只允许服务角色管理批次
CREATE POLICY "Allow service role to manage shipment_batches" ON shipment_batches
  FOR ALL USING (true) WITH CHECK (true);

-- 创建RLS策略：用户只能读取自己的订单关联记录
CREATE POLICY "Allow users to read own batch_order_items" ON batch_order_items
  FOR SELECT USING (
    user_id = auth.uid() OR
    auth.role() = 'service_role'
  );

-- 创建RLS策略：只允许服务角色管理订单关联
CREATE POLICY "Allow service role to manage batch_order_items" ON batch_order_items
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 7. 创建批次统计视图
-- ============================================
CREATE OR REPLACE VIEW batch_statistics AS
SELECT 
  sb.id,
  sb.batch_no,
  sb.status,
  sb.shipped_at,
  sb.estimated_arrival_date,
  sb.arrived_at,
  sb.created_at,
  COUNT(boi.id) AS total_items,
  COUNT(CASE WHEN boi.arrival_status = 'NORMAL' THEN 1 END) AS normal_items,
  COUNT(CASE WHEN boi.arrival_status = 'MISSING' THEN 1 END) AS missing_items,
  COUNT(CASE WHEN boi.arrival_status = 'DAMAGED' THEN 1 END) AS damaged_items,
  COUNT(CASE WHEN boi.arrival_status = 'PENDING' THEN 1 END) AS pending_items,
  COUNT(CASE WHEN boi.notification_sent = TRUE THEN 1 END) AS notified_items,
  CASE 
    WHEN sb.arrived_at IS NOT NULL AND sb.shipped_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (sb.arrived_at - sb.shipped_at)) / 86400 
    ELSE NULL 
  END AS transit_days
FROM shipment_batches sb
LEFT JOIN batch_order_items boi ON boi.batch_id = sb.id
GROUP BY sb.id;

COMMENT ON VIEW batch_statistics IS '批次统计视图 - 提供批次的汇总统计信息';

-- ============================================
-- 8. 创建SKU统计视图（按批次）
-- ============================================
CREATE OR REPLACE VIEW batch_sku_summary AS
SELECT 
  boi.batch_id,
  boi.product_sku,
  boi.product_name,
  boi.product_name_i18n,
  boi.product_image,
  COUNT(*) AS total_quantity,
  COUNT(CASE WHEN boi.arrival_status = 'NORMAL' THEN 1 END) AS normal_quantity,
  COUNT(CASE WHEN boi.arrival_status = 'MISSING' THEN 1 END) AS missing_quantity,
  COUNT(CASE WHEN boi.arrival_status = 'DAMAGED' THEN 1 END) AS damaged_quantity,
  COUNT(CASE WHEN boi.arrival_status = 'PENDING' THEN 1 END) AS pending_quantity
FROM batch_order_items boi
WHERE boi.product_sku IS NOT NULL
GROUP BY boi.batch_id, boi.product_sku, boi.product_name, boi.product_name_i18n, boi.product_image;

COMMENT ON VIEW batch_sku_summary IS 'SKU统计视图 - 按批次和SKU汇总商品数量';

-- ============================================
-- 9. 创建辅助函数：生成批次号
-- ============================================
CREATE OR REPLACE FUNCTION generate_batch_no()
RETURNS TEXT AS $$
DECLARE
  today_date TEXT;
  seq_num INTEGER;
  new_batch_no TEXT;
BEGIN
  today_date := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- 获取今天的序号
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(batch_no FROM 'BATCH-' || today_date || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM shipment_batches
  WHERE batch_no LIKE 'BATCH-' || today_date || '-%';
  
  new_batch_no := 'BATCH-' || today_date || '-' || LPAD(seq_num::TEXT, 2, '0');
  
  RETURN new_batch_no;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_batch_no() IS '生成批次号，格式：BATCH-YYYYMMDD-NN';

-- ============================================
-- 10. 创建辅助函数：更新批次统计
-- ============================================
CREATE OR REPLACE FUNCTION update_batch_statistics(p_batch_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE shipment_batches
  SET 
    total_orders = (SELECT COUNT(*) FROM batch_order_items WHERE batch_id = p_batch_id),
    normal_orders = (SELECT COUNT(*) FROM batch_order_items WHERE batch_id = p_batch_id AND arrival_status = 'NORMAL'),
    missing_orders = (SELECT COUNT(*) FROM batch_order_items WHERE batch_id = p_batch_id AND arrival_status = 'MISSING'),
    damaged_orders = (SELECT COUNT(*) FROM batch_order_items WHERE batch_id = p_batch_id AND arrival_status = 'DAMAGED')
  WHERE id = p_batch_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_batch_statistics(UUID) IS '更新批次的统计信息';

-- ============================================
-- 11. 创建触发器：订单加入批次时自动更新统计
-- ============================================
CREATE OR REPLACE FUNCTION trigger_update_batch_statistics()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM update_batch_statistics(NEW.batch_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_batch_statistics(OLD.batch_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_batch_order_items_statistics ON batch_order_items;
CREATE TRIGGER trigger_batch_order_items_statistics
  AFTER INSERT OR UPDATE OR DELETE ON batch_order_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_batch_statistics();

-- ============================================
-- 完成
-- ============================================
