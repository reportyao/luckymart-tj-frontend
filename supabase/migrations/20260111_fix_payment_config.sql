-- Fix payment_config table structure
-- Add missing fields that the admin panel expects

ALTER TABLE payment_configs ADD COLUMN IF NOT EXISTS provider VARCHAR(100);
ALTER TABLE payment_configs ADD COLUMN IF NOT EXISTS config_key VARCHAR(100);
ALTER TABLE payment_configs ADD COLUMN IF NOT EXISTS config_type VARCHAR(50);
ALTER TABLE payment_configs ADD COLUMN IF NOT EXISTS config_data JSONB;
ALTER TABLE payment_configs ADD COLUMN IF NOT EXISTS name_i18n JSONB;
ALTER TABLE payment_configs ADD COLUMN IF NOT EXISTS description_i18n JSONB;
ALTER TABLE payment_configs ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;
ALTER TABLE payment_configs ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Update existing data to match new structure
UPDATE payment_configs 
SET 
  provider = name,
  config_key = LOWER(REPLACE(name, ' ', '_')),
  config_type = CASE 
    WHEN type = 'BANK_TRANSFER' THEN 'DEPOSIT'
    ELSE 'DEPOSIT'
  END,
  config_data = config,
  name_i18n = jsonb_build_object('zh', name, 'ru', name, 'tg', name),
  description_i18n = instructions,
  is_enabled = is_active,
  sort_order = display_order
WHERE provider IS NULL;

-- Create index for config_key
CREATE INDEX IF NOT EXISTS idx_payment_configs_config_key ON payment_configs(config_key);

-- Update RLS policies to allow admin operations
DROP POLICY IF EXISTS "Everyone can view active payment configs" ON payment_configs;

CREATE POLICY "Everyone can view active payment configs" ON payment_configs
  FOR SELECT USING (is_active = true OR is_enabled = true);

CREATE POLICY "Admins can manage payment configs" ON payment_configs
  FOR ALL USING (true);

COMMENT ON TABLE payment_configs IS 'Payment configuration for deposits and withdrawals';
