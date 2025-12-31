-- ============================================
-- 转盘抽奖裂变功能数据库迁移 (修正版)
-- users.id 是 TEXT 类型，所以外键引用也使用 TEXT
-- ============================================

-- 1. 用户抽奖次数表
CREATE TABLE IF NOT EXISTS user_spin_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    spin_count INT NOT NULL DEFAULT 0,
    total_earned INT NOT NULL DEFAULT 0,
    total_used INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_spin_balance_user_id ON user_spin_balance(user_id);

-- 2. 转盘奖池配置表
CREATE TABLE IF NOT EXISTS spin_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reward_name VARCHAR(100) NOT NULL,
    reward_name_i18n JSONB,
    reward_type VARCHAR(50) NOT NULL DEFAULT 'LUCKY_COIN',
    reward_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    probability DECIMAL(8,5) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_jackpot BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spin_rewards_active ON spin_rewards(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_spin_rewards_order ON spin_rewards(display_order);

-- 3. 抽奖记录表
CREATE TABLE IF NOT EXISTS spin_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    reward_id UUID REFERENCES spin_rewards(id),
    reward_name VARCHAR(100),
    reward_type VARCHAR(50),
    reward_amount DECIMAL(10,2) DEFAULT 0,
    is_winner BOOLEAN DEFAULT false,
    spin_source VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spin_records_user_id ON spin_records(user_id);
CREATE INDEX IF NOT EXISTS idx_spin_records_created_at ON spin_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spin_records_is_winner ON spin_records(is_winner) WHERE is_winner = true;

-- 4. 邀请奖励记录表
CREATE TABLE IF NOT EXISTS invite_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id TEXT NOT NULL,
    invitee_id TEXT NOT NULL,
    reward_type VARCHAR(50) NOT NULL,
    spin_count_awarded INT DEFAULT 0,
    lucky_coins_awarded DECIMAL(10,2) DEFAULT 0,
    is_processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(inviter_id, invitee_id, reward_type)
);

CREATE INDEX IF NOT EXISTS idx_invite_rewards_inviter_id ON invite_rewards(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invite_rewards_invitee_id ON invite_rewards(invitee_id);
CREATE INDEX IF NOT EXISTS idx_invite_rewards_type ON invite_rewards(reward_type);

-- 5. 插入默认奖池配置
INSERT INTO spin_rewards (reward_name, reward_name_i18n, reward_type, reward_amount, probability, display_order, is_active, is_jackpot)
VALUES 
    ('100积分', '{"zh": "100积分", "ru": "100 баллов", "tg": "100 хол"}', 'LUCKY_COIN', 100, 0.00100, 0, true, true),
    ('10积分', '{"zh": "10积分", "ru": "10 баллов", "tg": "10 хол"}', 'LUCKY_COIN', 10, 0.15000, 1, true, false),
    ('5积分', '{"zh": "5积分", "ru": "5 баллов", "tg": "5 хол"}', 'LUCKY_COIN', 5, 0.25000, 2, true, false),
    ('1积分', '{"zh": "1积分", "ru": "1 балл", "tg": "1 хол"}', 'LUCKY_COIN', 1, 0.30000, 3, true, false),
    ('0.5积分', '{"zh": "0.5积分", "ru": "0.5 балла", "tg": "0.5 хол"}', 'LUCKY_COIN', 0.5, 0.29900, 4, true, false),
    ('谢谢惠顾', '{"zh": "谢谢惠顾", "ru": "Спасибо!", "tg": "Ташаккур!"}', 'NONE', 0, 0.00000, 5, true, false)
ON CONFLICT DO NOTHING;

-- 6. RLS 策略
ALTER TABLE user_spin_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE spin_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE spin_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own spin balance" ON user_spin_balance;
CREATE POLICY "Users can view their own spin balance" ON user_spin_balance FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage spin balance" ON user_spin_balance;
CREATE POLICY "Service role can manage spin balance" ON user_spin_balance FOR ALL USING (true);

DROP POLICY IF EXISTS "Everyone can view active spin rewards" ON spin_rewards;
CREATE POLICY "Everyone can view active spin rewards" ON spin_rewards FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Users can view their own spin records" ON spin_records;
CREATE POLICY "Users can view their own spin records" ON spin_records FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage spin records" ON spin_records;
CREATE POLICY "Service role can manage spin records" ON spin_records FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can view their own invite rewards" ON invite_rewards;
CREATE POLICY "Users can view their own invite rewards" ON invite_rewards FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage invite rewards" ON invite_rewards;
CREATE POLICY "Service role can manage invite rewards" ON invite_rewards FOR ALL USING (true);

-- 7. 触发器
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

-- 8. 辅助函数：增加用户抽奖次数
CREATE OR REPLACE FUNCTION add_user_spin_count(
    p_user_id TEXT,
    p_count INT,
    p_source VARCHAR(50) DEFAULT 'manual'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_count INT;
BEGIN
    INSERT INTO user_spin_balance (user_id, spin_count, total_earned)
    VALUES (p_user_id, p_count, p_count)
    ON CONFLICT (user_id) DO UPDATE SET
        spin_count = user_spin_balance.spin_count + p_count,
        total_earned = user_spin_balance.total_earned + p_count,
        updated_at = NOW();
    
    SELECT spin_count INTO v_new_count
    FROM user_spin_balance
    WHERE user_id = p_user_id;
    
    RETURN v_new_count;
END;
$$;

-- 9. 辅助函数：扣减用户抽奖次数
CREATE OR REPLACE FUNCTION deduct_user_spin_count(
    p_user_id TEXT,
    p_count INT DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_count INT;
BEGIN
    SELECT spin_count INTO v_current_count
    FROM user_spin_balance
    WHERE user_id = p_user_id;
    
    IF v_current_count IS NULL OR v_current_count < p_count THEN
        RETURN FALSE;
    END IF;
    
    UPDATE user_spin_balance
    SET spin_count = spin_count - p_count,
        total_used = total_used + p_count,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN TRUE;
END;
$$;

-- 10. 辅助函数：增加用户积分
CREATE OR REPLACE FUNCTION add_user_lucky_coins(
    p_user_id TEXT,
    p_amount DECIMAL(10,2),
    p_description VARCHAR(255) DEFAULT '转盘抽奖奖励'
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id UUID;
    v_current_balance DECIMAL(10,2);
    v_new_balance DECIMAL(10,2);
BEGIN
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM wallets
    WHERE user_id = p_user_id
      AND type::TEXT = 'LUCKY_COIN'
    LIMIT 1;
    
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION '未找到用户积分钱包';
    END IF;
    
    UPDATE wallets
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
    
    SELECT balance INTO v_new_balance
    FROM wallets
    WHERE id = v_wallet_id;
    
    INSERT INTO wallet_transactions (
        wallet_id,
        type,
        amount,
        balance_before,
        balance_after,
        description,
        status,
        created_at
    ) VALUES (
        v_wallet_id,
        'SPIN_REWARD',
        p_amount,
        v_current_balance,
        v_new_balance,
        p_description,
        'COMPLETED',
        NOW()
    );
    
    RETURN v_new_balance;
END;
$$;
