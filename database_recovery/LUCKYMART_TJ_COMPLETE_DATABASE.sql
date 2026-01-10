-- ============================================
-- LuckyMart-TJ (TezBarakat) 完整数据库恢复脚本
-- 版本: v2.0 (最新最全面版本)
-- 创建时间: 2026-01-10
-- 来源: GitHub 代码仓库 + 恢复数据库整合
-- 目的: 从零开始恢复整个 Supabase 数据库
-- ============================================

-- 重要说明:
-- 1. 此脚本整合了所有 GitHub 代码中的迁移文件
-- 2. 包含 20260109_fix_prizes_pickup_fields.sql (恢复数据库中缺失)
-- 3. 按正确的依赖顺序排列
-- 4. 可直接在 Supabase SQL Editor 中执行

-- ============================================
-- 第一部分: 启用必要的扩展
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ============================================
-- 第二部分: 创建枚举类型
-- ============================================

-- 钱包类型枚举
DO $$ BEGIN
    CREATE TYPE "WalletType" AS ENUM ('TJS', 'LUCKY_COIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 交易类型枚举
DO $$ BEGIN
    CREATE TYPE "TransactionType" AS ENUM (
        'DEPOSIT', 
        'WITHDRAWAL', 
        'PURCHASE', 
        'REFUND', 
        'COMMISSION', 
        'EXCHANGE', 
        'REWARD',
        'SPIN_REWARD',
        'INVITE_REWARD'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 佣金状态枚举
DO $$ BEGIN
    CREATE TYPE "CommissionStatus" AS ENUM ('pending', 'paid', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 佣金类型枚举
DO $$ BEGIN
    CREATE TYPE "CommissionType" AS ENUM ('lottery', 'group_buy', 'deposit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 第三部分: 核心用户系统表
-- ============================================

-- 1. users 表 (用户基本信息)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    telegram_id TEXT UNIQUE,
    telegram_username TEXT,
    display_name TEXT,
    first_name TEXT,
    last_name TEXT,
    avatar TEXT,
    avatar_url TEXT,
    language_code TEXT DEFAULT 'ru',
    phone TEXT,
    email TEXT,
    
    -- 余额信息 (冗余存储，便于快速查询)
    balance DECIMAL(10,2) DEFAULT 0 NOT NULL,
    lucky_coins DECIMAL(10,2) DEFAULT 0 NOT NULL,
    commission_balance DECIMAL(10,2) DEFAULT 0 NOT NULL,
    bonus_balance DECIMAL(10,2) DEFAULT 0 NOT NULL,
    
    -- VIP和邀请
    vip_level INTEGER DEFAULT 0 NOT NULL,
    invite_code TEXT UNIQUE,
    invited_by TEXT,
    referrer_id TEXT REFERENCES public.users(id),
    referral_level INTEGER DEFAULT 0,
    
    -- 状态
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    has_completed_onboarding BOOLEAN DEFAULT FALSE,
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON public.users(invite_code);
CREATE INDEX IF NOT EXISTS idx_users_invited_by ON public.users(invited_by);
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON public.users(referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

-- 2. user_profiles 表 (用户详细资料)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    location TEXT,
    timezone TEXT DEFAULT 'Asia/Dushanbe',
    language_code TEXT DEFAULT 'ru',
    
    -- 统计信息
    total_spent DECIMAL(10,2) DEFAULT 0,
    total_won DECIMAL(10,2) DEFAULT 0,
    total_lotteries INTEGER DEFAULT 0,
    
    -- KYC信息
    kyc_level INTEGER DEFAULT 0,
    id_card_number TEXT,
    id_card_name TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_language_code ON public.user_profiles(language_code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_kyc_level ON public.user_profiles(kyc_level);

-- 3. user_sessions 表 (用户会话)
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    device_info JSONB,
    ip_address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- 4. wallets 表 (用户钱包)
CREATE TABLE IF NOT EXISTS public.wallets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type "WalletType" NOT NULL DEFAULT 'TJS',
    currency TEXT DEFAULT 'TJS',
    balance DECIMAL(10,2) DEFAULT 0 NOT NULL,
    is_bonus BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT wallets_user_type_unique UNIQUE (user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_type ON public.wallets(type);

-- 5. wallet_transactions 表 (钱包交易记录)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    wallet_id TEXT NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balance_before DECIMAL(10,2),
    balance_after DECIMAL(10,2),
    description TEXT,
    reference_id TEXT,
    reference_type TEXT,
    status TEXT DEFAULT 'COMPLETED',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON public.wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON public.wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference_id ON public.wallet_transactions(reference_id);

-- ============================================
-- 第四部分: 商品和库存系统
-- ============================================

-- 6. inventory_products 表 (库存商品)
CREATE TABLE IF NOT EXISTS public.inventory_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 基本信息
    name TEXT NOT NULL,
    name_i18n JSONB DEFAULT '{}',
    description TEXT,
    description_i18n JSONB DEFAULT '{}',
    
    -- 图片
    image_url TEXT,
    image_urls TEXT[] DEFAULT '{}',
    
    -- 规格信息
    specifications TEXT,
    specifications_i18n JSONB DEFAULT '{}',
    material TEXT,
    material_i18n JSONB DEFAULT '{}',
    details TEXT,
    details_i18n JSONB DEFAULT '{}',
    
    -- 价格和库存
    original_price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'TJS',
    stock INTEGER NOT NULL DEFAULT 0,
    reserved_stock INTEGER DEFAULT 0,
    
    -- SKU管理
    sku TEXT UNIQUE,
    barcode TEXT,
    
    -- 状态
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK')),
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_products_status ON public.inventory_products(status);
CREATE INDEX IF NOT EXISTS idx_inventory_products_sku ON public.inventory_products(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_products_created_at ON public.inventory_products(created_at DESC);

-- 7. inventory_transactions 表 (库存变动记录)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_product_id UUID NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'FULL_PURCHASE', 'LOTTERY_PRIZE', 'STOCK_IN', 'STOCK_OUT', 
        'ADJUSTMENT', 'RESERVE', 'RELEASE_RESERVE'
    )),
    quantity INTEGER NOT NULL,
    stock_before INTEGER NOT NULL,
    stock_after INTEGER NOT NULL,
    related_order_id UUID,
    related_lottery_id UUID,
    operator_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product_id ON public.inventory_transactions(inventory_product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON public.inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON public.inventory_transactions(created_at DESC);

-- ============================================
-- 第五部分: 抽奖/一元购物系统
-- ============================================

-- 8. lotteries 表 (抽奖活动/一元购物)
CREATE TABLE IF NOT EXISTS public.lotteries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    period INTEGER UNIQUE,
    
    -- 基本信息
    title TEXT NOT NULL,
    title_i18n JSONB DEFAULT '{}',
    description TEXT,
    description_i18n JSONB DEFAULT '{}',
    
    -- 图片
    image_url TEXT,
    image_urls TEXT[] DEFAULT '{}',
    
    -- 价格设置
    ticket_price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'TJS',
    original_price DECIMAL(10,2),
    
    -- 票数设置
    total_tickets INTEGER NOT NULL,
    sold_tickets INTEGER DEFAULT 0 NOT NULL,
    max_per_user INTEGER,
    
    -- 状态
    status TEXT NOT NULL DEFAULT 'UPCOMING',
    
    -- 时间设置
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    draw_time TIMESTAMPTZ,
    actual_draw_time TIMESTAMPTZ,
    
    -- 开奖结果
    winning_numbers TEXT[],
    winning_ticket_number INTEGER,
    winning_user_id UUID,
    vrf_proof TEXT,
    vrf_timestamp BIGINT,
    
    -- 关联商品
    product_id UUID,
    inventory_product_id UUID REFERENCES public.inventory_products(id),
    
    -- 全款购买
    full_purchase_enabled BOOLEAN DEFAULT TRUE,
    full_purchase_price DECIMAL(10,2),
    
    -- 比价信息
    price_comparisons JSONB,
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lotteries_status ON public.lotteries(status);
CREATE INDEX IF NOT EXISTS idx_lotteries_period ON public.lotteries(period);
CREATE INDEX IF NOT EXISTS idx_lotteries_draw_time ON public.lotteries(draw_time);
CREATE INDEX IF NOT EXISTS idx_lotteries_created_at ON public.lotteries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lotteries_inventory_product_id ON public.lotteries(inventory_product_id);

-- 9. lottery_entries 表 (抽奖参与记录)
CREATE TABLE IF NOT EXISTS public.lottery_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lottery_id TEXT NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    ticket_number INTEGER NOT NULL,
    participation_code TEXT,
    is_winning BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT lottery_entries_unique UNIQUE (lottery_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_lottery_entries_user_id ON public.lottery_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_lottery_entries_lottery_id ON public.lottery_entries(lottery_id);
CREATE INDEX IF NOT EXISTS idx_lottery_entries_is_winning ON public.lottery_entries(is_winning);

-- 10. tickets 表 (抽奖券记录)
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lottery_id TEXT NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    order_id TEXT,
    ticket_number INTEGER NOT NULL,
    is_winning BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT tickets_unique UNIQUE (lottery_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_lottery_id ON public.tickets(lottery_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_is_winning ON public.tickets(is_winning);

-- 11. lottery_results 表 (开奖结果)
CREATE TABLE IF NOT EXISTS public.lottery_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lottery_id TEXT NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    winner_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    winner_ticket_number INTEGER NOT NULL,
    draw_time TIMESTAMPTZ DEFAULT NOW(),
    algorithm_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT lottery_results_unique UNIQUE (lottery_id)
);

CREATE INDEX IF NOT EXISTS idx_lottery_results_lottery_id ON public.lottery_results(lottery_id);
CREATE INDEX IF NOT EXISTS idx_lottery_results_winner_id ON public.lottery_results(winner_id);
CREATE INDEX IF NOT EXISTS idx_lottery_results_draw_time ON public.lottery_results(draw_time);


-- ============================================
-- 第六部分: 自提点系统
-- ============================================

-- 12. pickup_points 表 (自提点)
CREATE TABLE IF NOT EXISTS public.pickup_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_i18n JSONB DEFAULT '{}',
    address TEXT NOT NULL,
    address_i18n JSONB DEFAULT '{}',
    city TEXT,
    region TEXT,
    phone TEXT,
    working_hours TEXT,
    working_hours_i18n JSONB DEFAULT '{}',
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_points_is_active ON public.pickup_points(is_active);
CREATE INDEX IF NOT EXISTS idx_pickup_points_city ON public.pickup_points(city);

-- ============================================
-- 第七部分: 中奖和奖品系统
-- ============================================

-- 13. prizes 表 (中奖记录)
CREATE TABLE IF NOT EXISTS public.prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lottery_id TEXT NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES public.lottery_entries(id) ON DELETE SET NULL,
    
    -- 奖品信息
    winning_code VARCHAR(50) NOT NULL,
    prize_name VARCHAR(255) NOT NULL,
    prize_name_i18n JSONB DEFAULT '{}',
    prize_image TEXT,
    prize_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    
    -- 提货信息 (来自 20260109_fix_prizes_pickup_fields.sql)
    pickup_code VARCHAR(20),
    pickup_status VARCHAR(30) DEFAULT 'PENDING_CLAIM',
    pickup_point_id UUID REFERENCES public.pickup_points(id),
    expires_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    
    -- 物流信息 (来自 20260109_add_shipment_batch_management.sql)
    batch_id UUID,
    logistics_status VARCHAR(30) DEFAULT 'PENDING_SHIPMENT',
    
    -- 时间戳
    won_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_prizes_user_id ON public.prizes(user_id);
CREATE INDEX IF NOT EXISTS idx_prizes_lottery_id ON public.prizes(lottery_id);
CREATE INDEX IF NOT EXISTS idx_prizes_status ON public.prizes(status);
CREATE INDEX IF NOT EXISTS idx_prizes_won_at ON public.prizes(won_at DESC);
CREATE INDEX IF NOT EXISTS idx_prizes_pickup_code ON public.prizes(pickup_code);
CREATE INDEX IF NOT EXISTS idx_prizes_pickup_status ON public.prizes(pickup_status);
CREATE INDEX IF NOT EXISTS idx_prizes_pickup_point_id ON public.prizes(pickup_point_id);
CREATE INDEX IF NOT EXISTS idx_prizes_expires_at ON public.prizes(expires_at);
CREATE INDEX IF NOT EXISTS idx_prizes_batch_id ON public.prizes(batch_id);
CREATE INDEX IF NOT EXISTS idx_prizes_logistics_status ON public.prizes(logistics_status);

-- 添加约束
ALTER TABLE public.prizes DROP CONSTRAINT IF EXISTS prizes_pickup_status_check;
ALTER TABLE public.prizes ADD CONSTRAINT prizes_pickup_status_check CHECK (
    pickup_status IN ('PENDING_CLAIM', 'PENDING_PICKUP', 'PICKED_UP', 'EXPIRED')
);

ALTER TABLE public.prizes DROP CONSTRAINT IF EXISTS prizes_logistics_status_check;
ALTER TABLE public.prizes ADD CONSTRAINT prizes_logistics_status_check CHECK (
    logistics_status IN ('PENDING_SHIPMENT', 'IN_TRANSIT_CHINA', 'IN_TRANSIT_TAJIKISTAN', 'READY_FOR_PICKUP', 'PICKED_UP')
);

-- 创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_prizes_pickup_code_unique ON public.prizes(pickup_code) WHERE pickup_code IS NOT NULL;

-- 添加注释
COMMENT ON COLUMN public.prizes.pickup_code IS '提货码（6位数字）';
COMMENT ON COLUMN public.prizes.pickup_status IS '提货状态: PENDING_CLAIM待领取, PENDING_PICKUP待提货, PICKED_UP已提货, EXPIRED已过期';
COMMENT ON COLUMN public.prizes.pickup_point_id IS '自提点ID';
COMMENT ON COLUMN public.prizes.expires_at IS '提货码过期时间（生成后30天）';
COMMENT ON COLUMN public.prizes.claimed_at IS '用户确认领取时间';
COMMENT ON COLUMN public.prizes.picked_up_at IS '实际提货时间';
COMMENT ON COLUMN public.prizes.batch_id IS '关联的发货批次ID';
COMMENT ON COLUMN public.prizes.logistics_status IS '物流状态';

-- 14. pickup_logs 表 (提货日志)
CREATE TABLE IF NOT EXISTS public.pickup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prize_id UUID REFERENCES public.prizes(id) ON DELETE CASCADE,
    order_id TEXT,
    pickup_point_id UUID REFERENCES public.pickup_points(id),
    action TEXT NOT NULL,
    operator_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_logs_prize_id ON public.pickup_logs(prize_id);
CREATE INDEX IF NOT EXISTS idx_pickup_logs_order_id ON public.pickup_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_pickup_logs_created_at ON public.pickup_logs(created_at DESC);

-- ============================================
-- 第八部分: 订单系统
-- ============================================

-- 15. orders 表 (订单主表)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    order_number TEXT UNIQUE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- 订单类型
    type TEXT NOT NULL,
    
    -- 关联信息
    lottery_id TEXT REFERENCES public.lotteries(id),
    
    -- 金额信息
    total_amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'TJS',
    ticket_count INTEGER,
    quantity INTEGER,
    
    -- 支付信息
    payment_method TEXT,
    
    -- 状态
    status TEXT NOT NULL DEFAULT 'PENDING',
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_lottery_id ON public.orders(lottery_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_type ON public.orders(type);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

-- 16. full_purchase_orders 表 (全款购买订单)
CREATE TABLE IF NOT EXISTS public.full_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lottery_id TEXT NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    
    -- 订单信息
    order_number TEXT UNIQUE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'TJS',
    
    -- 提货信息
    pickup_code VARCHAR(20),
    pickup_point_id UUID REFERENCES public.pickup_points(id),
    pickup_status VARCHAR(30) DEFAULT 'PENDING',
    
    -- 物流信息
    batch_id UUID,
    logistics_status VARCHAR(30) DEFAULT 'PENDING_SHIPMENT',
    
    -- 状态
    status VARCHAR(30) DEFAULT 'PENDING',
    
    -- 元数据
    metadata JSONB DEFAULT '{}',
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_user_id ON public.full_purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_lottery_id ON public.full_purchase_orders(lottery_id);
CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_status ON public.full_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_pickup_code ON public.full_purchase_orders(pickup_code);
CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_batch_id ON public.full_purchase_orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_full_purchase_orders_logistics_status ON public.full_purchase_orders(logistics_status);

-- 添加约束
ALTER TABLE public.full_purchase_orders DROP CONSTRAINT IF EXISTS full_purchase_orders_logistics_status_check;
ALTER TABLE public.full_purchase_orders ADD CONSTRAINT full_purchase_orders_logistics_status_check CHECK (
    logistics_status IN ('PENDING_SHIPMENT', 'IN_TRANSIT_CHINA', 'IN_TRANSIT_TAJIKISTAN', 'READY_FOR_PICKUP', 'PICKED_UP')
);

COMMENT ON COLUMN public.full_purchase_orders.batch_id IS '关联的发货批次ID';
COMMENT ON COLUMN public.full_purchase_orders.logistics_status IS '物流状态';

-- ============================================
-- 第九部分: 拼团系统
-- ============================================

-- 17. group_buy_products 表 (拼团商品)
CREATE TABLE IF NOT EXISTS public.group_buy_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_i18n JSONB DEFAULT '{}',
    description TEXT,
    description_i18n JSONB DEFAULT '{}',
    image_url TEXT,
    image_urls TEXT[] DEFAULT '{}',
    original_price DECIMAL(10,2) NOT NULL,
    group_price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'TJS',
    min_participants INTEGER DEFAULT 2,
    max_participants INTEGER,
    duration_hours INTEGER DEFAULT 24,
    stock INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE',
    price_comparisons JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_buy_products_status ON public.group_buy_products(status);

-- 18. group_buy_sessions 表 (拼团会话)
CREATE TABLE IF NOT EXISTS public.group_buy_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.group_buy_products(id) ON DELETE CASCADE,
    initiator_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    current_participants INTEGER DEFAULT 1,
    required_participants INTEGER NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_buy_sessions_product_id ON public.group_buy_sessions(product_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_sessions_status ON public.group_buy_sessions(status);
CREATE INDEX IF NOT EXISTS idx_group_buy_sessions_expires_at ON public.group_buy_sessions(expires_at);

-- 19. group_buy_orders 表 (拼团订单)
CREATE TABLE IF NOT EXISTS public.group_buy_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.group_buy_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_buy_orders_session_id ON public.group_buy_orders(session_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_orders_user_id ON public.group_buy_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_orders_status ON public.group_buy_orders(status);

-- 20. group_buy_results 表 (拼团结果)
CREATE TABLE IF NOT EXISTS public.group_buy_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.group_buy_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.group_buy_products(id),
    
    -- 物流信息
    batch_id UUID,
    logistics_status VARCHAR(30) DEFAULT 'PENDING_SHIPMENT',
    
    -- 提货信息
    pickup_code VARCHAR(20),
    pickup_point_id UUID REFERENCES public.pickup_points(id),
    
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_buy_results_session_id ON public.group_buy_results(session_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_results_user_id ON public.group_buy_results(user_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_results_batch_id ON public.group_buy_results(batch_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_results_logistics_status ON public.group_buy_results(logistics_status);

-- 添加约束
ALTER TABLE public.group_buy_results DROP CONSTRAINT IF EXISTS group_buy_results_logistics_status_check;
ALTER TABLE public.group_buy_results ADD CONSTRAINT group_buy_results_logistics_status_check CHECK (
    logistics_status IN ('PENDING_SHIPMENT', 'IN_TRANSIT_CHINA', 'IN_TRANSIT_TAJIKISTAN', 'READY_FOR_PICKUP', 'PICKED_UP')
);

COMMENT ON COLUMN public.group_buy_results.batch_id IS '关联的发货批次ID';
COMMENT ON COLUMN public.group_buy_results.logistics_status IS '物流状态';


-- ============================================
-- 第十部分: 物流批次管理系统
-- ============================================

-- 21. shipment_batches 表 (发货批次)
CREATE TABLE IF NOT EXISTS public.shipment_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 批次基本信息
    batch_no VARCHAR(50) UNIQUE NOT NULL,
    china_tracking_no VARCHAR(100),
    tajikistan_tracking_no VARCHAR(100),
    
    -- 批次状态
    status VARCHAR(30) NOT NULL DEFAULT 'IN_TRANSIT_CHINA' CHECK (status IN (
        'IN_TRANSIT_CHINA', 'IN_TRANSIT_TAJIKISTAN', 'ARRIVED', 'CANCELLED'
    )),
    
    -- 时间信息
    shipped_at TIMESTAMPTZ NOT NULL,
    estimated_arrival_date DATE,
    arrived_at TIMESTAMPTZ,
    
    -- 到货确认信息
    arrival_photos TEXT[] DEFAULT '{}',
    arrival_notes TEXT,
    confirmed_by UUID,
    confirmed_at TIMESTAMPTZ,
    
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_batches_status ON public.shipment_batches(status);
CREATE INDEX IF NOT EXISTS idx_shipment_batches_batch_no ON public.shipment_batches(batch_no);
CREATE INDEX IF NOT EXISTS idx_shipment_batches_shipped_at ON public.shipment_batches(shipped_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_batches_created_at ON public.shipment_batches(created_at DESC);

COMMENT ON TABLE public.shipment_batches IS '发货批次表 - 管理从中国到塔吉克斯坦的物流批次';

-- 22. batch_order_items 表 (批次订单关联)
CREATE TABLE IF NOT EXISTS public.batch_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 批次关联
    batch_id UUID NOT NULL REFERENCES public.shipment_batches(id) ON DELETE CASCADE,
    
    -- 订单关联
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN (
        'FULL_PURCHASE', 'LOTTERY_PRIZE', 'GROUP_BUY'
    )),
    order_id UUID NOT NULL,
    
    -- 商品信息
    product_name TEXT,
    product_name_i18n JSONB DEFAULT '{}',
    product_sku VARCHAR(100),
    product_image TEXT,
    quantity INTEGER DEFAULT 1,
    
    -- 用户信息
    user_id UUID,
    user_telegram_id BIGINT,
    user_name TEXT,
    
    -- 到货状态
    arrival_status VARCHAR(20) DEFAULT 'PENDING' CHECK (arrival_status IN (
        'PENDING', 'NORMAL', 'MISSING', 'DAMAGED'
    )),
    arrival_notes TEXT,
    
    -- 提货码
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_order_items_unique_order ON public.batch_order_items(order_type, order_id);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_batch_id ON public.batch_order_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_order_type ON public.batch_order_items(order_type);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_product_sku ON public.batch_order_items(product_sku);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_arrival_status ON public.batch_order_items(arrival_status);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_user_id ON public.batch_order_items(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_order_items_pickup_code ON public.batch_order_items(pickup_code);

COMMENT ON TABLE public.batch_order_items IS '批次订单关联表 - 记录批次中的订单明细';

-- 添加外键关联到 shipment_batches
ALTER TABLE public.full_purchase_orders 
    ADD CONSTRAINT fk_full_purchase_orders_batch_id 
    FOREIGN KEY (batch_id) REFERENCES public.shipment_batches(id) ON DELETE SET NULL;

ALTER TABLE public.prizes 
    ADD CONSTRAINT fk_prizes_batch_id 
    FOREIGN KEY (batch_id) REFERENCES public.shipment_batches(id) ON DELETE SET NULL;

ALTER TABLE public.group_buy_results 
    ADD CONSTRAINT fk_group_buy_results_batch_id 
    FOREIGN KEY (batch_id) REFERENCES public.shipment_batches(id) ON DELETE SET NULL;

-- ============================================
-- 第十一部分: 发货和物流系统
-- ============================================

-- 23. shipping 表 (发货信息)
CREATE TABLE IF NOT EXISTS public.shipping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prize_id UUID NOT NULL REFERENCES public.prizes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
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
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    
    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    
    -- 时间记录
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- 备注
    notes TEXT,
    admin_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_prize_id ON public.shipping(prize_id);
CREATE INDEX IF NOT EXISTS idx_shipping_user_id ON public.shipping(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_status ON public.shipping(status);
CREATE INDEX IF NOT EXISTS idx_shipping_requested_at ON public.shipping(requested_at DESC);

-- 24. shipping_requests 表 (发货请求)
CREATE TABLE IF NOT EXISTS public.shipping_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lottery_id TEXT NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    order_id TEXT,
    
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    recipient_city TEXT,
    recipient_region TEXT,
    recipient_postal_code TEXT,
    recipient_country TEXT DEFAULT 'Tajikistan',
    
    status TEXT DEFAULT 'pending',
    
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    admin_note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_requests_user_id ON public.shipping_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_requests_lottery_id ON public.shipping_requests(lottery_id);
CREATE INDEX IF NOT EXISTS idx_shipping_requests_status ON public.shipping_requests(status);

-- 25. shipping_records 表 (物流记录)
CREATE TABLE IF NOT EXISTS public.shipping_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prize_id UUID REFERENCES public.prizes(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES public.users(id),
    recipient_name VARCHAR(100) NOT NULL,
    recipient_phone VARCHAR(50) NOT NULL,
    shipping_address TEXT NOT NULL,
    tracking_number VARCHAR(100),
    shipping_company VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_records_prize_id ON public.shipping_records(prize_id);
CREATE INDEX IF NOT EXISTS idx_shipping_records_user_id ON public.shipping_records(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_records_status ON public.shipping_records(status);

-- 26. shipping_history 表 (物流历史)
CREATE TABLE IF NOT EXISTS public.shipping_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipping_id UUID REFERENCES public.shipping(id) ON DELETE CASCADE,
    shipping_request_id UUID REFERENCES public.shipping_requests(id) ON DELETE CASCADE,
    shipping_record_id UUID REFERENCES public.shipping_records(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    location VARCHAR(255),
    description TEXT,
    operator_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_history_shipping_id ON public.shipping_history(shipping_id);
CREATE INDEX IF NOT EXISTS idx_shipping_history_request_id ON public.shipping_history(shipping_request_id);
CREATE INDEX IF NOT EXISTS idx_shipping_history_record_id ON public.shipping_history(shipping_record_id);

-- 27. shipping_addresses 表 (收货地址)
CREATE TABLE IF NOT EXISTS public.shipping_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT,
    region TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'Tajikistan',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_addresses_user_id ON public.shipping_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_addresses_is_default ON public.shipping_addresses(is_default);

-- ============================================
-- 第十二部分: 金融系统
-- ============================================

-- 28. deposit_requests 表 (充值申请)
CREATE TABLE IF NOT EXISTS public.deposit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    order_number TEXT UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'TJS',
    payment_method TEXT NOT NULL,
    payment_proof_images TEXT[] DEFAULT '{}',
    payment_proof_url TEXT,
    payment_reference TEXT,
    payer_name VARCHAR(100),
    payer_account VARCHAR(100),
    status TEXT DEFAULT 'PENDING',
    admin_note TEXT,
    processed_by TEXT,
    processed_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON public.deposit_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON public.deposit_requests(status);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_created_at ON public.deposit_requests(created_at DESC);

-- 29. deposits 表 (充值记录)
CREATE TABLE IF NOT EXISTS public.deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TJS',
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    payment_method VARCHAR(50),
    payment_proof_url TEXT,
    payer_name VARCHAR(100),
    payer_phone VARCHAR(20),
    payer_account VARCHAR(100),
    notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON public.deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON public.deposits(created_at DESC);

-- 30. withdrawal_requests 表 (提现申请)
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'TJS',
    withdrawal_address TEXT NOT NULL,
    bank_name VARCHAR(100),
    account_holder VARCHAR(100),
    account_number VARCHAR(100),
    status TEXT DEFAULT 'PENDING',
    transaction_hash TEXT,
    transaction_id VARCHAR(100),
    admin_note TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON public.withdrawal_requests(created_at DESC);

-- 31. withdrawals 表 (提现记录)
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TJS',
    bank_name VARCHAR(100) NOT NULL,
    account_holder VARCHAR(100) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED')),
    transaction_id VARCHAR(100),
    notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON public.withdrawals(created_at DESC);

-- 32. transactions 表 (通用交易记录)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'TJS',
    status TEXT DEFAULT 'pending',
    related_id TEXT,
    related_type TEXT,
    balance_before DECIMAL(10,2),
    balance_after DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- 33. payment_config 表 (支付配置)
CREATE TABLE IF NOT EXISTS public.payment_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT UNIQUE NOT NULL,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 34. payment_methods 表 (支付方式)
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    bank_name_i18n JSONB NOT NULL DEFAULT '{"zh": "", "ru": "", "tg": ""}',
    branch_name_i18n JSONB DEFAULT '{"zh": "", "ru": "", "tg": ""}',
    transfer_note_i18n JSONB DEFAULT '{"zh": "", "ru": "", "tg": ""}',
    account_name VARCHAR(100),
    account_number VARCHAR(100),
    bank_code VARCHAR(20),
    processing_time_minutes INTEGER DEFAULT 30,
    min_amount DECIMAL(10,2) DEFAULT 0,
    max_amount DECIMAL(10,2) DEFAULT 999999.99,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON public.payment_methods(type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_active ON public.payment_methods(is_active);

-- 35. payment_configs 表 (支付配置扩展)
CREATE TABLE IF NOT EXISTS public.payment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('BANK_TRANSFER', 'MOBILE_MONEY', 'CRYPTO', 'OTHER')),
    currency VARCHAR(3) DEFAULT 'TJS',
    config JSONB NOT NULL DEFAULT '{}',
    instructions JSONB,
    min_amount DECIMAL(10,2) DEFAULT 10.00,
    max_amount DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    icon_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_configs_active ON public.payment_configs(is_active) WHERE is_active = TRUE;


-- ============================================
-- 第十三部分: 推荐和佣金系统
-- ============================================

-- 36. referrals 表 (邀请关系)
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id TEXT NOT NULL REFERENCES public.users(id),
    referred_id TEXT NOT NULL REFERENCES public.users(id),
    level INTEGER CHECK (level BETWEEN 1 AND 3),
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_referral ON public.referrals(referred_id, level);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals(referred_id);

-- 37. commissions 表 (佣金流水)
CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id),
    from_user_id TEXT NOT NULL REFERENCES public.users(id),
    beneficiary_id TEXT REFERENCES public.users(id),
    source_user_id TEXT REFERENCES public.users(id),
    order_id TEXT,
    related_order_id TEXT,
    related_lottery_id TEXT,
    amount DECIMAL(10,2) NOT NULL,
    source_amount DECIMAL(10,2),
    rate DECIMAL(5,4),
    percent DECIMAL(5,2),
    level INTEGER NOT NULL,
    type TEXT,
    status TEXT DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON public.commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_beneficiary ON public.commissions(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON public.commissions(created_at DESC);

-- 38. commission_settings 表 (佣金配置)
CREATE TABLE IF NOT EXISTS public.commission_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level INTEGER UNIQUE CHECK (level >= 1 AND level <= 3),
    rate DECIMAL(5,4) NOT NULL CHECK (rate >= 0 AND rate <= 1),
    percent DECIMAL(5,2),
    description_i18n JSONB DEFAULT '{"zh": "", "ru": "", "tg": ""}',
    trigger_condition VARCHAR(50) DEFAULT 'any_purchase',
    min_payout_amount DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_settings_level ON public.commission_settings(level);
CREATE INDEX IF NOT EXISTS idx_commission_settings_is_active ON public.commission_settings(is_active);

-- 39. commission_withdrawals 表 (佣金提现)
CREATE TABLE IF NOT EXISTS public.commission_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id),
    amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'PENDING',
    bank_name VARCHAR(100),
    account_number VARCHAR(100),
    account_holder VARCHAR(100),
    admin_note TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_user_id ON public.commission_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_withdrawals_status ON public.commission_withdrawals(status);

-- ============================================
-- 第十四部分: 转盘抽奖系统
-- ============================================

-- 40. user_spin_balance 表 (用户抽奖次数)
CREATE TABLE IF NOT EXISTS public.user_spin_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    spin_count INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    total_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_spin_balance_user_id ON public.user_spin_balance(user_id);

-- 41. spin_rewards 表 (转盘奖池配置)
CREATE TABLE IF NOT EXISTS public.spin_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reward_name VARCHAR(100) NOT NULL,
    reward_name_i18n JSONB,
    reward_type VARCHAR(50) NOT NULL DEFAULT 'LUCKY_COIN',
    reward_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    probability DECIMAL(8,5) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_jackpot BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spin_rewards_active ON public.spin_rewards(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_spin_rewards_order ON public.spin_rewards(display_order);

-- 42. spin_records 表 (抽奖记录)
CREATE TABLE IF NOT EXISTS public.spin_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    reward_id UUID REFERENCES public.spin_rewards(id),
    reward_name VARCHAR(100),
    reward_type VARCHAR(50),
    reward_amount DECIMAL(10,2) DEFAULT 0,
    is_winner BOOLEAN DEFAULT FALSE,
    spin_source VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spin_records_user_id ON public.spin_records(user_id);
CREATE INDEX IF NOT EXISTS idx_spin_records_created_at ON public.spin_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spin_records_is_winner ON public.spin_records(is_winner) WHERE is_winner = TRUE;

-- 43. invite_rewards 表 (邀请奖励记录)
CREATE TABLE IF NOT EXISTS public.invite_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id TEXT NOT NULL,
    invitee_id TEXT NOT NULL,
    reward_type VARCHAR(50) NOT NULL,
    spin_count_awarded INTEGER DEFAULT 0,
    lucky_coins_awarded DECIMAL(10,2) DEFAULT 0,
    is_processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(inviter_id, invitee_id, reward_type)
);

CREATE INDEX IF NOT EXISTS idx_invite_rewards_inviter_id ON public.invite_rewards(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invite_rewards_invitee_id ON public.invite_rewards(invitee_id);
CREATE INDEX IF NOT EXISTS idx_invite_rewards_type ON public.invite_rewards(reward_type);

-- ============================================
-- 第十五部分: 社交系统
-- ============================================

-- 44. showoffs 表 (晒单动态)
CREATE TABLE IF NOT EXISTS public.showoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lottery_id TEXT REFERENCES public.lotteries(id),
    prize_id UUID REFERENCES public.prizes(id),
    title TEXT,
    content TEXT NOT NULL,
    image_urls TEXT[] DEFAULT '{}',
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PENDING',
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_showoffs_user_id ON public.showoffs(user_id);
CREATE INDEX IF NOT EXISTS idx_showoffs_lottery_id ON public.showoffs(lottery_id);
CREATE INDEX IF NOT EXISTS idx_showoffs_status ON public.showoffs(status);
CREATE INDEX IF NOT EXISTS idx_showoffs_created_at ON public.showoffs(created_at DESC);

-- 45. showoff_posts 表 (晒单帖子 - 别名)
CREATE TABLE IF NOT EXISTS public.showoff_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lottery_id TEXT REFERENCES public.lotteries(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_urls TEXT[],
    status TEXT NOT NULL DEFAULT 'PENDING',
    reviewer_id TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_showoff_posts_user_id ON public.showoff_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_showoff_posts_status ON public.showoff_posts(status);

-- 46. showoff_comments 表 (晒单评论)
CREATE TABLE IF NOT EXISTS public.showoff_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.showoffs(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.showoff_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_showoff_comments_post_id ON public.showoff_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_showoff_comments_user_id ON public.showoff_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_showoff_comments_parent_id ON public.showoff_comments(parent_id);

-- 47. showoff_likes 表 (晒单点赞)
CREATE TABLE IF NOT EXISTS public.showoff_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.showoffs(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT showoff_likes_unique UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_showoff_likes_post_id ON public.showoff_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_showoff_likes_user_id ON public.showoff_likes(user_id);

-- 48. likes 表 (通用点赞)
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_target ON public.likes(target_type, target_id);

-- 49. notifications 表 (通知消息)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT,
    title_i18n JSONB DEFAULT '{}',
    message TEXT NOT NULL,
    message_i18n JSONB DEFAULT '{}',
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 50. notification_queue 表 (通知队列)
CREATE TABLE IF NOT EXISTS public.notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    channel TEXT DEFAULT 'telegram',
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'PENDING',
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON public.notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON public.notification_queue(user_id);

-- ============================================
-- 第十六部分: 二手市场
-- ============================================

-- 51. resales 表 (二手交易)
CREATE TABLE IF NOT EXISTS public.resales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    buyer_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    lottery_id TEXT NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
    original_price DECIMAL(10,2) NOT NULL,
    resale_price DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'listed',
    listed_at TIMESTAMPTZ DEFAULT NOW(),
    sold_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resales_seller_id ON public.resales(seller_id);
CREATE INDEX IF NOT EXISTS idx_resales_buyer_id ON public.resales(buyer_id);
CREATE INDEX IF NOT EXISTS idx_resales_lottery_id ON public.resales(lottery_id);
CREATE INDEX IF NOT EXISTS idx_resales_status ON public.resales(status);

-- 52. resale_items 表 (二手商品列表)
CREATE TABLE IF NOT EXISTS public.resale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resale_id UUID REFERENCES public.resales(id) ON DELETE CASCADE,
    lottery_id TEXT NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    seller_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    listing_price DECIMAL(10,2) NOT NULL,
    discount_percentage DECIMAL(5,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resale_items_resale_id ON public.resale_items(resale_id);
CREATE INDEX IF NOT EXISTS idx_resale_items_lottery_id ON public.resale_items(lottery_id);
CREATE INDEX IF NOT EXISTS idx_resale_items_seller_id ON public.resale_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_resale_items_is_active ON public.resale_items(is_active);

-- 53. market_listings 表 (市场列表)
CREATE TABLE IF NOT EXISTS public.market_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    prize_id UUID REFERENCES public.prizes(id),
    lottery_id TEXT REFERENCES public.lotteries(id),
    title TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2),
    image_urls TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'ACTIVE',
    buyer_id TEXT REFERENCES public.users(id),
    sold_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_listings_seller_id ON public.market_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_market_listings_status ON public.market_listings(status);


-- ============================================
-- 第十七部分: 系统管理
-- ============================================

-- 54. admin_users 表 (管理员用户)
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    display_name TEXT,
    role TEXT DEFAULT 'admin',
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON public.admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON public.admin_users(is_active);

-- 55. admin_audit_logs 表 (管理员审计日志)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.admin_users(id),
    action TEXT NOT NULL,
    target_table TEXT,
    target_id TEXT,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);

-- 56. audit_logs 表 (审计日志)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    action TEXT NOT NULL,
    target_table TEXT,
    target_id TEXT,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 57. role_permissions 表 (角色权限)
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    permission TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);

-- 58. monitoring_alerts 表 (系统监控警报)
CREATE TABLE IF NOT EXISTS public.monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    source TEXT,
    resource TEXT,
    resource_id TEXT,
    status TEXT DEFAULT 'active',
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_type ON public.monitoring_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_severity ON public.monitoring_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_status ON public.monitoring_alerts(status);

-- 59. system_configs 表 (系统配置)
CREATE TABLE IF NOT EXISTS public.system_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_configs_key ON public.system_configs(key);

-- 60. banners 表 (轮播图)
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    title_i18n JSONB DEFAULT '{}',
    image_url TEXT NOT NULL,
    link_url TEXT,
    link_type TEXT DEFAULT 'none',
    target_id TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_is_active ON public.banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_sort_order ON public.banners(sort_order);

-- 61. draw_algorithms 表 (开奖算法配置)
CREATE TABLE IF NOT EXISTS public.draw_algorithms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name_i18n JSONB NOT NULL DEFAULT '{"zh": "", "ru": "", "tg": ""}',
    description_i18n JSONB DEFAULT '{"zh": "", "ru": "", "tg": ""}',
    formula_i18n JSONB DEFAULT '{"zh": "", "ru": "", "tg": ""}',
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draw_algorithms_name ON public.draw_algorithms(name);
CREATE INDEX IF NOT EXISTS idx_draw_algorithms_is_active ON public.draw_algorithms(is_active);
CREATE INDEX IF NOT EXISTS idx_draw_algorithms_is_default ON public.draw_algorithms(is_default);

-- 62. draw_logs 表 (开奖记录)
CREATE TABLE IF NOT EXISTS public.draw_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lottery_id TEXT NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    algorithm_name VARCHAR(50) NOT NULL,
    input_data JSONB NOT NULL,
    calculation_steps JSONB,
    winning_number INTEGER NOT NULL,
    winner_user_id TEXT REFERENCES public.users(id),
    winner_order_id TEXT,
    vrf_seed TEXT,
    vrf_proof TEXT,
    draw_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draw_logs_lottery_id ON public.draw_logs(lottery_id);
CREATE INDEX IF NOT EXISTS idx_draw_logs_algorithm_name ON public.draw_logs(algorithm_name);
CREATE INDEX IF NOT EXISTS idx_draw_logs_draw_time ON public.draw_logs(draw_time DESC);
CREATE INDEX IF NOT EXISTS idx_draw_logs_winner_user_id ON public.draw_logs(winner_user_id);

-- 63. exchange_records 表 (兑换记录)
CREATE TABLE IF NOT EXISTS public.exchange_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    from_wallet_type TEXT NOT NULL,
    to_wallet_type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    status TEXT DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exchange_records_user_id ON public.exchange_records(user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_records_created_at ON public.exchange_records(created_at DESC);

-- ============================================
-- 第十八部分: Bot 相关表
-- ============================================

-- 64. bot_user_settings 表 (Bot用户设置)
CREATE TABLE IF NOT EXISTS public.bot_user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    language TEXT DEFAULT 'ru',
    timezone TEXT DEFAULT 'Asia/Dushanbe',
    wallet_notifications BOOLEAN DEFAULT TRUE,
    lottery_notifications BOOLEAN DEFAULT TRUE,
    marketing_notifications BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_user_settings_user_id ON public.bot_user_settings(user_id);

-- 65. bot_sessions 表 (Bot会话)
CREATE TABLE IF NOT EXISTS public.bot_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    state TEXT DEFAULT 'idle',
    context JSONB DEFAULT '{}',
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_sessions_user_id ON public.bot_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_chat_id ON public.bot_sessions(chat_id);

-- 66. bot_messages 表 (Bot消息)
CREATE TABLE IF NOT EXISTS public.bot_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    message_id BIGINT,
    direction TEXT NOT NULL,
    content TEXT,
    message_type TEXT DEFAULT 'text',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_messages_user_id ON public.bot_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_chat_id ON public.bot_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_created_at ON public.bot_messages(created_at DESC);

-- 67. bot_command_stats 表 (Bot命令统计)
CREATE TABLE IF NOT EXISTS public.bot_command_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command TEXT NOT NULL,
    user_id TEXT REFERENCES public.users(id),
    success BOOLEAN DEFAULT TRUE,
    execution_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_command_stats_command ON public.bot_command_stats(command);
CREATE INDEX IF NOT EXISTS idx_bot_command_stats_created_at ON public.bot_command_stats(created_at DESC);

-- ============================================
-- 第十九部分: 视图
-- ============================================

-- 批次统计视图
CREATE OR REPLACE VIEW public.batch_statistics AS
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
FROM public.shipment_batches sb
LEFT JOIN public.batch_order_items boi ON boi.batch_id = sb.id
GROUP BY sb.id;

COMMENT ON VIEW public.batch_statistics IS '批次统计视图 - 提供批次的汇总统计信息';

-- SKU统计视图
CREATE OR REPLACE VIEW public.batch_sku_summary AS
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
FROM public.batch_order_items boi
WHERE boi.product_sku IS NOT NULL
GROUP BY boi.batch_id, boi.product_sku, boi.product_name, boi.product_name_i18n, boi.product_image;

COMMENT ON VIEW public.batch_sku_summary IS 'SKU统计视图 - 按批次和SKU汇总商品数量';

-- ============================================
-- 第二十部分: 触发器函数
-- ============================================

-- 通用 updated_at 更新函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表创建触发器
DO $$
DECLARE
    tables_to_update TEXT[] := ARRAY[
        'users', 'user_profiles', 'user_sessions', 'wallets', 'wallet_transactions',
        'inventory_products', 'lotteries', 'orders', 'full_purchase_orders',
        'group_buy_products', 'group_buy_sessions', 'group_buy_orders', 'group_buy_results',
        'shipment_batches', 'batch_order_items', 'shipping', 'shipping_requests', 'shipping_records',
        'deposit_requests', 'deposits', 'withdrawal_requests', 'withdrawals',
        'commission_settings', 'commissions', 'commission_withdrawals',
        'user_spin_balance', 'spin_rewards', 'showoffs', 'showoff_comments',
        'resales', 'resale_items', 'market_listings',
        'admin_users', 'monitoring_alerts', 'system_configs', 'banners',
        'draw_algorithms', 'bot_user_settings', 'bot_sessions', 'prizes', 'pickup_points'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables_to_update
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%s', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- 批次统计更新触发器
CREATE OR REPLACE FUNCTION public.update_batch_statistics(p_batch_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.shipment_batches
    SET 
        total_orders = (SELECT COUNT(*) FROM public.batch_order_items WHERE batch_id = p_batch_id),
        normal_orders = (SELECT COUNT(*) FROM public.batch_order_items WHERE batch_id = p_batch_id AND arrival_status = 'NORMAL'),
        missing_orders = (SELECT COUNT(*) FROM public.batch_order_items WHERE batch_id = p_batch_id AND arrival_status = 'MISSING'),
        damaged_orders = (SELECT COUNT(*) FROM public.batch_order_items WHERE batch_id = p_batch_id AND arrival_status = 'DAMAGED')
    WHERE id = p_batch_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trigger_update_batch_statistics()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM public.update_batch_statistics(NEW.batch_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.update_batch_statistics(OLD.batch_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_batch_order_items_statistics ON public.batch_order_items;
CREATE TRIGGER trigger_batch_order_items_statistics
    AFTER INSERT OR UPDATE OR DELETE ON public.batch_order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_update_batch_statistics();

-- 库存状态自动更新触发器
CREATE OR REPLACE FUNCTION public.update_inventory_product_status()
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

DROP TRIGGER IF EXISTS trigger_update_inventory_product_status ON public.inventory_products;
CREATE TRIGGER trigger_update_inventory_product_status
    BEFORE UPDATE ON public.inventory_products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_inventory_product_status();


-- ============================================
-- 第二十一部分: RPC 函数
-- ============================================

-- 增加用户余额
CREATE OR REPLACE FUNCTION public.increment_user_balance(
    p_user_id TEXT,
    p_amount DECIMAL(10,2)
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance DECIMAL(10,2);
BEGIN
    UPDATE public.users
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING balance INTO v_new_balance;
    
    RETURN v_new_balance;
END;
$$;

-- 减少用户余额
CREATE OR REPLACE FUNCTION public.decrement_user_balance(
    p_user_id TEXT,
    p_amount DECIMAL(10,2)
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_balance DECIMAL(10,2);
BEGIN
    UPDATE public.users
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE id = p_user_id AND balance >= p_amount
    RETURNING balance INTO v_new_balance;
    
    IF v_new_balance IS NULL THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;
    
    RETURN v_new_balance;
END;
$$;

-- 增加点赞数
CREATE OR REPLACE FUNCTION public.increment_likes_count(p_post_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_count INTEGER;
BEGIN
    UPDATE public.showoffs
    SET likes_count = likes_count + 1
    WHERE id = p_post_id
    RETURNING likes_count INTO v_new_count;
    
    RETURN v_new_count;
END;
$$;

-- 减少点赞数
CREATE OR REPLACE FUNCTION public.decrement_likes_count(p_post_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_count INTEGER;
BEGIN
    UPDATE public.showoffs
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = p_post_id
    RETURNING likes_count INTO v_new_count;
    
    RETURN v_new_count;
END;
$$;

-- 增加已售数量
CREATE OR REPLACE FUNCTION public.increment_sold_quantity(
    p_lottery_id TEXT,
    p_quantity INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_sold INTEGER;
BEGIN
    UPDATE public.lotteries
    SET sold_tickets = sold_tickets + p_quantity,
        updated_at = NOW()
    WHERE id = p_lottery_id
    RETURNING sold_tickets INTO v_new_sold;
    
    RETURN v_new_sold;
END;
$$;

-- 购买抽奖券原子操作
CREATE OR REPLACE FUNCTION public.purchase_lottery_atomic(
    p_user_id TEXT,
    p_lottery_id TEXT,
    p_quantity INTEGER,
    p_total_amount DECIMAL(10,2),
    p_payment_method TEXT DEFAULT 'BALANCE'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lottery RECORD;
    v_user RECORD;
    v_order_id TEXT;
    v_ticket_numbers INTEGER[];
    v_current_sold INTEGER;
    v_i INTEGER;
BEGIN
    -- 获取抽奖信息并锁定
    SELECT * INTO v_lottery FROM public.lotteries WHERE id = p_lottery_id FOR UPDATE;
    IF v_lottery IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lottery not found');
    END IF;
    
    -- 检查状态
    IF v_lottery.status != 'ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lottery is not active');
    END IF;
    
    -- 检查库存
    IF v_lottery.sold_tickets + p_quantity > v_lottery.total_tickets THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not enough tickets available');
    END IF;
    
    -- 获取用户信息并锁定
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
    
    -- 检查余额
    IF v_user.balance < p_total_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;
    
    -- 扣除余额
    UPDATE public.users SET balance = balance - p_total_amount WHERE id = p_user_id;
    
    -- 更新已售数量
    v_current_sold := v_lottery.sold_tickets;
    UPDATE public.lotteries SET sold_tickets = sold_tickets + p_quantity WHERE id = p_lottery_id;
    
    -- 创建订单
    v_order_id := gen_random_uuid()::TEXT;
    INSERT INTO public.orders (id, user_id, lottery_id, type, total_amount, ticket_count, status, created_at)
    VALUES (v_order_id, p_user_id, p_lottery_id, 'LOTTERY', p_total_amount, p_quantity, 'COMPLETED', NOW());
    
    -- 生成票号
    v_ticket_numbers := ARRAY[]::INTEGER[];
    FOR v_i IN 1..p_quantity LOOP
        v_ticket_numbers := array_append(v_ticket_numbers, v_current_sold + v_i);
        
        INSERT INTO public.lottery_entries (user_id, lottery_id, ticket_number, created_at)
        VALUES (p_user_id, p_lottery_id, v_current_sold + v_i, NOW());
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'ticket_numbers', v_ticket_numbers
    );
END;
$$;

-- 下单抽奖
CREATE OR REPLACE FUNCTION public.place_lottery_order(
    p_user_id TEXT,
    p_lottery_id TEXT,
    p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lottery RECORD;
    v_total_amount DECIMAL(10,2);
BEGIN
    SELECT * INTO v_lottery FROM public.lotteries WHERE id = p_lottery_id;
    IF v_lottery IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lottery not found');
    END IF;
    
    v_total_amount := v_lottery.ticket_price * p_quantity;
    
    RETURN public.purchase_lottery_atomic(p_user_id, p_lottery_id, p_quantity, v_total_amount);
END;
$$;

-- 真实余额兑换奖励余额
CREATE OR REPLACE FUNCTION public.exchange_real_to_bonus_balance(
    p_user_id TEXT,
    p_amount DECIMAL(10,2)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_exchange_rate DECIMAL(10,4) := 1.0;
    v_bonus_amount DECIMAL(10,2);
BEGIN
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF v_user IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
    
    IF v_user.balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;
    
    v_bonus_amount := p_amount * v_exchange_rate;
    
    UPDATE public.users
    SET balance = balance - p_amount,
        bonus_balance = bonus_balance + v_bonus_amount
    WHERE id = p_user_id;
    
    INSERT INTO public.exchange_records (user_id, from_wallet_type, to_wallet_type, amount, exchange_rate)
    VALUES (p_user_id, 'TJS', 'BONUS', p_amount, v_exchange_rate);
    
    RETURN jsonb_build_object(
        'success', true,
        'exchanged_amount', p_amount,
        'bonus_received', v_bonus_amount
    );
END;
$$;

-- 获取用户推荐统计
CREATE OR REPLACE FUNCTION public.get_user_referral_stats(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_level1_count INTEGER;
    v_level2_count INTEGER;
    v_level3_count INTEGER;
    v_total_commission DECIMAL(10,2);
BEGIN
    SELECT COUNT(*) INTO v_level1_count
    FROM public.users WHERE invited_by = p_user_id;
    
    SELECT COUNT(*) INTO v_level2_count
    FROM public.users u1
    JOIN public.users u2 ON u1.invited_by = u2.id
    WHERE u2.invited_by = p_user_id;
    
    SELECT COUNT(*) INTO v_level3_count
    FROM public.users u1
    JOIN public.users u2 ON u1.invited_by = u2.id
    JOIN public.users u3 ON u2.invited_by = u3.id
    WHERE u3.invited_by = p_user_id;
    
    SELECT COALESCE(SUM(amount), 0) INTO v_total_commission
    FROM public.commissions
    WHERE user_id = p_user_id AND status = 'paid';
    
    v_result := jsonb_build_object(
        'level1_count', v_level1_count,
        'level2_count', v_level2_count,
        'level3_count', v_level3_count,
        'total_referrals', v_level1_count + v_level2_count + v_level3_count,
        'total_commission', v_total_commission
    );
    
    RETURN v_result;
END;
$$;

-- 触发佣金计算
CREATE OR REPLACE FUNCTION public.trigger_commission_for_exchange(
    p_user_id TEXT,
    p_amount DECIMAL(10,2),
    p_order_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referrer_id TEXT;
    v_level INTEGER := 1;
    v_rate DECIMAL(5,4);
    v_commission_amount DECIMAL(10,2);
BEGIN
    v_referrer_id := (SELECT invited_by FROM public.users WHERE id = p_user_id);
    
    WHILE v_referrer_id IS NOT NULL AND v_level <= 3 LOOP
        SELECT rate INTO v_rate FROM public.commission_settings WHERE level = v_level AND is_active = TRUE;
        
        IF v_rate IS NOT NULL THEN
            v_commission_amount := p_amount * v_rate;
            
            IF v_commission_amount > 0 THEN
                INSERT INTO public.commissions (
                    user_id, from_user_id, amount, source_amount, rate, level, type, status
                ) VALUES (
                    v_referrer_id, p_user_id, v_commission_amount, p_amount, v_rate, v_level, 'deposit', 'pending'
                );
                
                UPDATE public.users
                SET commission_balance = commission_balance + v_commission_amount
                WHERE id = v_referrer_id;
            END IF;
        END IF;
        
        v_referrer_id := (SELECT invited_by FROM public.users WHERE id = v_referrer_id);
        v_level := v_level + 1;
    END LOOP;
END;
$$;

-- 转盘抽奖相关函数
CREATE OR REPLACE FUNCTION public.add_user_spin_count(
    p_user_id TEXT,
    p_count INTEGER,
    p_source VARCHAR(50) DEFAULT 'manual'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_count INTEGER;
BEGIN
    INSERT INTO public.user_spin_balance (user_id, spin_count, total_earned)
    VALUES (p_user_id, p_count, p_count)
    ON CONFLICT (user_id) DO UPDATE SET
        spin_count = public.user_spin_balance.spin_count + p_count,
        total_earned = public.user_spin_balance.total_earned + p_count,
        updated_at = NOW();
    
    SELECT spin_count INTO v_new_count
    FROM public.user_spin_balance
    WHERE user_id = p_user_id;
    
    RETURN v_new_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_user_spin_count(
    p_user_id TEXT,
    p_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_count INTEGER;
BEGIN
    SELECT spin_count INTO v_current_count
    FROM public.user_spin_balance
    WHERE user_id = p_user_id;
    
    IF v_current_count IS NULL OR v_current_count < p_count THEN
        RETURN FALSE;
    END IF;
    
    UPDATE public.user_spin_balance
    SET spin_count = spin_count - p_count,
        total_used = total_used + p_count,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_user_lucky_coins(
    p_user_id TEXT,
    p_amount DECIMAL(10,2),
    p_description VARCHAR(255) DEFAULT '转盘抽奖奖励'
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id TEXT;
    v_current_balance DECIMAL(10,2);
    v_new_balance DECIMAL(10,2);
BEGIN
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM public.wallets
    WHERE user_id = p_user_id AND type::TEXT = 'LUCKY_COIN'
    LIMIT 1;
    
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'User LUCKY_COIN wallet not found';
    END IF;
    
    UPDATE public.wallets
    SET balance = balance + p_amount, updated_at = NOW()
    WHERE id = v_wallet_id;
    
    SELECT balance INTO v_new_balance FROM public.wallets WHERE id = v_wallet_id;
    
    INSERT INTO public.wallet_transactions (
        wallet_id, type, amount, balance_before, balance_after, description, status
    ) VALUES (
        v_wallet_id, 'SPIN_REWARD', p_amount, v_current_balance, v_new_balance, p_description, 'COMPLETED'
    );
    
    RETURN v_new_balance;
END;
$$;

-- 生成提货码
CREATE OR REPLACE FUNCTION public.generate_pickup_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
        
        SELECT EXISTS(SELECT 1 FROM public.prizes WHERE pickup_code = v_code) INTO v_exists;
        IF NOT v_exists THEN
            SELECT EXISTS(SELECT 1 FROM public.full_purchase_orders WHERE pickup_code = v_code) INTO v_exists;
        END IF;
        IF NOT v_exists THEN
            SELECT EXISTS(SELECT 1 FROM public.batch_order_items WHERE pickup_code = v_code) INTO v_exists;
        END IF;
        
        EXIT WHEN NOT v_exists;
    END LOOP;
    
    RETURN v_code;
END;
$$;

-- 生成批次号
CREATE OR REPLACE FUNCTION public.generate_batch_no()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_date_part TEXT;
    v_seq INTEGER;
    v_batch_no TEXT;
BEGIN
    v_date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(batch_no FROM 10) AS INTEGER)), 0) + 1
    INTO v_seq
    FROM public.shipment_batches
    WHERE batch_no LIKE 'B' || v_date_part || '%';
    
    v_batch_no := 'B' || v_date_part || LPAD(v_seq::TEXT, 3, '0');
    
    RETURN v_batch_no;
END;
$$;

-- ============================================
-- 第二十二部分: RLS 策略
-- ============================================

-- 启用 RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_spin_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_configs ENABLE ROW LEVEL SECURITY;

-- 公开读取策略
CREATE POLICY "Allow public read access to lotteries" ON public.lotteries FOR SELECT USING (true);
CREATE POLICY "Allow public read access to inventory_products" ON public.inventory_products FOR SELECT USING (true);
CREATE POLICY "Allow public read access to pickup_points" ON public.pickup_points FOR SELECT USING (true);
CREATE POLICY "Allow public read access to banners" ON public.banners FOR SELECT USING (is_active = true);
CREATE POLICY "Allow public read access to spin_rewards" ON public.spin_rewards FOR SELECT USING (is_active = true);
CREATE POLICY "Allow public read access to payment_configs" ON public.payment_configs FOR SELECT USING (is_active = true);
CREATE POLICY "Allow public read access to group_buy_products" ON public.group_buy_products FOR SELECT USING (true);

-- 服务角色完全访问策略
CREATE POLICY "Service role full access to users" ON public.users FOR ALL USING (true);
CREATE POLICY "Service role full access to wallets" ON public.wallets FOR ALL USING (true);
CREATE POLICY "Service role full access to wallet_transactions" ON public.wallet_transactions FOR ALL USING (true);
CREATE POLICY "Service role full access to orders" ON public.orders FOR ALL USING (true);
CREATE POLICY "Service role full access to lottery_entries" ON public.lottery_entries FOR ALL USING (true);
CREATE POLICY "Service role full access to prizes" ON public.prizes FOR ALL USING (true);
CREATE POLICY "Service role full access to shipping" ON public.shipping FOR ALL USING (true);
CREATE POLICY "Service role full access to deposit_requests" ON public.deposit_requests FOR ALL USING (true);
CREATE POLICY "Service role full access to withdrawal_requests" ON public.withdrawal_requests FOR ALL USING (true);
CREATE POLICY "Service role full access to commissions" ON public.commissions FOR ALL USING (true);
CREATE POLICY "Service role full access to notifications" ON public.notifications FOR ALL USING (true);
CREATE POLICY "Service role full access to showoffs" ON public.showoffs FOR ALL USING (true);
CREATE POLICY "Service role full access to inventory_products" ON public.inventory_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to inventory_transactions" ON public.inventory_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to user_spin_balance" ON public.user_spin_balance FOR ALL USING (true);
CREATE POLICY "Service role full access to spin_records" ON public.spin_records FOR ALL USING (true);
CREATE POLICY "Service role full access to invite_rewards" ON public.invite_rewards FOR ALL USING (true);
CREATE POLICY "Service role full access to shipment_batches" ON public.shipment_batches FOR ALL USING (true);
CREATE POLICY "Service role full access to batch_order_items" ON public.batch_order_items FOR ALL USING (true);

-- ============================================
-- 第二十三部分: 初始数据
-- ============================================

-- 插入默认佣金配置
INSERT INTO public.commission_settings (level, rate, percent, description_i18n, is_active)
VALUES 
    (1, 0.05, 5.00, '{"zh": "一级推荐佣金", "ru": "Комиссия 1 уровня", "tg": "Комиссияи сатҳи 1"}', true),
    (2, 0.03, 3.00, '{"zh": "二级推荐佣金", "ru": "Комиссия 2 уровня", "tg": "Комиссияи сатҳи 2"}', true),
    (3, 0.01, 1.00, '{"zh": "三级推荐佣金", "ru": "Комиссия 3 уровня", "tg": "Комиссияи сатҳи 3"}', true)
ON CONFLICT (level) DO NOTHING;

-- 插入默认转盘奖池配置
INSERT INTO public.spin_rewards (reward_name, reward_name_i18n, reward_type, reward_amount, probability, display_order, is_active, is_jackpot)
SELECT '100积分', '{"zh": "100积分", "ru": "100 баллов", "tg": "100 хол"}'::jsonb, 'LUCKY_COIN', 100, 0.00100, 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.spin_rewards WHERE display_order = 0);

INSERT INTO public.spin_rewards (reward_name, reward_name_i18n, reward_type, reward_amount, probability, display_order, is_active, is_jackpot)
SELECT '10积分', '{"zh": "10积分", "ru": "10 баллов", "tg": "10 хол"}'::jsonb, 'LUCKY_COIN', 10, 0.15000, 1, true, false
WHERE NOT EXISTS (SELECT 1 FROM public.spin_rewards WHERE display_order = 1);

INSERT INTO public.spin_rewards (reward_name, reward_name_i18n, reward_type, reward_amount, probability, display_order, is_active, is_jackpot)
SELECT '5积分', '{"zh": "5积分", "ru": "5 баллов", "tg": "5 хол"}'::jsonb, 'LUCKY_COIN', 5, 0.25000, 2, true, false
WHERE NOT EXISTS (SELECT 1 FROM public.spin_rewards WHERE display_order = 2);

INSERT INTO public.spin_rewards (reward_name, reward_name_i18n, reward_type, reward_amount, probability, display_order, is_active, is_jackpot)
SELECT '1积分', '{"zh": "1积分", "ru": "1 балл", "tg": "1 хол"}'::jsonb, 'LUCKY_COIN', 1, 0.30000, 3, true, false
WHERE NOT EXISTS (SELECT 1 FROM public.spin_rewards WHERE display_order = 3);

INSERT INTO public.spin_rewards (reward_name, reward_name_i18n, reward_type, reward_amount, probability, display_order, is_active, is_jackpot)
SELECT '0.5积分', '{"zh": "0.5积分", "ru": "0.5 балла", "tg": "0.5 хол"}'::jsonb, 'LUCKY_COIN', 0.5, 0.29900, 4, true, false
WHERE NOT EXISTS (SELECT 1 FROM public.spin_rewards WHERE display_order = 4);

INSERT INTO public.spin_rewards (reward_name, reward_name_i18n, reward_type, reward_amount, probability, display_order, is_active, is_jackpot)
SELECT '谢谢惠顾', '{"zh": "谢谢惠顾", "ru": "Спасибо!", "tg": "Ташаккур!"}'::jsonb, 'NONE', 0, 0.00000, 5, true, false
WHERE NOT EXISTS (SELECT 1 FROM public.spin_rewards WHERE display_order = 5);

-- 插入默认开奖算法
INSERT INTO public.draw_algorithms (name, display_name_i18n, description_i18n, is_active, is_default)
VALUES (
    'vrf_random',
    '{"zh": "VRF随机算法", "ru": "VRF случайный алгоритм", "tg": "Алгоритми тасодуфии VRF"}',
    '{"zh": "使用可验证随机函数进行公平开奖", "ru": "Использует проверяемую случайную функцию для честного розыгрыша", "tg": "Барои қуръакашии одилона функсияи тасодуфии тасдиқшаванда истифода мешавад"}',
    true,
    true
) ON CONFLICT (name) DO NOTHING;

-- 插入默认支付配置
INSERT INTO public.payment_configs (name, type, currency, config, instructions, min_amount, max_amount, is_active, display_order)
VALUES (
    'Bank Transfer (TJS)',
    'BANK_TRANSFER',
    'TJS',
    '{"bank_name": "Amonatbank", "account_number": "1234567890", "account_holder": "LuckyMart TJ"}',
    '{"zh": "请转账到以下银行账户，并上传转账凭证", "ru": "Пожалуйста, переведите на следующий банковский счет и загрузите подтверждение", "tg": "Лутфан ба ҳисоби бонкии зерин пул гузаронед ва тасдиқномаро бор кунед"}',
    10.00,
    10000.00,
    true,
    1
) ON CONFLICT DO NOTHING;

-- ============================================
-- 迁移完成
-- ============================================

-- 版本信息
COMMENT ON SCHEMA public IS 'LuckyMart-TJ Database Schema v2.0 - Generated on 2026-01-10';

-- ============================================
-- LuckyMart-TJ 数据库补充表
-- 这些表在之前的恢复文件中遗漏
-- 生成时间: 2026-01-10
-- ============================================

-- ============================================
-- 1. share_logs 表 (分享日志)
-- 来源: 20251118_referral_optimization.sql
-- ============================================
CREATE TABLE IF NOT EXISTS public.share_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    share_type VARCHAR(50) DEFAULT 'activation', -- 'activation'=激活分享
    share_target VARCHAR(100), -- 'telegram_group' 等
    shared_at TIMESTAMPTZ DEFAULT NOW(),
    share_data JSONB -- Telegram Mini App 分享API返回的信息
);

CREATE INDEX IF NOT EXISTS idx_share_logs_user_id ON public.share_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_share_logs_shared_at ON public.share_logs(shared_at);

COMMENT ON TABLE public.share_logs IS '分享日志表：记录用户的分享行为，用于激活首充奖励等功能';

-- ============================================
-- 2. system_config 表 (系统配置 - 简化版)
-- 来源: 20251118_referral_optimization.sql
-- 注意: 与 system_configs 表不同，这是另一个配置表
-- ============================================
CREATE TABLE IF NOT EXISTS public.system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.system_config IS '系统配置表（简化版）：存储佣金配置、首充奖励配置等';

-- 插入默认配置
INSERT INTO public.system_config (key, value, description) VALUES
('referral_commission_rates', 
 '{"level1": 0.03, "level2": 0.01, "level3": 0.005}'::jsonb,
 '三级返佣比例配置'),
('first_deposit_bonus', 
 '{"min_amount": 10, "bonus_amount": 2.5, "expire_days": 7, "activation_methods": ["share_2_groups", "invite_1_user"]}'::jsonb,
 '首充奖励配置')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = NOW();

-- ============================================
-- 3. products 表 (商品表 - 虚拟表)
-- 来源: supabase_migration.sql (Admin项目)
-- 用于关联 lotteries 表的 product_id
-- ============================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    image_url TEXT,
    price DECIMAL(10,2),
    stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

COMMENT ON TABLE public.products IS '商品表：存储基础商品信息，可关联到抽奖活动';

-- ============================================
-- 4. RPC函数: add_bonus_balance
-- 来源: 20251118_referral_optimization.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.add_bonus_balance(
    p_user_id UUID,
    p_amount DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.users
    SET bonus_balance = COALESCE(bonus_balance, 0) + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id::TEXT;
END;
$$;

-- ============================================
-- 5. RPC函数: approve_withdrawal_request
-- 来源: database.types.ts Functions
-- ============================================
CREATE OR REPLACE FUNCTION public.approve_withdrawal_request(
    p_admin_id TEXT,
    p_withdrawal_id TEXT,
    p_admin_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_withdrawal RECORD;
    v_user RECORD;
BEGIN
    -- 获取提现请求
    SELECT * INTO v_withdrawal FROM public.withdrawal_requests 
    WHERE id = p_withdrawal_id::UUID FOR UPDATE;
    
    IF v_withdrawal IS NULL THEN
        RAISE EXCEPTION 'Withdrawal request not found';
    END IF;
    
    IF v_withdrawal.status != 'PENDING' THEN
        RAISE EXCEPTION 'Withdrawal request is not pending';
    END IF;
    
    -- 获取用户
    SELECT * INTO v_user FROM public.users WHERE id = v_withdrawal.user_id FOR UPDATE;
    
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- 检查余额
    IF v_user.balance < v_withdrawal.amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;
    
    -- 扣除余额
    UPDATE public.users 
    SET balance = balance - v_withdrawal.amount,
        updated_at = NOW()
    WHERE id = v_withdrawal.user_id;
    
    -- 更新提现状态
    UPDATE public.withdrawal_requests
    SET status = 'APPROVED',
        admin_id = p_admin_id,
        admin_note = p_admin_note,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_withdrawal_id::UUID;
    
    RETURN TRUE;
END;
$$;

-- ============================================
-- 6. RPC函数: reject_withdrawal_request
-- 来源: database.types.ts Functions
-- ============================================
CREATE OR REPLACE FUNCTION public.reject_withdrawal_request(
    p_admin_id TEXT,
    p_withdrawal_id TEXT,
    p_admin_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_withdrawal RECORD;
BEGIN
    -- 获取提现请求
    SELECT * INTO v_withdrawal FROM public.withdrawal_requests 
    WHERE id = p_withdrawal_id::UUID FOR UPDATE;
    
    IF v_withdrawal IS NULL THEN
        RAISE EXCEPTION 'Withdrawal request not found';
    END IF;
    
    IF v_withdrawal.status != 'PENDING' THEN
        RAISE EXCEPTION 'Withdrawal request is not pending';
    END IF;
    
    -- 更新提现状态
    UPDATE public.withdrawal_requests
    SET status = 'REJECTED',
        admin_id = p_admin_id,
        admin_note = p_admin_note,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_withdrawal_id::UUID;
    
    RETURN TRUE;
END;
$$;

-- ============================================
-- 7. RPC函数: auto_draw_lotteries
-- 来源: database.types.ts Functions
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_draw_lotteries()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lottery RECORD;
BEGIN
    -- 查找需要开奖的抽奖
    FOR v_lottery IN 
        SELECT * FROM public.lotteries 
        WHERE status = 'SOLD_OUT' 
        AND draw_time <= NOW()
        FOR UPDATE
    LOOP
        -- 执行开奖逻辑
        PERFORM public.draw_lottery(v_lottery.id);
    END LOOP;
END;
$$;

-- ============================================
-- 8. RPC函数: draw_lottery
-- 来源: database.types.ts Functions
-- ============================================
CREATE OR REPLACE FUNCTION public.draw_lottery(p_lottery_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lottery RECORD;
    v_winner_entry RECORD;
    v_result JSONB;
BEGIN
    -- 获取抽奖信息
    SELECT * INTO v_lottery FROM public.lotteries WHERE id = p_lottery_id FOR UPDATE;
    
    IF v_lottery IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lottery not found');
    END IF;
    
    IF v_lottery.status NOT IN ('SOLD_OUT', 'ACTIVE') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Lottery cannot be drawn');
    END IF;
    
    -- 随机选择中奖者
    SELECT * INTO v_winner_entry 
    FROM public.lottery_entries 
    WHERE lottery_id = p_lottery_id 
    ORDER BY RANDOM() 
    LIMIT 1;
    
    IF v_winner_entry IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No entries found');
    END IF;
    
    -- 更新抽奖状态
    UPDATE public.lotteries 
    SET status = 'COMPLETED',
        actual_draw_time = NOW(),
        winner_user_id = v_winner_entry.user_id,
        updated_at = NOW()
    WHERE id = p_lottery_id;
    
    -- 创建中奖记录
    INSERT INTO public.prizes (
        lottery_id, user_id, prize_type, status, created_at
    ) VALUES (
        p_lottery_id, v_winner_entry.user_id, 'LOTTERY_WIN', 'PENDING', NOW()
    );
    
    -- 记录开奖结果
    INSERT INTO public.lottery_results (
        lottery_id, winner_id, winner_ticket_number, draw_time
    ) VALUES (
        p_lottery_id, v_winner_entry.user_id, v_winner_entry.ticket_number, NOW()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'winner_id', v_winner_entry.user_id,
        'winner_ticket_number', v_winner_entry.ticket_number
    );
END;
$$;

-- ============================================
-- 补充完成
-- ============================================
-- ============================================
-- LuckyMart-TJ 数据库补充函数
-- 这些函数在之前的恢复文件中遗漏
-- 生成时间: 2026-01-10
-- ============================================

-- ============================================
-- 1. increase_user_balance - 增加用户余额（用于充值批准）
-- 来源: Admin项目 supabase_migration.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.increase_user_balance(user_id uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.users
    SET balance = balance + amount
    WHERE id = user_id::TEXT;
END;
$$;

-- ============================================
-- 2. decrease_user_balance - 减少用户余额（用于提现批准）
-- 来源: Admin项目 supabase_migration.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.decrease_user_balance(user_id uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.users
    SET balance = balance - amount
    WHERE id = user_id::TEXT;
    
    -- 检查余额是否足够，如果不足，抛出异常
    IF (SELECT balance FROM public.users WHERE id = user_id::TEXT) < 0 THEN
        RAISE EXCEPTION 'Insufficient balance for user %', user_id;
    END IF;
END;
$$;

-- ============================================
-- 3. increase_commission_balance - 增加用户佣金余额
-- 来源: Admin项目 supabase_migration_commission.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.increase_commission_balance(user_id uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.users
    SET commission_balance = COALESCE(commission_balance, 0) + amount
    WHERE id = user_id::TEXT;
END;
$$;

-- ============================================
-- 4. decrease_commission_balance - 减少用户佣金余额（用于佣金提现）
-- 来源: Admin项目 supabase_migration_commission.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.decrease_commission_balance(user_id uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.users
    SET commission_balance = commission_balance - amount
    WHERE id = user_id::TEXT;
    
    -- 检查余额是否足够
    IF (SELECT commission_balance FROM public.users WHERE id = user_id::TEXT) < 0 THEN
        RAISE EXCEPTION 'Insufficient commission balance for user %', user_id;
    END IF;
END;
$$;

-- ============================================
-- 5. get_commission_settings - 获取佣金配置（用于前端管理后台）
-- 来源: Admin项目 supabase_migration_commission.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_commission_settings()
RETURNS SETOF public.commission_settings
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT * FROM public.commission_settings ORDER BY level;
$$;

-- ============================================
-- 6. update_commission_settings - 更新佣金配置（用于前端管理后台）
-- 来源: Admin项目 supabase_migration_commission.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.update_commission_settings(settings_json jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    setting_record jsonb;
BEGIN
    FOR setting_record IN SELECT * FROM jsonb_array_elements(settings_json)
    LOOP
        UPDATE public.commission_settings
        SET percent = (setting_record->>'percent')::numeric,
            updated_at = now()
        WHERE level = (setting_record->>'level')::integer;
    END LOOP;
END;
$$;

-- ============================================
-- 7. get_dashboard_stats - 获取仪表板统计（用于管理后台）
-- 来源: Admin项目 supabase_migration.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_users_count integer;
    active_lotteries_count integer;
    total_revenue_sum numeric;
    pending_orders_count integer;
BEGIN
    -- 总用户数
    SELECT COUNT(*) INTO total_users_count FROM public.users;
    -- 活跃夺宝数 (ACTIVE 或 SOLD_OUT)
    SELECT COUNT(*) INTO active_lotteries_count FROM public.lotteries WHERE status IN ('ACTIVE', 'SOLD_OUT');
    -- 总收入 (简化：所有已完成订单的总金额)
    SELECT COALESCE(SUM(total_amount), 0) INTO total_revenue_sum FROM public.orders WHERE status = 'COMPLETED';
    -- 待处理订单数 (PENDING)
    SELECT COUNT(*) INTO pending_orders_count FROM public.orders WHERE status = 'PENDING';
    RETURN jsonb_build_object(
        'total_users', total_users_count,
        'active_lotteries', active_lotteries_count,
        'total_revenue', total_revenue_sum,
        'pending_orders', pending_orders_count
    );
END;
$$;

-- ============================================
-- 8. get_revenue_by_day - 获取每日收入统计（用于Dashboard）
-- 来源: Admin项目 supabase_migration.sql
-- ============================================
CREATE OR REPLACE FUNCTION public.get_revenue_by_day(days integer)
RETURNS TABLE (date date, revenue numeric, deposits numeric)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT
    date_trunc('day', o.created_at)::date AS date,
    COALESCE(SUM(CASE WHEN o.type = 'LOTTERY_PURCHASE' OR o.type = 'MARKET_PURCHASE' THEN o.total_amount ELSE 0 END), 0) AS revenue,
    COALESCE(SUM(CASE WHEN o.type = 'WALLET_RECHARGE' THEN o.total_amount ELSE 0 END), 0) AS deposits
FROM
    public.orders o
WHERE
    o.status = 'COMPLETED'
    AND o.created_at >= (NOW() - make_interval(days => days))
GROUP BY
    1
ORDER BY
    1;
$$;

-- ============================================
-- 9. purchase_lottery_with_concurrency_control - 带并发控制的抽奖购买
-- 来源: 20251127_lottery_purchase_with_7digit.sql
-- ============================================
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
    RAISE EXCEPTION '购买失败: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. update_batch_order_items_updated_at - 批次订单更新时间触发器
-- 来源: 20260109_add_shipment_batch_management.sql
-- ============================================
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

-- ============================================
-- 11. update_shipment_batches_updated_at - 发货批次更新时间触发器
-- 来源: 20260109_add_shipment_batch_management.sql
-- ============================================
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

-- ============================================
-- 12. update_inventory_products_updated_at - 库存商品更新时间触发器
-- 来源: 20260108_add_inventory_products.sql
-- ============================================
CREATE OR REPLACE FUNCTION update_inventory_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory_products_updated_at ON inventory_products;
CREATE TRIGGER trigger_update_inventory_products_updated_at
  BEFORE UPDATE ON inventory_products
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_products_updated_at();

-- ============================================
-- 13. update_spin_tables_updated_at - 转盘相关表更新时间触发器
-- 来源: 20260101_spin_lottery_feature.sql
-- ============================================
CREATE OR REPLACE FUNCTION update_spin_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_spin_balance_updated_at ON user_spin_balance;
CREATE TRIGGER update_user_spin_balance_updated_at 
    BEFORE UPDATE ON user_spin_balance
    FOR EACH ROW EXECUTE FUNCTION update_spin_tables_updated_at();

DROP TRIGGER IF EXISTS update_spin_rewards_updated_at ON spin_rewards;
CREATE TRIGGER update_spin_rewards_updated_at 
    BEFORE UPDATE ON spin_rewards
    FOR EACH ROW EXECUTE FUNCTION update_spin_tables_updated_at();

DROP TRIGGER IF EXISTS update_spin_records_updated_at ON spin_records;
CREATE TRIGGER update_spin_records_updated_at 
    BEFORE UPDATE ON spin_records
    FOR EACH ROW EXECUTE FUNCTION update_spin_tables_updated_at();

DROP TRIGGER IF EXISTS update_invite_rewards_updated_at ON invite_rewards;
CREATE TRIGGER update_invite_rewards_updated_at 
    BEFORE UPDATE ON invite_rewards
    FOR EACH ROW EXECUTE FUNCTION update_spin_tables_updated_at();

-- ============================================
-- 补充完成
-- ============================================
