-- 20251118_referral_optimization.sql

-- 1. profiles 表新增字段
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonus_balance DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_deposit_bonus_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_deposit_bonus_status VARCHAR(20) DEFAULT 'none';
-- 状态值: 'none'(未获得) | 'pending'(待激活) | 'activated'(已激活) | 'expired'(已过期)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_deposit_bonus_expire_at TIMESTAMPTZ;
-- 激活截止时间（发放后7天）
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activation_share_count INT DEFAULT 0;
-- 已完成的分享次数
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activation_invite_count INT DEFAULT 0;
-- 通过此用户邀请完成首充的人数

-- 2. commissions 表（调整字段）
-- 确保 commissions 表存在，并调整字段
CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- from_user_id: 产生佣金的下级用户ID
    
    level INT NOT NULL, -- 1=一级, 2=二级, 3=三级
    commission_rate DECIMAL(5,4) NOT NULL, -- 0.0300, 0.0100, 0.0050
    order_amount DECIMAL(10,2) NOT NULL, -- 触发佣金的订单金额
    commission_amount DECIMAL(10,2) NOT NULL, -- 佣金金额
    
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    -- 关联的订单ID（购买份额的订单）
    
    is_withdrawable BOOLEAN DEFAULT FALSE, -- 固定为 FALSE（不可提现）
    status VARCHAR(20) DEFAULT 'settled', -- 'settled'=已结算
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 确保索引存在
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON public.commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_from_user_id ON public.commissions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_order_id ON public.commissions(order_id);

-- 3. share_logs 表（新建）
CREATE TABLE IF NOT EXISTS public.share_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    share_type VARCHAR(50) DEFAULT 'activation', -- 'activation'=激活分享
    share_target VARCHAR(100), -- 'telegram_group' 等
    shared_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Telegram Mini App 分享API返回的信息
    share_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_share_logs_user_id ON public.share_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_share_logs_shared_at ON public.share_logs(shared_at);

-- 4. system_config 表（新增佣金配置）
CREATE TABLE IF NOT EXISTS public.system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入佣金配置
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

-- 5. RPC: add_bonus_balance（增加夺宝币余额）
CREATE OR REPLACE FUNCTION public.add_bonus_balance(
    p_user_id UUID,
    p_amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET bonus_balance = COALESCE(bonus_balance, 0) + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: exchange_real_to_bonus_balance（单向兑换：余额 -> 夺宝币）
CREATE OR REPLACE FUNCTION public.exchange_real_to_bonus_balance(
    p_user_id UUID,
    p_amount DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    real_wallet_id UUID;
    bonus_wallet_id UUID;
    current_real_balance DECIMAL;
BEGIN
    -- 1. 检查余额是否足够
    SELECT id, balance INTO real_wallet_id, current_real_balance
    FROM public.wallets
    WHERE user_id = p_user_id AND currency = 'TJS' AND is_bonus = FALSE;

    IF current_real_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient real balance';
    END IF;

    -- 2. 获取目标夺宝币钱包
    SELECT id INTO bonus_wallet_id
    FROM public.wallets
    WHERE user_id = p_user_id AND currency = 'TJS' AND is_bonus = TRUE;

    -- 3. 扣除真实余额
    UPDATE public.wallets
    SET balance = balance - p_amount,
        updated_at = NOW()
    WHERE id = real_wallet_id;

    -- 4. 增加夺宝币余额
    UPDATE public.wallets
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE id = bonus_wallet_id;

    -- 5. 记录交易日志 (可选，此处省略)

    -- 6. 返回新的夺宝币余额
    SELECT balance INTO current_real_balance
    FROM public.wallets
    WHERE id = bonus_wallet_id;

    RETURN current_real_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: get_user_referral_stats（更新统计 RPC 以包含 bonus_balance）
-- 假设原有的 get_user_referral_stats 已经存在，这里提供一个更新版本
CREATE OR REPLACE FUNCTION public.get_user_referral_stats(p_user_id UUID)
RETURNS TABLE (
    total_referrals BIGINT,
    level1_referrals BIGINT,
    level2_referrals BIGINT,
    level3_referrals BIGINT,
    total_commission DECIMAL,
    pending_commission DECIMAL,
    bonus_balance DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE referral_tree AS (
        SELECT id, invited_by, 1 as level
        FROM public.profiles
        WHERE invited_by = p_user_id
        UNION ALL
        SELECT p.id, p.invited_by, rt.level + 1
        FROM public.profiles p
        JOIN referral_tree rt ON p.invited_by = rt.id
        WHERE rt.level < 3
    ),
    commission_summary AS (
        SELECT
            c.user_id,
            SUM(c.commission_amount) AS total_commission,
            SUM(CASE WHEN c.status = 'pending' THEN c.commission_amount ELSE 0 END) AS pending_commission
        FROM public.commissions c
        WHERE c.user_id = p_user_id
        GROUP BY c.user_id
    )
    SELECT
        (SELECT COUNT(*) FROM referral_tree) AS total_referrals,
        (SELECT COUNT(*) FROM referral_tree WHERE level = 1) AS level1_referrals,
        (SELECT COUNT(*) FROM referral_tree WHERE level = 2) AS level2_referrals,
        (SELECT COUNT(*) FROM referral_tree WHERE level = 3) AS level3_referrals,
        COALESCE(cs.total_commission, 0) AS total_commission,
        COALESCE(cs.pending_commission, 0) AS pending_commission,
        COALESCE(p.bonus_balance, 0) AS bonus_balance
    FROM public.profiles p
    LEFT JOIN commission_summary cs ON p.id = cs.user_id
    WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
