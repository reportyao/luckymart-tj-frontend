-- 20251125_create_missing_tables.sql
-- 创建代码中引用但Supabase未部署的数据库表

-- ============================================================================
-- 1. lottery_results 表 - 开奖结果记录
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lottery_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lottery_id UUID NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    winner_ticket_number INTEGER NOT NULL,
    draw_time TIMESTAMPTZ DEFAULT NOW(),
    algorithm_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT lottery_results_unique UNIQUE (lottery_id)
);

CREATE INDEX IF NOT EXISTS idx_lottery_results_lottery_id ON public.lottery_results(lottery_id);
CREATE INDEX IF NOT EXISTS idx_lottery_results_winner_id ON public.lottery_results(winner_id);
CREATE INDEX IF NOT EXISTS idx_lottery_results_draw_time ON public.lottery_results(draw_time);

COMMENT ON TABLE public.lottery_results IS '开奖结果记录表';
COMMENT ON COLUMN public.lottery_results.algorithm_data IS '开奖算法数据（JSON格式）';

-- ============================================================================
-- 2. tickets 表 - 抽奖券/彩票记录
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lottery_id UUID NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    ticket_number INTEGER NOT NULL,
    is_winning BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT tickets_unique UNIQUE (lottery_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_lottery_id ON public.tickets(lottery_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_is_winning ON public.tickets(is_winning);

COMMENT ON TABLE public.tickets IS '用户购买的抽奖券记录';

-- ============================================================================
-- 3. user_profiles 表 - 用户详细资料（扩展profiles表）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
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

COMMENT ON TABLE public.user_profiles IS '用户详细资料扩展表';

-- ============================================================================
-- 4. showoff_comments 表 - 晒单评论
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.showoff_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.showoffs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.showoff_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_showoff_comments_post_id ON public.showoff_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_showoff_comments_user_id ON public.showoff_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_showoff_comments_parent_id ON public.showoff_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_showoff_comments_created_at ON public.showoff_comments(created_at);

COMMENT ON TABLE public.showoff_comments IS '晒单功能的评论表';

-- ============================================================================
-- 5. showoff_likes 表 - 晒单点赞
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.showoff_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.showoffs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT showoff_likes_unique UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_showoff_likes_post_id ON public.showoff_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_showoff_likes_user_id ON public.showoff_likes(user_id);

COMMENT ON TABLE public.showoff_likes IS '晒单功能的点赞表';

-- ============================================================================
-- 6. transactions 表 - 通用交易记录
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'purchase', 'refund', 'commission'
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'TJS',
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
    
    -- 关联信息
    related_id UUID,
    related_type TEXT,
    
    -- 余额快照
    balance_before DECIMAL(10,2),
    balance_after DECIMAL(10,2),
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_related_id ON public.transactions(related_id);

COMMENT ON TABLE public.transactions IS '通用交易记录表';

-- ============================================================================
-- 7. resales 表 - 二手市场交易记录
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.resales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    lottery_id UUID NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
    
    original_price DECIMAL(10,2) NOT NULL,
    resale_price DECIMAL(10,2) NOT NULL,
    
    status TEXT DEFAULT 'listed', -- 'listed', 'sold', 'cancelled'
    
    listed_at TIMESTAMPTZ DEFAULT NOW(),
    sold_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resales_seller_id ON public.resales(seller_id);
CREATE INDEX IF NOT EXISTS idx_resales_buyer_id ON public.resales(buyer_id);
CREATE INDEX IF NOT EXISTS idx_resales_lottery_id ON public.resales(lottery_id);
CREATE INDEX IF NOT EXISTS idx_resales_status ON public.resales(status);
CREATE INDEX IF NOT EXISTS idx_resales_listed_at ON public.resales(listed_at);

COMMENT ON TABLE public.resales IS '二手市场交易记录表';

-- ============================================================================
-- 8. resale_items 表 - 二手市场商品列表（可能与resales重复，但保留以兼容代码）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.resale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resale_id UUID REFERENCES public.resales(id) ON DELETE CASCADE,
    lottery_id UUID NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
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

COMMENT ON TABLE public.resale_items IS '二手市场商品列表（扩展表）';

-- ============================================================================
-- 9. shipping_requests 表 - 发货请求
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shipping_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lottery_id UUID NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    recipient_city TEXT,
    recipient_region TEXT,
    recipient_postal_code TEXT,
    recipient_country TEXT DEFAULT 'Tajikistan',
    
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'shipped', 'delivered', 'cancelled'
    
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
CREATE INDEX IF NOT EXISTS idx_shipping_requests_requested_at ON public.shipping_requests(requested_at);

COMMENT ON TABLE public.shipping_requests IS '用户发货请求表';

-- ============================================================================
-- 10. shipping_history 表 - 物流历史记录
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shipping_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipping_request_id UUID REFERENCES public.shipping_requests(id) ON DELETE CASCADE,
    shipping_record_id UUID REFERENCES public.shipping_records(id) ON DELETE CASCADE,
    
    status TEXT NOT NULL,
    location TEXT,
    notes TEXT,
    
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_history_request_id ON public.shipping_history(shipping_request_id);
CREATE INDEX IF NOT EXISTS idx_shipping_history_record_id ON public.shipping_history(shipping_record_id);
CREATE INDEX IF NOT EXISTS idx_shipping_history_timestamp ON public.shipping_history(timestamp);

COMMENT ON TABLE public.shipping_history IS '物流状态历史记录表';

-- ============================================================================
-- 11. monitoring_alerts 表 - 系统监控警报
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL, -- 'error', 'warning', 'info'
    severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    source TEXT, -- 'edge_function', 'database', 'cron_job', 'api'
    resource TEXT,
    resource_id TEXT,
    
    status TEXT DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
    
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
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_triggered_at ON public.monitoring_alerts(triggered_at);

COMMENT ON TABLE public.monitoring_alerts IS '系统监控和警报表';

-- ============================================================================
-- 完成
-- ============================================================================
-- 注意：system_config 和 payment_configs 表名变体问题：
-- - 代码中使用 system_config，但Supabase中已有 system_configs
-- - 代码中使用 payment_configs，但Supabase中已有 payment_config
-- 建议在代码中统一表名，而不是创建重复的表
