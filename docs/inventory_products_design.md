# 库存商品管理系统数据库设计

## 1. 业务需求分析

### 1.1 当前问题
- 全款购买时直接修改 `lotteries.sold_tickets`，导致一元购物的份数被错误减少
- 当 `sold_tickets >= total_tickets` 时，商品状态变为 `SOLD_OUT`，导致商品从积分商城消失
- 一元购物和全款购买共用库存，逻辑混乱

### 1.2 业务逻辑梳理
1. **一元购物（抽奖模式）**：
   - 用户按份数购买（每份使用积分）
   - 商品有固定总份数（`total_tickets`）
   - 用户购买份数后等待抽奖
   - 所有份数售罄后进行抽奖，中奖者获得商品

2. **全款购买（直接购买模式）**：
   - 用户直接支付全部积分购买商品
   - 从独立的库存商品中减少库存
   - 不影响一元购物的份数销售

3. **商品状态逻辑**：
   - 一元购物份数售罄 → 触发抽奖 → 商品状态变为 `SOLD_OUT` → 全款购买也停止
   - 全款购买只减少库存商品的库存，不影响一元购物份数

## 2. 数据库设计

### 2.1 新增表：inventory_products（库存商品表）

```sql
CREATE TABLE inventory_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 基本信息
  name TEXT NOT NULL,                           -- 商品名称
  name_i18n JSONB DEFAULT '{}',                 -- 多语言名称
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
  details TEXT,                                 -- 详情
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

-- 索引
CREATE INDEX idx_inventory_products_status ON inventory_products(status);
CREATE INDEX idx_inventory_products_sku ON inventory_products(sku);
CREATE INDEX idx_inventory_products_created_at ON inventory_products(created_at DESC);
```

### 2.2 修改表：lotteries（积分商城商品表）

```sql
-- 添加关联库存商品的字段
ALTER TABLE lotteries ADD COLUMN inventory_product_id UUID REFERENCES inventory_products(id);

-- 添加全款购买相关字段
ALTER TABLE lotteries ADD COLUMN full_purchase_enabled BOOLEAN DEFAULT true;  -- 是否启用全款购买
ALTER TABLE lotteries ADD COLUMN full_purchase_price DECIMAL(10, 2);          -- 全款购买价格（可选，默认使用库存商品原价）

-- 添加索引
CREATE INDEX idx_lotteries_inventory_product_id ON lotteries(inventory_product_id);
```

### 2.3 新增表：inventory_transactions（库存变动记录表）

```sql
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联信息
  inventory_product_id UUID NOT NULL REFERENCES inventory_products(id),
  
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

-- 索引
CREATE INDEX idx_inventory_transactions_product_id ON inventory_transactions(inventory_product_id);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_inventory_transactions_created_at ON inventory_transactions(created_at DESC);
```

## 3. 业务流程修改

### 3.1 创建积分商城商品时
1. 选择关联的库存商品（可选）
2. 如果关联了库存商品，全款购买价格默认使用库存商品的原价
3. 预留库存：`reserved_stock += 1`（为中奖者预留一份）

### 3.2 全款购买时
1. 检查关联的库存商品库存是否充足：`stock > 0`
2. 减少库存商品库存：`stock -= 1`
3. 记录库存变动：创建 `inventory_transactions` 记录
4. **不修改** `lotteries.sold_tickets`

### 3.3 一元购物中奖时
1. 释放预留库存：`reserved_stock -= 1`
2. 减少实际库存：`stock -= 1`
3. 记录库存变动

### 3.4 商品状态判断
- 积分商城商品是否可购买：`lotteries.status = 'ACTIVE' AND sold_tickets < total_tickets`
- 全款购买是否可用：`lotteries.status = 'ACTIVE' AND inventory_products.stock > 0`

## 4. 前端修改

### 4.1 管理后台
1. 新增"库存商品"菜单
2. 库存商品列表页面
3. 库存商品创建/编辑表单
4. 库存变动记录查看
5. 积分商城商品表单中添加"关联库存商品"选择器

### 4.2 用户前端
1. 全款购买按钮的禁用条件改为检查库存商品库存
2. 显示全款购买剩余库存（可选）

## 5. 后端修改

### 5.1 Edge Function: create-full-purchase-order
1. 获取关联的库存商品
2. 检查库存商品库存
3. 减少库存商品库存
4. 记录库存变动
5. 不再修改 `lotteries.sold_tickets`

### 5.2 新增 Edge Function: inventory-manage
1. 库存商品CRUD操作
2. 库存调整
3. 库存查询
