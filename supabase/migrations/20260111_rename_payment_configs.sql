-- 将 payment_configs 表重命名为 payment_config
-- 根据项目架构文档，正确的表名应该是 payment_config (单数)

-- 检查 payment_configs 表是否存在，如果存在则重命名
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_configs'
  ) THEN
    -- 重命名表
    ALTER TABLE payment_configs RENAME TO payment_config;
    
    -- 更新相关的索引名称
    ALTER INDEX IF EXISTS payment_configs_pkey RENAME TO payment_config_pkey;
    ALTER INDEX IF EXISTS idx_payment_configs_config_type RENAME TO idx_payment_config_config_type;
    ALTER INDEX IF EXISTS idx_payment_configs_is_enabled RENAME TO idx_payment_config_is_enabled;
    
    -- 更新相关的约束名称
    ALTER TABLE payment_config RENAME CONSTRAINT payment_configs_config_key_key TO payment_config_config_key_key;
    
    RAISE NOTICE 'Table payment_configs renamed to payment_config successfully';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_config'
  ) THEN
    RAISE NOTICE 'Table payment_config already exists, no action needed';
  ELSE
    RAISE NOTICE 'Neither payment_configs nor payment_config table exists';
  END IF;
END $$;

-- 确保 payment_config 表存在且结构正确
CREATE TABLE IF NOT EXISTS payment_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_type VARCHAR(20) NOT NULL CHECK (config_type IN ('DEPOSIT', 'WITHDRAW')),
  config_data JSONB NOT NULL DEFAULT '{}',
  name VARCHAR(255),
  type VARCHAR(50),
  provider VARCHAR(255),
  config JSONB,
  name_i18n JSONB DEFAULT '{}',
  description_i18n JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_payment_config_config_type ON payment_config(config_type);
CREATE INDEX IF NOT EXISTS idx_payment_config_is_enabled ON payment_config(is_enabled);
CREATE INDEX IF NOT EXISTS idx_payment_config_sort_order ON payment_config(sort_order);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_payment_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_config_updated_at ON payment_config;
CREATE TRIGGER trigger_update_payment_config_updated_at
  BEFORE UPDATE ON payment_config
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_config_updated_at();

-- 添加注释
COMMENT ON TABLE payment_config IS '支付配置表 - 管理充值和提现的支付方式配置';
COMMENT ON COLUMN payment_config.config_key IS '配置唯一标识，如 alif_bank_deposit';
COMMENT ON COLUMN payment_config.config_type IS '配置类型：DEPOSIT(充值) 或 WITHDRAW(提现)';
COMMENT ON COLUMN payment_config.config_data IS '配置详情JSON，包含账号、限额等信息';
COMMENT ON COLUMN payment_config.is_enabled IS '是否启用该支付方式';
COMMENT ON COLUMN payment_config.sort_order IS '排序权重，数字越小越靠前';
