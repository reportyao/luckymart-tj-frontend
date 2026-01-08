-- Create deposits table
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'TJS',
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  payment_method VARCHAR(50),
  payment_proof_url TEXT,
  payer_name VARCHAR(100),
  payer_phone VARCHAR(20),
  payer_account VARCHAR(100),
  notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'TJS',
  bank_name VARCHAR(100) NOT NULL,
  account_holder VARCHAR(100) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED')),
  transaction_id VARCHAR(100),
  notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payment_configs table
CREATE TABLE IF NOT EXISTS payment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('BANK_TRANSFER', 'MOBILE_MONEY', 'CRYPTO', 'OTHER')),
  currency VARCHAR(3) DEFAULT 'TJS',
  config JSONB NOT NULL DEFAULT '{}',
  instructions JSONB,
  min_amount DECIMAL(10,2) DEFAULT 10.00,
  max_amount DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposits(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON withdrawals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_configs_active ON payment_configs(is_active) WHERE is_active = true;

-- Add RLS policies for deposits
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deposits" ON deposits
  FOR SELECT USING (auth.uid()::text = user_id::text OR EXISTS (
    SELECT 1 FROM user_sessions WHERE user_id = deposits.user_id AND session_token = current_setting('request.jwt.claims', true)::json->>'session_token'
  ));

CREATE POLICY "Users can create their own deposits" ON deposits
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text OR EXISTS (
    SELECT 1 FROM user_sessions WHERE user_id = deposits.user_id AND session_token = current_setting('request.jwt.claims', true)::json->>'session_token'
  ));

-- Add RLS policies for withdrawals
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own withdrawals" ON withdrawals
  FOR SELECT USING (auth.uid()::text = user_id::text OR EXISTS (
    SELECT 1 FROM user_sessions WHERE user_id = withdrawals.user_id AND session_token = current_setting('request.jwt.claims', true)::json->>'session_token'
  ));

CREATE POLICY "Users can create their own withdrawals" ON withdrawals
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text OR EXISTS (
    SELECT 1 FROM user_sessions WHERE user_id = withdrawals.user_id AND session_token = current_setting('request.jwt.claims', true)::json->>'session_token'
  ));

-- Add RLS policies for payment_configs
ALTER TABLE payment_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active payment configs" ON payment_configs
  FOR SELECT USING (is_active = true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON deposits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_configs_updated_at BEFORE UPDATE ON payment_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default payment config
INSERT INTO payment_configs (name, type, currency, config, instructions, min_amount, max_amount, is_active, display_order)
VALUES (
  'Bank Transfer (TJS)',
  'BANK_TRANSFER',
  'TJS',
  '{"bank_name": "Amonatbank", "account_number": "1234567890", "account_holder": "LuckyMart TJ"}',
  '{
    "zh": "请转账到以下银行账户，并上传转账凭证",
    "ru": "Пожалуйста, переведите на следующий банковский счет и загрузите подтверждение",
    "tg": "Лутфан ба ҳисоби бонкии зерин пул гузаронед ва тасдиқномаро бор кунед"
  }',
  10.00,
  10000.00,
  true,
  1
) ON CONFLICT DO NOTHING;
