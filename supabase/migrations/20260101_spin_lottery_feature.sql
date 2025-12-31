-- ============================================
-- 转盘抽奖裂变功能数据库迁移
-- 创建时间: 2026-01-01
-- 功能说明:
--   1. 用户抽奖次数表 (user_spin_balance)
--   2. 转盘奖池配置表 (spin_rewards)
--   3. 抽奖记录表 (spin_records)
--   4. 邀请奖励记录表 (invite_rewards)
-- ============================================

-- ============================================
-- 1. 用户抽奖次数表
-- 说明: 存储用户的抽奖次数余额
-- ============================================
CREATE TABLE IF NOT EXISTS user_spin_balance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spin_count INT NOT NULL DEFAULT 0,  -- 当前可用抽奖次数
    total_earned INT NOT NULL DEFAULT 0, -- 累计获得的抽奖次数
    total_used INT NOT NULL DEFAULT 0,   -- 累计使用的抽奖次数
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_spin_balance_user_id ON user_spin_balance(user_id);

-- 添加注释
COMMENT ON TABLE user_spin_balance IS '用户抽奖次数余额表';
COMMENT ON COLUMN user_spin_balance.spin_count IS '当前可用抽奖次数';
COMMENT ON COLUMN user_spin_balance.total_earned IS '累计获得的抽奖次数（邀请奖励、拼团奖励等）';
COMMENT ON COLUMN user_spin_balance.total_used IS '累计使用的抽奖次数';

-- ============================================
-- 2. 转盘奖池配置表
-- 说明: 存储转盘各奖项的配置（概率、奖励金额等）
-- ============================================
CREATE TABLE IF NOT EXISTS spin_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reward_name VARCHAR(100) NOT NULL,           -- 奖项名称
    reward_name_i18n JSONB,                      -- 多语言名称 {"zh": "100积分", "ru": "100 баллов", "tg": "100 хол"}
    reward_type VARCHAR(50) NOT NULL DEFAULT 'LUCKY_COIN', -- 奖励类型: LUCKY_COIN(积分), NONE(谢谢惠顾)
    reward_amount DECIMAL(10,2) NOT NULL DEFAULT 0,  -- 奖励金额
    probability DECIMAL(8,5) NOT NULL,           -- 中奖概率 (0.00001 = 0.001%)
    display_order INT NOT NULL DEFAULT 0,        -- 在转盘上的显示顺序 (0-5, 共6格)
    is_active BOOLEAN DEFAULT true,              -- 是否启用
    is_jackpot BOOLEAN DEFAULT false,            -- 是否为大奖（用于UI高亮显示）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_spin_rewards_active ON spin_rewards(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_spin_rewards_order ON spin_rewards(display_order);

-- 添加注释
COMMENT ON TABLE spin_rewards IS '转盘奖池配置表';
COMMENT ON COLUMN spin_rewards.reward_name IS '奖项名称（默认语言）';
COMMENT ON COLUMN spin_rewards.reward_name_i18n IS '奖项多语言名称 JSON';
COMMENT ON COLUMN spin_rewards.reward_type IS '奖励类型: LUCKY_COIN=积分, NONE=谢谢惠顾';
COMMENT ON COLUMN spin_rewards.reward_amount IS '奖励金额（积分数量）';
COMMENT ON COLUMN spin_rewards.probability IS '中奖概率，所有奖项概率之和应为1';
COMMENT ON COLUMN spin_rewards.display_order IS '在转盘上的显示位置（0-5）';
COMMENT ON COLUMN spin_rewards.is_jackpot IS '是否为大奖，用于UI特殊显示';

-- ============================================
-- 3. 抽奖记录表
-- 说明: 记录每次抽奖的详细信息
-- ============================================
CREATE TABLE IF NOT EXISTS spin_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id UUID REFERENCES spin_rewards(id),  -- 中奖的奖项ID
    reward_name VARCHAR(100),                    -- 奖项名称（冗余存储）
    reward_type VARCHAR(50),                     -- 奖励类型
    reward_amount DECIMAL(10,2) DEFAULT 0,       -- 奖励金额
    is_winner BOOLEAN DEFAULT false,             -- 是否中奖（非"谢谢惠顾"）
    spin_source VARCHAR(50),                     -- 抽奖次数来源: invite_reward, group_buy_reward, admin_grant
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_spin_records_user_id ON spin_records(user_id);
CREATE INDEX IF NOT EXISTS idx_spin_records_created_at ON spin_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spin_records_is_winner ON spin_records(is_winner) WHERE is_winner = true;

-- 添加注释
COMMENT ON TABLE spin_records IS '抽奖记录表';
COMMENT ON COLUMN spin_records.reward_id IS '中奖的奖项配置ID';
COMMENT ON COLUMN spin_records.reward_name IS '奖项名称（冗余存储，防止配置变更影响历史记录）';
COMMENT ON COLUMN spin_records.is_winner IS '是否中奖（true=获得积分，false=谢谢惠顾）';
COMMENT ON COLUMN spin_records.spin_source IS '抽奖次数来源：invite_reward=邀请奖励, group_buy_reward=拼团奖励';

-- ============================================
-- 4. 邀请奖励记录表
-- 说明: 记录邀请奖励的发放情况
-- ============================================
CREATE TABLE IF NOT EXISTS invite_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 邀请人ID
    invitee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 被邀请人ID
    reward_type VARCHAR(50) NOT NULL,            -- 奖励类型: new_user_register, first_group_buy
    spin_count_awarded INT DEFAULT 0,            -- 奖励的抽奖次数
    lucky_coins_awarded DECIMAL(10,2) DEFAULT 0, -- 奖励的积分（给被邀请人的新人礼）
    is_processed BOOLEAN DEFAULT false,          -- 是否已处理
    processed_at TIMESTAMPTZ,                    -- 处理时间
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(inviter_id, invitee_id, reward_type)  -- 防止重复发放
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_invite_rewards_inviter_id ON invite_rewards(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invite_rewards_invitee_id ON invite_rewards(invitee_id);
CREATE INDEX IF NOT EXISTS idx_invite_rewards_type ON invite_rewards(reward_type);

-- 添加注释
COMMENT ON TABLE invite_rewards IS '邀请奖励记录表';
COMMENT ON COLUMN invite_rewards.inviter_id IS '邀请人用户ID';
COMMENT ON COLUMN invite_rewards.invitee_id IS '被邀请人用户ID';
COMMENT ON COLUMN invite_rewards.reward_type IS '奖励类型: new_user_register=新用户注册, first_group_buy=首次拼团';
COMMENT ON COLUMN invite_rewards.spin_count_awarded IS '奖励给邀请人的抽奖次数';
COMMENT ON COLUMN invite_rewards.lucky_coins_awarded IS '奖励给被邀请人的积分（新人礼）';

-- ============================================
-- 5. 插入默认奖池配置
-- 按需求文档配置:
--   100积分: 0.1% (display_order=0, 占最大空间)
--   10积分: 15%
--   5积分: 25%
--   1积分: 30%
--   0.5积分: 29.9%
--   谢谢惠顾: 0% (实际不会抽中，但需要显示在转盘上)
-- ============================================
INSERT INTO spin_rewards (reward_name, reward_name_i18n, reward_type, reward_amount, probability, display_order, is_active, is_jackpot)
VALUES 
    ('100积分', '{"zh": "100积分", "ru": "100 баллов", "tg": "100 хол"}', 'LUCKY_COIN', 100, 0.00100, 0, true, true),
    ('10积分', '{"zh": "10积分", "ru": "10 баллов", "tg": "10 хол"}', 'LUCKY_COIN', 10, 0.15000, 1, true, false),
    ('5积分', '{"zh": "5积分", "ru": "5 баллов", "tg": "5 хол"}', 'LUCKY_COIN', 5, 0.25000, 2, true, false),
    ('1积分', '{"zh": "1积分", "ru": "1 балл", "tg": "1 хол"}', 'LUCKY_COIN', 1, 0.30000, 3, true, false),
    ('0.5积分', '{"zh": "0.5积分", "ru": "0.5 балла", "tg": "0.5 хол"}', 'LUCKY_COIN', 0.5, 0.29900, 4, true, false),
    ('谢谢惠顾', '{"zh": "谢谢惠顾", "ru": "Спасибо!", "tg": "Ташаккур!"}', 'NONE', 0, 0.00000, 5, true, false)
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. RLS 策略
-- ============================================

-- user_spin_balance 表 RLS
ALTER TABLE user_spin_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own spin balance" ON user_spin_balance
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage spin balance" ON user_spin_balance
    FOR ALL USING (true);

-- spin_rewards 表 RLS
ALTER TABLE spin_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active spin rewards" ON spin_rewards
    FOR SELECT USING (is_active = true);

-- spin_records 表 RLS
ALTER TABLE spin_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own spin records" ON spin_records
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage spin records" ON spin_records
    FOR ALL USING (true);

-- invite_rewards 表 RLS
ALTER TABLE invite_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invite rewards" ON invite_rewards
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage invite rewards" ON invite_rewards
    FOR ALL USING (true);

-- ============================================
-- 7. 触发器：自动更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_spin_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_spin_balance_updated_at 
    BEFORE UPDATE ON user_spin_balance
    FOR EACH ROW EXECUTE FUNCTION update_spin_tables_updated_at();

CREATE TRIGGER update_spin_rewards_updated_at 
    BEFORE UPDATE ON spin_rewards
    FOR EACH ROW EXECUTE FUNCTION update_spin_tables_updated_at();

-- ============================================
-- 8. 辅助函数：增加用户抽奖次数
-- ============================================
CREATE OR REPLACE FUNCTION add_user_spin_count(
    p_user_id UUID,
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
    -- 插入或更新用户抽奖次数
    INSERT INTO user_spin_balance (user_id, spin_count, total_earned)
    VALUES (p_user_id, p_count, p_count)
    ON CONFLICT (user_id) DO UPDATE SET
        spin_count = user_spin_balance.spin_count + p_count,
        total_earned = user_spin_balance.total_earned + p_count,
        updated_at = NOW();
    
    -- 返回更新后的次数
    SELECT spin_count INTO v_new_count
    FROM user_spin_balance
    WHERE user_id = p_user_id;
    
    RETURN v_new_count;
END;
$$;

COMMENT ON FUNCTION add_user_spin_count IS '增加用户抽奖次数，返回更新后的总次数';

-- ============================================
-- 9. 辅助函数：扣减用户抽奖次数
-- ============================================
CREATE OR REPLACE FUNCTION deduct_user_spin_count(
    p_user_id UUID,
    p_count INT DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_count INT;
BEGIN
    -- 获取当前次数
    SELECT spin_count INTO v_current_count
    FROM user_spin_balance
    WHERE user_id = p_user_id;
    
    -- 检查次数是否足够
    IF v_current_count IS NULL OR v_current_count < p_count THEN
        RETURN FALSE;
    END IF;
    
    -- 扣减次数
    UPDATE user_spin_balance
    SET spin_count = spin_count - p_count,
        total_used = total_used + p_count,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION deduct_user_spin_count IS '扣减用户抽奖次数，返回是否成功';

-- ============================================
-- 10. 辅助函数：增加用户积分（LUCKY_COIN）
-- ============================================
CREATE OR REPLACE FUNCTION add_user_lucky_coins(
    p_user_id UUID,
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
    -- 获取用户的积分钱包
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM wallets
    WHERE user_id = p_user_id::TEXT
      AND type::TEXT = 'LUCKY_COIN'
    LIMIT 1;
    
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION '未找到用户积分钱包';
    END IF;
    
    -- 增加积分
    UPDATE wallets
    SET balance = balance + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
    
    -- 获取新余额
    SELECT balance INTO v_new_balance
    FROM wallets
    WHERE id = v_wallet_id;
    
    -- 记录交易
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

COMMENT ON FUNCTION add_user_lucky_coins IS '增加用户积分（LUCKY_COIN钱包），并记录交易';

-- ============================================
-- 完成迁移
-- ============================================
