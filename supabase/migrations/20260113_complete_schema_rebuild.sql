-- ============================================
-- LuckyMart-TJ 完整数据库Schema重建脚本
-- 创建时间: 2026-01-13
-- 目的: 根据代码逻辑重建完整的数据库Schema
-- ============================================

-- ============================================
-- 1. 用户相关表
-- ============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    telegram_id TEXT UNIQUE NOT NULL,
    telegram_username TEXT,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    phone_number TEXT,
    email TEXT,
    
    -- 语言和偏好
    preferred_language TEXT DEFAULT 'zh',
    language_code TEXT DEFAULT 'zh',
    onboarding_completed BOOLEAN DEFAULT false,
    
    -- 推荐系统
    referral_code TEXT UNIQUE,
    referred_by TEXT,
    referral_count INTEGER DEFAULT 0,
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    is_blocked BOOLEAN DEFAULT false,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

-- 管理员用户表
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    display_name TEXT,
    role TEXT DEFAULT 'admin',
    status TEXT DEFAULT 'active',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. 钱包和交易相关表
-- ============================================

-- 钱包表
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'LUCKY_COIN',
    currency TEXT DEFAULT 'TJS',
    balance DECIMAL(10,2) DEFAULT 0,
    frozen_balance DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_type ON wallets(type);

-- 钱包交易记录表
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balance_before DECIMAL(10,2),
    balance_after DECIMAL(10,2),
    description TEXT,
    reference_id TEXT,
    reference_type TEXT,
    status TEXT DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

-- ============================================
-- 3. 商品和抽奖相关表
-- ============================================

-- 库存商品表（SKU管理）
CREATE TABLE IF NOT EXISTS inventory_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_i18n JSONB DEFAULT '{}',
    description TEXT,
    description_i18n JSONB DEFAULT '{}',
    category TEXT,
    image_url TEXT,
    image_urls TEXT[],
    
    -- 价格信息
    cost_price DECIMAL(10,2),
    selling_price DECIMAL(10,2),
    original_price DECIMAL(10,2),
    
    -- 库存信息
    stock_quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 5,
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_products_sku ON inventory_products(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_products_category ON inventory_products(category);
CREATE INDEX IF NOT EXISTS idx_inventory_products_is_active ON inventory_products(is_active);

-- 抽奖/一元购商品表
CREATE TABLE IF NOT EXISTS lotteries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    title_i18n JSONB DEFAULT '{}',
    description TEXT,
    description_i18n JSONB DEFAULT '{}',
    
    -- 图片
    image_url TEXT,
    image_urls TEXT[],
    
    -- 价格
    original_price DECIMAL(10,2) NOT NULL,
    ticket_price DECIMAL(10,2) DEFAULT 1.00,
    
    -- 全款购买
    full_purchase_enabled BOOLEAN DEFAULT false,
    full_purchase_price DECIMAL(10,2),
    price_comparisons JSONB,
    
    -- 库存关联
    inventory_product_id TEXT,
    
    -- 抽奖设置
    total_tickets INTEGER NOT NULL,
    sold_tickets INTEGER DEFAULT 0,
    
    -- 状态
    status TEXT DEFAULT 'ACTIVE',
    
    -- 开奖时间
    draw_time TIMESTAMP WITH TIME ZONE,
    drawn_at TIMESTAMP WITH TIME ZONE,
    
    -- 排序和展示
    sort_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lotteries_status ON lotteries(status);
CREATE INDEX IF NOT EXISTS idx_lotteries_draw_time ON lotteries(draw_time);
CREATE INDEX IF NOT EXISTS idx_lotteries_inventory_product_id ON lotteries(inventory_product_id);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lottery_id TEXT NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    total_amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'TJS',
    status TEXT DEFAULT 'COMPLETED',
    payment_method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_lottery_id ON orders(lottery_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 中奖记录表
CREATE TABLE IF NOT EXISTS prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lottery_id TEXT NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
    ticket_id UUID,
    
    -- 奖品信息
    prize_name TEXT NOT NULL,
    prize_image TEXT,
    prize_value DECIMAL(10,2) DEFAULT 0,
    winning_code TEXT NOT NULL,
    
    -- 状态
    status TEXT DEFAULT 'WON',
    
    -- 物流状态（批次管理）
    batch_id UUID,
    logistics_status TEXT DEFAULT 'PENDING_SHIPMENT',
    
    -- 提货信息
    pickup_code TEXT,
    pickup_status TEXT DEFAULT 'PENDING_CLAIM',
    pickup_point_id UUID,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- 时间戳
    won_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    claimed_at TIMESTAMP WITH TIME ZONE,
    picked_up_at TIMESTAMP WITH TIME ZONE,
    picked_up_by UUID,
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- 算法数据
    algorithm_data JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prizes_user_id ON prizes(user_id);
CREATE INDEX IF NOT EXISTS idx_prizes_lottery_id ON prizes(lottery_id);
CREATE INDEX IF NOT EXISTS idx_prizes_status ON prizes(status);
CREATE INDEX IF NOT EXISTS idx_prizes_pickup_code ON prizes(pickup_code);
CREATE INDEX IF NOT EXISTS idx_prizes_batch_id ON prizes(batch_id);
CREATE INDEX IF NOT EXISTS idx_prizes_logistics_status ON prizes(logistics_status);

-- 全款购买订单表
CREATE TABLE IF NOT EXISTS full_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lottery_id TEXT NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
    
    -- 金额
    total_amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'TJS',
    
    -- 状态
    status TEXT DEFAULT 'PENDING',
    
    -- 物流状态（批次管理）
    batch_id UUID,
    logistics_status TEXT DEFAULT 'PENDING_SHIPMENT',
    
    -- 提货信息
    pickup_code TEXT,
    pickup_point_id UUID,
    
    -- 元数据
    metadata JSONB DEFAULT '{}',
    
    -- 时间戳
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_user_id ON full_purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_lottery_id ON full_purchase_orders(lottery_id);
CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_status ON full_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_pickup_code ON full_purchase_orders(pickup_code);
CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_batch_id ON full_purchase_orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_logistics_status ON full_purchase_orders(logistics_status);

-- ============================================
-- 4. 拼团相关表
-- ============================================

-- 拼团商品表
CREATE TABLE IF NOT EXISTS group_buy_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    title_i18n JSONB DEFAULT '{}',
    description TEXT,
    description_i18n JSONB DEFAULT '{}',
    
    -- 图片
    image_url TEXT,
    image_urls TEXT[],
    
    -- 价格
    original_price DECIMAL(10,2) NOT NULL,
    group_price DECIMAL(10,2) NOT NULL,
    
    -- 拼团设置
    min_participants INTEGER DEFAULT 2,
    max_participants INTEGER DEFAULT 100,
    duration_hours INTEGER DEFAULT 24,
    
    -- 库存关联
    inventory_product_id UUID,
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_buy_products_is_active ON group_buy_products(is_active);

-- 拼团场次表
CREATE TABLE IF NOT EXISTS group_buy_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES group_buy_products(id) ON DELETE CASCADE,
    
    -- 状态
    status TEXT DEFAULT 'OPEN',
    
    -- 参与人数
    current_participants INTEGER DEFAULT 0,
    
    -- 时间
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    drawn_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_buy_sessions_product_id ON group_buy_sessions(product_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_sessions_status ON group_buy_sessions(status);

-- 拼团订单表
CREATE TABLE IF NOT EXISTS group_buy_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES group_buy_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 金额
    amount DECIMAL(10,2) NOT NULL,
    
    -- 状态
    status TEXT DEFAULT 'PAID',
    
    -- 时间戳
    timestamp_ms BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_buy_orders_session_id ON group_buy_orders(session_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_orders_user_id ON group_buy_orders(user_id);

-- 拼团开奖结果表
CREATE TABLE IF NOT EXISTS group_buy_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID UNIQUE NOT NULL REFERENCES group_buy_sessions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES group_buy_products(id) ON DELETE CASCADE,
    
    -- 中奖信息
    winner_id TEXT NOT NULL,
    winner_order_id UUID NOT NULL REFERENCES group_buy_orders(id),
    winning_index INTEGER NOT NULL,
    
    -- 算法数据
    timestamp_sum BIGINT NOT NULL,
    total_participants INTEGER NOT NULL,
    algorithm_data JSONB,
    
    -- 物流状态（批次管理）
    batch_id UUID,
    logistics_status TEXT DEFAULT 'PENDING_SHIPMENT',
    
    -- 提货信息
    pickup_code TEXT,
    pickup_status TEXT DEFAULT 'PENDING_CLAIM',
    pickup_point_id UUID,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- 发货信息
    shipping_status TEXT,
    shipping_info JSONB,
    
    -- 时间戳
    claimed_at TIMESTAMP WITH TIME ZONE,
    picked_up_at TIMESTAMP WITH TIME ZONE,
    picked_up_by UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_buy_results_session_id ON group_buy_results(session_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_results_product_id ON group_buy_results(product_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_results_winner_id ON group_buy_results(winner_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_results_pickup_code ON group_buy_results(pickup_code);
CREATE INDEX IF NOT EXISTS idx_group_buy_results_batch_id ON group_buy_results(batch_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_results_logistics_status ON group_buy_results(logistics_status);

-- ============================================
-- 5. 自提点和提货相关表
-- ============================================

-- 自提点表
CREATE TABLE IF NOT EXISTS pickup_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_i18n JSONB DEFAULT '{}',
    address TEXT NOT NULL,
    address_i18n JSONB DEFAULT '{}',
    
    -- 联系信息
    contact_phone TEXT,
    contact_name TEXT,
    
    -- 位置
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    
    -- 营业时间
    business_hours JSONB,
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    
    -- 排序
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_points_is_active ON pickup_points(is_active);
CREATE INDEX IF NOT EXISTS idx_pickup_points_is_default ON pickup_points(is_default);

-- 提货日志表
CREATE TABLE IF NOT EXISTS pickup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prize_id UUID,
    pickup_code TEXT,
    pickup_point_id UUID REFERENCES pickup_points(id),
    operator_id UUID,
    operation_type TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_logs_prize_id ON pickup_logs(prize_id);
CREATE INDEX IF NOT EXISTS idx_pickup_logs_pickup_code ON pickup_logs(pickup_code);
CREATE INDEX IF NOT EXISTS idx_pickup_logs_created_at ON pickup_logs(created_at DESC);

-- ============================================
-- 6. 批次管理相关表
-- ============================================

-- 发货批次表
CREATE TABLE IF NOT EXISTS shipment_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 批次基本信息
    batch_no TEXT UNIQUE NOT NULL,
    china_tracking_no TEXT,
    tajikistan_tracking_no TEXT,
    
    -- 批次状态
    status TEXT NOT NULL DEFAULT 'IN_TRANSIT_CHINA' CHECK (status IN (
        'IN_TRANSIT_CHINA',
        'IN_TRANSIT_TAJIKISTAN',
        'ARRIVED',
        'CANCELLED'
    )),
    
    -- 时间信息
    shipped_at TIMESTAMP WITH TIME ZONE NOT NULL,
    estimated_arrival_date DATE,
    arrived_at TIMESTAMP WITH TIME ZONE,
    
    -- 到货确认信息
    arrival_photos TEXT[] DEFAULT '{}',
    arrival_notes TEXT,
    confirmed_by UUID,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    
    -- 统计信息
    total_orders INTEGER DEFAULT 0,
    normal_orders INTEGER DEFAULT 0,
    missing_orders INTEGER DEFAULT 0,
    damaged_orders INTEGER DEFAULT 0,
    
    -- 备注和元数据
    admin_note TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- 创建信息
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_batches_status ON shipment_batches(status);
CREATE INDEX IF NOT EXISTS idx_shipment_batches_batch_no ON shipment_batches(batch_no);
CREATE INDEX IF NOT EXISTS idx_shipment_batches_shipped_at ON shipment_batches(shipped_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_batches_created_at ON shipment_batches(created_at DESC);

-- 批次订单关联表
CREATE TABLE IF NOT EXISTS batch_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 批次关联
    batch_id UUID NOT NULL REFERENCES shipment_batches(id) ON DELETE CASCADE,
    
    -- 订单关联
    order_type TEXT NOT NULL CHECK (order_type IN (
        'FULL_PURCHASE',
        'LOTTERY_PRIZE',
        'GROUP_BUY'
    )),
    order_id UUID NOT NULL,
    
    -- 商品信息
    product_name TEXT,
    product_name_i18n JSONB DEFAULT '{}',
    product_sku TEXT,
    product_image TEXT,
    quantity INTEGER DEFAULT 1,
    
    -- 用户信息
    user_id TEXT,
    user_telegram_id BIGINT,
    user_name TEXT,
    
    -- 到货状态
    arrival_status TEXT DEFAULT 'PENDING' CHECK (arrival_status IN (
        'PENDING',
        'NORMAL',
        'MISSING',
        'DAMAGED'
    )),
    arrival_notes TEXT,
    
    -- 提货码
    pickup_code TEXT,
    pickup_code_generated_at TIMESTAMP WITH TIME ZONE,
    pickup_code_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- 通知状态
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- 时间戳
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_order_items_unique_order ON batch_order_items(order_type, order_id);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_batch_id ON batch_order_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_order_type ON batch_order_items(order_type);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_product_sku ON batch_order_items(product_sku);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_arrival_status ON batch_order_items(arrival_status);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_user_id ON batch_order_items(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_pickup_code ON batch_order_items(pickup_code);

-- 添加外键约束
ALTER TABLE prizes ADD CONSTRAINT fk_prizes_batch_id 
    FOREIGN KEY (batch_id) REFERENCES shipment_batches(id) ON DELETE SET NULL;
ALTER TABLE prizes ADD CONSTRAINT fk_prizes_pickup_point 
    FOREIGN KEY (pickup_point_id) REFERENCES pickup_points(id) ON DELETE SET NULL;

ALTER TABLE full_purchase_orders ADD CONSTRAINT fk_full_purchase_orders_batch_id 
    FOREIGN KEY (batch_id) REFERENCES shipment_batches(id) ON DELETE SET NULL;
ALTER TABLE full_purchase_orders ADD CONSTRAINT fk_full_purchase_orders_pickup_point 
    FOREIGN KEY (pickup_point_id) REFERENCES pickup_points(id) ON DELETE SET NULL;

ALTER TABLE group_buy_results ADD CONSTRAINT fk_group_buy_results_batch_id 
    FOREIGN KEY (batch_id) REFERENCES shipment_batches(id) ON DELETE SET NULL;
ALTER TABLE group_buy_results ADD CONSTRAINT fk_group_buy_results_pickup_point 
    FOREIGN KEY (pickup_point_id) REFERENCES pickup_points(id) ON DELETE SET NULL;

-- ============================================
-- 7. 其他业务表
-- ============================================

-- 横幅/Banner表
CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    image_url_zh TEXT,
    image_url_ru TEXT,
    image_url_tg TEXT,
    link_type TEXT,
    link_url TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 晒单表
CREATE TABLE IF NOT EXISTS showoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lottery_id TEXT REFERENCES lotteries(id),
    content TEXT,
    images TEXT[],
    status TEXT DEFAULT 'PENDING',
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_showoffs_user_id ON showoffs(user_id);
CREATE INDEX IF NOT EXISTS idx_showoffs_status ON showoffs(status);

-- 充值记录表
CREATE TABLE IF NOT EXISTS deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'TJS',
    status TEXT DEFAULT 'PENDING',
    payment_method TEXT,
    payment_proof_url TEXT,
    payer_name TEXT,
    payer_phone TEXT,
    payer_account TEXT,
    notes TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    admin_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- 提现记录表
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'TJS',
    bank_name TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    account_number TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    transaction_id TEXT,
    notes TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    admin_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- 支付配置表
CREATE TABLE IF NOT EXISTS payment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT,
    config_type TEXT DEFAULT 'DEPOSIT',
    currency TEXT DEFAULT 'TJS',
    config JSONB DEFAULT '{}',
    account_info JSONB,
    qr_code_url TEXT,
    instructions TEXT,
    instructions_i18n JSONB,
    min_amount DECIMAL(10,2) DEFAULT 10.00,
    max_amount DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    is_enabled BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    icon_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 佣金记录表
CREATE TABLE IF NOT EXISTS commission_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_user_id TEXT REFERENCES users(id),
    order_id TEXT,
    order_type TEXT,
    amount DECIMAL(10,2) NOT NULL,
    rate DECIMAL(5,4),
    level INTEGER DEFAULT 1,
    status TEXT DEFAULT 'PENDING',
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_records_user_id ON commission_records(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_status ON commission_records(status);

-- 转盘相关表
CREATE TABLE IF NOT EXISTS spin_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reward_name TEXT NOT NULL,
    reward_name_i18n JSONB,
    reward_type TEXT NOT NULL DEFAULT 'LUCKY_COIN',
    reward_amount DECIMAL(10,2) DEFAULT 0,
    probability DECIMAL(10,5) NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_jackpot BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_spin_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    spin_count INTEGER DEFAULT 0,
    total_spins_used INTEGER DEFAULT 0,
    last_spin_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spin_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    reward_id UUID,
    reward_name TEXT,
    reward_type TEXT,
    reward_amount DECIMAL(10,2),
    is_winner BOOLEAN DEFAULT false,
    spin_source TEXT DEFAULT 'user_spin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spin_records_user_id ON spin_records(user_id);
CREATE INDEX IF NOT EXISTS idx_spin_records_created_at ON spin_records(created_at);

-- ============================================
-- 8. 辅助函数
-- ============================================

-- 更新updated_at触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 生成批次号函数
CREATE OR REPLACE FUNCTION generate_batch_no()
RETURNS TEXT AS $$
DECLARE
    today_date TEXT;
    seq_num INTEGER;
    new_batch_no TEXT;
BEGIN
    today_date := TO_CHAR(NOW(), 'YYYYMMDD');
    
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

-- 更新批次统计函数
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

-- 批次统计触发器函数
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

-- ============================================
-- 9. 创建触发器
-- ============================================

-- shipment_batches updated_at 触发器
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

-- batch_order_items updated_at 触发器
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

-- 批次统计触发器
DROP TRIGGER IF EXISTS trigger_batch_order_items_statistics ON batch_order_items;
CREATE TRIGGER trigger_batch_order_items_statistics
    AFTER INSERT OR UPDATE OR DELETE ON batch_order_items
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_batch_statistics();

-- ============================================
-- 10. 创建视图
-- ============================================

-- 批次统计视图
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

-- SKU统计视图
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

-- ============================================
-- 11. 启用RLS
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE full_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_buy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_buy_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_order_items ENABLE ROW LEVEL SECURITY;

-- 创建基本的RLS策略
CREATE POLICY "Allow public read access to shipment_batches" ON shipment_batches
    FOR SELECT USING (true);

CREATE POLICY "Allow service role to manage shipment_batches" ON shipment_batches
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow users to read own batch_order_items" ON batch_order_items
    FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR true);

CREATE POLICY "Allow service role to manage batch_order_items" ON batch_order_items
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 12. 添加注释
-- ============================================

COMMENT ON TABLE shipment_batches IS '发货批次表 - 管理从中国到塔吉克斯坦的物流批次';
COMMENT ON COLUMN shipment_batches.batch_no IS '批次号，格式如 BATCH-20260108-01';
COMMENT ON COLUMN shipment_batches.status IS '批次状态：IN_TRANSIT_CHINA(中国段运输中), IN_TRANSIT_TAJIKISTAN(塔国段运输中), ARRIVED(已到达), CANCELLED(已取消)';

COMMENT ON TABLE batch_order_items IS '批次订单关联表 - 记录批次中的订单明细';
COMMENT ON COLUMN batch_order_items.order_type IS '订单类型：FULL_PURCHASE(全款购买), LOTTERY_PRIZE(一元购物中奖), GROUP_BUY(拼团)';
COMMENT ON COLUMN batch_order_items.arrival_status IS '到货状态：PENDING(待确认), NORMAL(正常), MISSING(缺货), DAMAGED(损坏)';

COMMENT ON VIEW batch_statistics IS '批次统计视图 - 提供批次的汇总统计信息';
COMMENT ON VIEW batch_sku_summary IS 'SKU统计视图 - 按批次和SKU汇总商品数量';
COMMENT ON FUNCTION generate_batch_no() IS '生成批次号，格式：BATCH-YYYYMMDD-NN';
COMMENT ON FUNCTION update_batch_statistics(UUID) IS '更新批次的统计信息';

-- ============================================
-- 完成
-- ============================================
