-- Fix group_buy tables structure
-- Ensure all required tables and fields exist

-- Create group_buy_products table if not exists
CREATE TABLE IF NOT EXISTS group_buy_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title JSONB NOT NULL DEFAULT '{}',
  description JSONB DEFAULT '{}',
  image_url TEXT,
  image_urls TEXT[] DEFAULT '{}',
  original_price DECIMAL(10,2) NOT NULL,
  price_per_person DECIMAL(10,2) NOT NULL,
  min_participants INTEGER NOT NULL DEFAULT 2,
  max_participants INTEGER NOT NULL DEFAULT 10,
  time_limit_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DELETED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create group_buy_sessions table if not exists
CREATE TABLE IF NOT EXISTS group_buy_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code TEXT UNIQUE NOT NULL,
  product_id UUID NOT NULL REFERENCES group_buy_products(id) ON DELETE CASCADE,
  current_participants INTEGER DEFAULT 0,
  max_participants INTEGER NOT NULL,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUCCESS', 'TIMEOUT', 'CANCELLED')),
  winner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Create group_buy_orders table if not exists
CREATE TABLE IF NOT EXISTS group_buy_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES group_buy_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'REFUNDED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create group_buy_results table if not exists
CREATE TABLE IF NOT EXISTS group_buy_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES group_buy_sessions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES group_buy_products(id) ON DELETE CASCADE,
  winner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winning_code TEXT,
  logistics_status TEXT DEFAULT 'PENDING_SHIPMENT',
  batch_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_group_buy_sessions_product_id ON group_buy_sessions(product_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_sessions_status ON group_buy_sessions(status);
CREATE INDEX IF NOT EXISTS idx_group_buy_orders_session_id ON group_buy_orders(session_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_orders_user_id ON group_buy_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_results_winner_id ON group_buy_results(winner_id);

-- Enable RLS
ALTER TABLE group_buy_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_buy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_buy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_buy_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view active products" ON group_buy_products
  FOR SELECT USING (status = 'ACTIVE');

CREATE POLICY "Everyone can view sessions" ON group_buy_sessions
  FOR SELECT USING (true);

CREATE POLICY "Users can view their own orders" ON group_buy_orders
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own results" ON group_buy_results
  FOR SELECT USING (auth.uid()::text = winner_id::text);

COMMENT ON TABLE group_buy_products IS 'Group buy products catalog';
COMMENT ON TABLE group_buy_sessions IS 'Active group buy sessions';
COMMENT ON TABLE group_buy_orders IS 'User orders in group buy sessions';
COMMENT ON TABLE group_buy_results IS 'Group buy winners and results';
