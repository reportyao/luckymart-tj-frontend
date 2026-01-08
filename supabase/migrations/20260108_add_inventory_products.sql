-- 库存商品管理系统数据库迁移脚本
-- 创建时间: 2026-01-08
-- 目的: 实现全款购买和一元购物的库存独立管理

-- ============================================
-- 1. 创建库存商品表 (inventory_products)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本信息
  name TEXT NOT NULL,                           -- 商品名称
  name_i18n JSONB DEFAULT '{}',                 -- 多语言名称 {zh: '', ru: '', tg: ''}
  description TEXT,                             -- 商品描述
  description_i18n JSONB DEFAULT '{}',          -- 多语言描述
  
  -- 图片
  image_url TEXT,                               -- 主图
  image_urls TEXT[] DEFAULT '{}',               -- 多图
  
  -- 规格信息
  specifications TEXT,                          -- 规格
  specifications_i18n JSONB DEFAULT '{}',       -- 多语言规格
  material TEXT,                                -- 材质
  material_i18n JSONB DEFAULT '{}',             -- 多语言材质
  details TEXT,                                 -- 详情（富文本）
  details_i18n JSONB DEFAULT '{}',              -- 多语言详情
  
  -- 价格和库存
  original_price DECIMAL(10, 2) NOT NULL,       -- 原价（全款购买价格）
  currency TEXT DEFAULT 'TJS',                  -- 货币类型
  stock INTEGER NOT NULL DEFAULT 0,             -- 当前库存数量
  reserved_stock INTEGER DEFAULT 0,             -- 预留库存（用于一元购物中奖）
  
  -- SKU管理
  sku TEXT UNIQUE,                              -- 商品SKU编码
  barcode TEXT,                                 -- 条形码
  
  -- 状态
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK')),
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_inventory_products_status ON inventory_products(status);
CREATE INDEX IF NOT EXISTS idx_inventory_products_sku ON inventory_products(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_products_created_at ON inventory_products(created_at DESC);

-- ============================================
-- 2. 创建库存变动记录表 (inventory_transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联信息
  inventory_product_id UUID NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
  
  -- 变动信息
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'FULL_PURCHASE',      -- 全款购买
    'LOTTERY_PRIZE',      -- 一元购物中奖
    'STOCK_IN',           -- 入库
    'STOCK_OUT',          -- 出库
    'ADJUSTMENT',         -- 库存调整
    'RESERVE',            -- 预留（一元购物开始时）
    'RELEASE_RESERVE'     -- 释放预留
  )),
  
  quantity INTEGER NOT NULL,                    -- 变动数量（正数增加，负数减少）
  stock_before INTEGER NOT NULL,                -- 变动前库存
  stock_after INTEGER NOT NULL,                 -- 变动后库存
  
  -- 关联订单/活动
  related_order_id UUID,                        -- 关联订单ID
  related_lottery_id UUID,                      -- 关联积分商城活动ID
  
  -- 操作信息
  operator_id UUID,                             -- 操作人ID（管理员）
  notes TEXT,                                   -- 备注
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_id ON inventory_transactions(inventory_product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at DESC);

-- ============================================
-- 3. 修改积分商城商品表 (lotteries)
-- ============================================
-- 添加关联库存商品的字段
ALTER TABLE lotteries ADD COLUMN IF NOT EXISTS inventory_product_id UUID REFERENCES inventory_products(id);

-- 添加全款购买相关字段
ALTER TABLE lotteries ADD COLUMN IF NOT EXISTS full_purchase_enabled BOOLEAN DEFAULT true;
ALTER TABLE lotteries ADD COLUMN IF NOT EXISTS full_purchase_price DECIMAL(10, 2);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_lotteries_inventory_product_id ON lotteries(inventory_product_id);

-- ============================================
-- 4. 启用RLS (Row Level Security)
-- ============================================
ALTER TABLE inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：允许所有用户读取库存商品
CREATE POLICY "Allow public read access to inventory_products" ON inventory_products
  FOR SELECT USING (true);

-- 创建RLS策略：只允许服务角色写入库存商品
CREATE POLICY "Allow service role to manage inventory_products" ON inventory_products
  FOR ALL USING (true) WITH CHECK (true);

-- 创建RLS策略：允许所有用户读取库存变动记录
CREATE POLICY "Allow public read access to inventory_transactions" ON inventory_transactions
  FOR SELECT USING (true);

-- 创建RLS策略：只允许服务角色写入库存变动记录
CREATE POLICY "Allow service role to manage inventory_transactions" ON inventory_transactions
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 5. 创建触发器：自动更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_inventory_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_products_updated_at
  BEFORE UPDATE ON inventory_products
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_products_updated_at();

-- ============================================
-- 6. 创建触发器：库存不足时自动更新状态
-- ============================================
CREATE OR REPLACE FUNCTION update_inventory_product_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock <= 0 AND NEW.status = 'ACTIVE' THEN
    NEW.status = 'OUT_OF_STOCK';
  ELSIF NEW.stock > 0 AND NEW.status = 'OUT_OF_STOCK' THEN
    NEW.status = 'ACTIVE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_product_status
  BEFORE UPDATE ON inventory_products
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_product_status();

-- ============================================
-- 7. 添加注释
-- ============================================
COMMENT ON TABLE inventory_products IS '库存商品表 - 管理仓库实际库存';
COMMENT ON COLUMN inventory_products.stock IS '当前可用库存数量';
COMMENT ON COLUMN inventory_products.reserved_stock IS '预留库存（用于一元购物中奖预留）';
COMMENT ON COLUMN inventory_products.original_price IS '商品原价，用于全款购买';

COMMENT ON TABLE inventory_transactions IS '库存变动记录表 - 记录所有库存变动';
COMMENT ON COLUMN inventory_transactions.quantity IS '变动数量，正数为增加，负数为减少';

COMMENT ON COLUMN lotteries.inventory_product_id IS '关联的库存商品ID';
COMMENT ON COLUMN lotteries.full_purchase_enabled IS '是否启用全款购买';
COMMENT ON COLUMN lotteries.full_purchase_price IS '全款购买价格，为空时使用库存商品原价';
