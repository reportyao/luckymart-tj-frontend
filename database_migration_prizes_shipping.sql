-- ============================================
-- 数据库迁移: 中奖管理和发货功能
-- 创建时间: 2024-11-07
-- ============================================

-- 1. 更新lotteries表，添加VRF相关字段
ALTER TABLE lotteries 
ADD COLUMN IF NOT EXISTS winning_ticket_number INTEGER,
ADD COLUMN IF NOT EXISTS winning_user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS vrf_proof TEXT,
ADD COLUMN IF NOT EXISTS vrf_timestamp BIGINT;

-- 移除draw_time字段(如果存在)
-- ALTER TABLE lotteries DROP COLUMN IF EXISTS draw_time;

-- 添加draw_time字段(用于记录开奖时间)
ALTER TABLE lotteries 
ADD COLUMN IF NOT EXISTS draw_time TIMESTAMP WITH TIME ZONE;

-- 2. 创建prizes表(中奖记录表)
CREATE TABLE IF NOT EXISTS prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lottery_id UUID NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES lottery_entries(id) ON DELETE SET NULL,
    winning_code VARCHAR(50) NOT NULL,
    prize_name VARCHAR(255) NOT NULL,
    prize_image TEXT,
    prize_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING: 待处理(用户需要选择发货或转售)
    -- SHIPPING: 已申请发货
    -- SHIPPED: 已发货
    -- DELIVERED: 已签收
    -- RESELLING: 已转售
    won_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_prizes_user_id ON prizes(user_id);
CREATE INDEX IF NOT EXISTS idx_prizes_lottery_id ON prizes(lottery_id);
CREATE INDEX IF NOT EXISTS idx_prizes_status ON prizes(status);
CREATE INDEX IF NOT EXISTS idx_prizes_won_at ON prizes(won_at DESC);

-- 3. 创建shipping表(发货信息表)
CREATE TABLE IF NOT EXISTS shipping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prize_id UUID NOT NULL REFERENCES prizes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 收货人信息
    recipient_name VARCHAR(100) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    recipient_address TEXT NOT NULL,
    recipient_city VARCHAR(100),
    recipient_region VARCHAR(100),
    recipient_postal_code VARCHAR(20),
    recipient_country VARCHAR(50) DEFAULT 'Tajikistan',
    
    -- 发货信息
    shipping_method VARCHAR(50),
    tracking_number VARCHAR(100),
    shipping_company VARCHAR(100),
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    
    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING: 待发货
    -- PROCESSING: 处理中
    -- SHIPPED: 已发货
    -- IN_TRANSIT: 运输中
    -- DELIVERED: 已送达
    -- FAILED: 发货失败
    
    -- 时间记录
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- 备注
    notes TEXT,
    admin_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_shipping_prize_id ON shipping(prize_id);
CREATE INDEX IF NOT EXISTS idx_shipping_user_id ON shipping(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_status ON shipping(status);
CREATE INDEX IF NOT EXISTS idx_shipping_requested_at ON shipping(requested_at DESC);

-- 4. 创建shipping_history表(发货历史记录)
CREATE TABLE IF NOT EXISTS shipping_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipping_id UUID NOT NULL REFERENCES shipping(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    location VARCHAR(255),
    description TEXT,
    operator_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_shipping_history_shipping_id ON shipping_history(shipping_id);
CREATE INDEX IF NOT EXISTS idx_shipping_history_created_at ON shipping_history(created_at DESC);

-- 5. 添加触发器自动更新updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- prizes表触发器
DROP TRIGGER IF EXISTS update_prizes_updated_at ON prizes;
CREATE TRIGGER update_prizes_updated_at
    BEFORE UPDATE ON prizes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- shipping表触发器
DROP TRIGGER IF EXISTS update_shipping_updated_at ON shipping;
CREATE TRIGGER update_shipping_updated_at
    BEFORE UPDATE ON shipping
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. 插入测试数据注释
-- 注意: 以下是测试数据示例，生产环境请删除

-- 示例: 创建一个中奖记录
-- INSERT INTO prizes (lottery_id, user_id, ticket_id, winning_code, prize_name, prize_image, prize_value, status)
-- VALUES (
--     'lottery-uuid-here',
--     'user-uuid-here',
--     'ticket-uuid-here',
--     'LM-001-12345',
--     'iPhone 15 Pro Max',
--     'https://example.com/iphone.jpg',
--     1200.00,
--     'PENDING'
-- );

COMMENT ON TABLE prizes IS '中奖记录表';
COMMENT ON TABLE shipping IS '发货信息表';
COMMENT ON TABLE shipping_history IS '发货历史记录表';

-- 迁移完成
