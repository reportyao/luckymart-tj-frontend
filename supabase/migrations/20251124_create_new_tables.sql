-- ============================================
-- 创建新的业务表
-- 创建时间: 2025-11-24
-- 描述: 创建payment_methods, commission_settings, draw_algorithms, draw_logs表
-- ============================================

-- 1. 创建 payment_methods 表（支付方式配置）
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL, -- 'BANK_TRANSFER', 'ALIPAY', 'WECHAT'
  bank_name_i18n JSONB NOT NULL DEFAULT '{"zh": "", "ru": "", "tg": ""}'::jsonb,
  branch_name_i18n JSONB DEFAULT '{"zh": "", "ru": "", "tg": ""}'::jsonb,
  transfer_note_i18n JSONB DEFAULT '{"zh": "", "ru": "", "tg": ""}'::jsonb,
  account_name VARCHAR(100),
  account_number VARCHAR(100),
  bank_code VARCHAR(20),
  processing_time_minutes INTEGER DEFAULT 30,
  min_amount NUMERIC(10,2) DEFAULT 0,
  max_amount NUMERIC(10,2) DEFAULT 999999.99,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_active ON payment_methods(is_active);

COMMENT ON TABLE payment_methods IS '支付方式配置表';
COMMENT ON COLUMN payment_methods.bank_name_i18n IS '银行名称（多语言）';
COMMENT ON COLUMN payment_methods.branch_name_i18n IS '支行名称（多语言）';
COMMENT ON COLUMN payment_methods.transfer_note_i18n IS '转账备注说明（多语言）';

-- 2. 创建 commission_settings 表（返利比例配置）
CREATE TABLE IF NOT EXISTS commission_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level INTEGER NOT NULL UNIQUE CHECK (level >= 1 AND level <= 3), -- 1, 2, 3
  rate NUMERIC(5,4) NOT NULL CHECK (rate >= 0 AND rate <= 1), -- 0.1000 = 10%
  description_i18n JSONB DEFAULT '{"zh": "", "ru": "", "tg": ""}'::jsonb,
  trigger_condition VARCHAR(50) DEFAULT 'any_purchase', -- 'first_deposit', 'first_purchase', 'any_purchase'
  min_payout_amount NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_settings_level ON commission_settings(level);
CREATE INDEX IF NOT EXISTS idx_commission_settings_is_active ON commission_settings(is_active);

COMMENT ON TABLE commission_settings IS '返利比例配置表';
COMMENT ON COLUMN commission_settings.level IS '邀请层级：1=一级，2=二级，3=三级';
COMMENT ON COLUMN commission_settings.rate IS '返利比例，0.1表示10%';

-- 插入默认配置
INSERT INTO commission_settings (level, rate, description_i18n, is_active)
VALUES 
  (1, 0.1000, '{"zh": "一级邀请返利10%", "ru": "Реферал 1-го уровня 10%", "tg": "Рефералӣ дараҷаи 1 10%"}'::jsonb, true),
  (2, 0.0500, '{"zh": "二级邀请返利5%", "ru": "Реферал 2-го уровня 5%", "tg": "Рефералӣ дараҷаи 2 5%"}'::jsonb, true),
  (3, 0.0200, '{"zh": "三级邀请返利2%", "ru": "Реферал 3-го уровня 2%", "tg": "Рефералӣ дараҷаи 3 2%"}'::jsonb, true)
ON CONFLICT (level) DO NOTHING;

-- 3. 创建 draw_algorithms 表（开奖算法配置）
CREATE TABLE IF NOT EXISTS draw_algorithms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name_i18n JSONB NOT NULL DEFAULT '{"zh": "", "ru": "", "tg": ""}'::jsonb,
  description_i18n JSONB DEFAULT '{"zh": "", "ru": "", "tg": ""}'::jsonb,
  formula_i18n JSONB DEFAULT '{"zh": "", "ru": "", "tg": ""}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draw_algorithms_name ON draw_algorithms(name);
CREATE INDEX IF NOT EXISTS idx_draw_algorithms_is_active ON draw_algorithms(is_active);
CREATE INDEX IF NOT EXISTS idx_draw_algorithms_is_default ON draw_algorithms(is_default);

COMMENT ON TABLE draw_algorithms IS '开奖算法配置表';

-- 插入默认算法
INSERT INTO draw_algorithms (name, display_name_i18n, description_i18n, formula_i18n, is_default, is_active)
VALUES 
  (
    'SHA256_TIMESTAMP_MOD',
    '{"zh": "标准时间戳算法", "ru": "Стандартный алгоритм временных меток", "tg": "Алгоритми стандартии тамғаи вақт"}'::jsonb,
    '{"zh": "基于所有订单时间戳的SHA256哈希求和取模", "ru": "На основе SHA256 хеша временных меток всех заказов", "tg": "Дар асоси хеши SHA256 тамғаҳои вақти ҳамаи фармоишҳо"}'::jsonb,
    '{"zh": "中奖号码 = SHA256(所有订单时间戳之和) % 总份数 + 1", "ru": "Выигрышный номер = SHA256(сумма временных меток) % общее количество + 1", "tg": "Рақами бурд = SHA256(ҷамъи тамғаҳои вақт) % миқдори умумӣ + 1"}'::jsonb,
    true,
    true
  ),
  (
    'VRF',
    '{"zh": "VRF可验证随机算法", "ru": "VRF проверяемый случайный алгоритм", "tg": "Алгоритми тасодуфии санҷидашавандаи VRF"}'::jsonb,
    '{"zh": "使用可验证随机函数生成可证明公平的随机数", "ru": "Использует проверяемую случайную функцию для генерации доказуемо честных случайных чисел", "tg": "Истифодаи функсияи тасодуфии санҷидашаванда барои тавлиди рақамҳои тасодуфии исботшаванда"}'::jsonb,
    '{"zh": "中奖号码 = VRF(种子 + 所有订单数据) % 总份数 + 1", "ru": "Выигрышный номер = VRF(seed + данные заказов) % общее количество + 1", "tg": "Рақами бурд = VRF(тухм + маълумоти фармоишҳо) % миқдори умумӣ + 1"}'::jsonb,
    false,
    false
  )
ON CONFLICT (name) DO NOTHING;

-- 4. 创建 draw_logs 表（开奖记录）
CREATE TABLE IF NOT EXISTS draw_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lottery_id UUID NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
  algorithm_name VARCHAR(50) NOT NULL,
  input_data JSONB NOT NULL,
  calculation_steps JSONB,
  winning_number INTEGER NOT NULL,
  winner_user_id UUID REFERENCES users(id),
  winner_order_id UUID REFERENCES orders(id),
  vrf_seed TEXT,
  vrf_proof TEXT,
  draw_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draw_logs_lottery_id ON draw_logs(lottery_id);
CREATE INDEX IF NOT EXISTS idx_draw_logs_algorithm_name ON draw_logs(algorithm_name);
CREATE INDEX IF NOT EXISTS idx_draw_logs_draw_time ON draw_logs(draw_time DESC);
CREATE INDEX IF NOT EXISTS idx_draw_logs_winner_user_id ON draw_logs(winner_user_id);

COMMENT ON TABLE draw_logs IS '开奖记录表';
COMMENT ON COLUMN draw_logs.input_data IS '开奖输入数据（所有订单信息）';
COMMENT ON COLUMN draw_logs.calculation_steps IS '计算过程的每一步';
COMMENT ON COLUMN draw_logs.vrf_seed IS 'VRF算法的种子';
COMMENT ON COLUMN draw_logs.vrf_proof IS 'VRF算法的证明';

-- 5. 创建 shipping_records 表（物流记录）
CREATE TABLE IF NOT EXISTS shipping_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prize_id UUID NOT NULL REFERENCES prizes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  recipient_name VARCHAR(100) NOT NULL,
  recipient_phone VARCHAR(50) NOT NULL,
  shipping_address TEXT NOT NULL,
  tracking_number VARCHAR(100),
  shipping_company VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'shipped', 'delivered', 'cancelled'
  notes TEXT,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_records_prize_id ON shipping_records(prize_id);
CREATE INDEX IF NOT EXISTS idx_shipping_records_user_id ON shipping_records(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_records_status ON shipping_records(status);

COMMENT ON TABLE shipping_records IS '物流记录表';
