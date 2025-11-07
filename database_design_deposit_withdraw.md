# 充值提现兑换功能 - 数据库表设计

## 1. deposit_requests (充值申请表)

```sql
CREATE TYPE DepositStatus AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE DepositMethod AS ENUM ('ALIF_MOBI', 'DC_BANK', 'OTHER');

CREATE TABLE deposit_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  order_number TEXT NOT NULL UNIQUE, -- 订单号 LM{timestamp}
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'TJS',
  payment_method DepositMethod NOT NULL,
  
  -- 用户提交的支付凭证
  payment_proof_images JSONB, -- 转账截图URLs数组
  payment_reference TEXT, -- 转账参考号/备注
  payer_name TEXT, -- 付款人姓名
  payer_account TEXT, -- 付款账号
  
  -- 审核信息
  status DepositStatus NOT NULL DEFAULT 'PENDING',
  admin_id TEXT REFERENCES users(id), -- 审核管理员
  admin_note TEXT, -- 审核备注
  reviewed_at TIMESTAMP,
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 索引
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_deposit_requests_user_id ON deposit_requests(user_id);
CREATE INDEX idx_deposit_requests_status ON deposit_requests(status);
CREATE INDEX idx_deposit_requests_created_at ON deposit_requests(created_at DESC);
```

## 2. withdrawal_requests (提现申请表)

```sql
CREATE TYPE WithdrawalStatus AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED');
CREATE TYPE WithdrawalMethod AS ENUM ('BANK_TRANSFER', 'ALIF_MOBI', 'DC_BANK', 'OTHER');

CREATE TABLE withdrawal_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  order_number TEXT NOT NULL UNIQUE, -- 订单号 WD{timestamp}
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'TJS',
  withdrawal_method WithdrawalMethod NOT NULL,
  
  -- 银行卡信息
  bank_name TEXT, -- 银行名称
  bank_account_number TEXT, -- 银行账号
  bank_account_name TEXT, -- 账户名
  bank_branch TEXT, -- 支行
  
  -- 身份信息
  id_card_number TEXT, -- 身份证号
  id_card_name TEXT, -- 身份证姓名
  phone_number TEXT, -- 手机号
  
  -- Alif Mobi / DC Bank 信息
  mobile_wallet_number TEXT, -- 手机钱包号码
  mobile_wallet_name TEXT, -- 钱包账户名
  
  -- 审核信息
  status WithdrawalStatus NOT NULL DEFAULT 'PENDING',
  admin_id TEXT REFERENCES users(id), -- 审核管理员
  admin_note TEXT, -- 审核备注
  reviewed_at TIMESTAMP,
  
  -- 转账凭证
  transfer_proof_images JSONB, -- 转账截图URLs数组
  transfer_reference TEXT, -- 转账参考号
  completed_at TIMESTAMP,
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 索引
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawal_requests_created_at ON withdrawal_requests(created_at DESC);
```

## 3. exchange_records (兑换记录表)

```sql
CREATE TYPE ExchangeType AS ENUM ('BALANCE_TO_COIN', 'COIN_TO_BALANCE');

CREATE TABLE exchange_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  exchange_type ExchangeType NOT NULL,
  
  -- 兑换金额
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'TJS',
  
  -- 兑换比例 (默认1:1)
  exchange_rate NUMERIC(10, 4) NOT NULL DEFAULT 1.0,
  
  -- 源钱包和目标钱包
  source_wallet_id TEXT NOT NULL REFERENCES wallets(id),
  target_wallet_id TEXT NOT NULL REFERENCES wallets(id),
  
  -- 兑换前后余额
  source_balance_before NUMERIC(15, 2) NOT NULL,
  source_balance_after NUMERIC(15, 2) NOT NULL,
  target_balance_before NUMERIC(15, 2) NOT NULL,
  target_balance_after NUMERIC(15, 2) NOT NULL,
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 索引
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_exchange_records_user_id ON exchange_records(user_id);
CREATE INDEX idx_exchange_records_created_at ON exchange_records(created_at DESC);
```

## 4. payment_config (支付配置表)

```sql
CREATE TABLE payment_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) NOT NULL UNIQUE, -- 配置键名
  config_type VARCHAR(50) NOT NULL, -- 配置类型: DEPOSIT, WITHDRAWAL
  
  -- 配置内容 (JSON格式)
  config_data JSONB NOT NULL,
  /* 
  示例结构:
  {
    "method": "ALIF_MOBI",
    "enabled": true,
    "account_number": "+992 XX XXX XX XX",
    "account_name": "LuckyMart TJ",
    "instructions": {
      "zh": "请转账到以下账号...",
      "ru": "Пожалуйста, переведите на следующий счет...",
      "tg": "Лутфан ба ҳисоби зерин пул фиристед..."
    },
    "min_amount": 10,
    "max_amount": 10000,
    "fee_rate": 0,
    "processing_time": "15分钟内"
  }
  */
  
  -- 是否启用
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- 排序
  sort_order INTEGER NOT NULL DEFAULT 0,
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_config_type ON payment_config(config_type);
CREATE INDEX idx_payment_config_enabled ON payment_config(is_enabled);
```

## 5. 更新 wallet_transactions 表

需要添加新的交易类型:

```sql
-- 添加新的交易类型
ALTER TYPE TransactionType ADD VALUE IF NOT EXISTS 'DEPOSIT_APPROVED';
ALTER TYPE TransactionType ADD VALUE IF NOT EXISTS 'WITHDRAWAL_APPROVED';
ALTER TYPE TransactionType ADD VALUE IF NOT EXISTS 'EXCHANGE_IN';
ALTER TYPE TransactionType ADD VALUE IF NOT EXISTS 'EXCHANGE_OUT';
```

## 数据库迁移SQL

```sql
-- 创建枚举类型
CREATE TYPE DepositStatus AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE DepositMethod AS ENUM ('ALIF_MOBI', 'DC_BANK', 'OTHER');
CREATE TYPE WithdrawalStatus AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED');
CREATE TYPE WithdrawalMethod AS ENUM ('BANK_TRANSFER', 'ALIF_MOBI', 'DC_BANK', 'OTHER');
CREATE TYPE ExchangeType AS ENUM ('BALANCE_TO_COIN', 'COIN_TO_BALANCE');

-- 创建充值申请表
CREATE TABLE deposit_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL UNIQUE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'TJS',
  payment_method DepositMethod NOT NULL,
  payment_proof_images JSONB,
  payment_reference TEXT,
  payer_name TEXT,
  payer_account TEXT,
  status DepositStatus NOT NULL DEFAULT 'PENDING',
  admin_id TEXT REFERENCES users(id),
  admin_note TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deposit_requests_user_id ON deposit_requests(user_id);
CREATE INDEX idx_deposit_requests_status ON deposit_requests(status);
CREATE INDEX idx_deposit_requests_created_at ON deposit_requests(created_at DESC);

-- 创建提现申请表
CREATE TABLE withdrawal_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL UNIQUE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'TJS',
  withdrawal_method WithdrawalMethod NOT NULL,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  bank_branch TEXT,
  id_card_number TEXT,
  id_card_name TEXT,
  phone_number TEXT,
  mobile_wallet_number TEXT,
  mobile_wallet_name TEXT,
  status WithdrawalStatus NOT NULL DEFAULT 'PENDING',
  admin_id TEXT REFERENCES users(id),
  admin_note TEXT,
  reviewed_at TIMESTAMP,
  transfer_proof_images JSONB,
  transfer_reference TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawal_requests_created_at ON withdrawal_requests(created_at DESC);

-- 创建兑换记录表
CREATE TABLE exchange_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange_type ExchangeType NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'TJS',
  exchange_rate NUMERIC(10, 4) NOT NULL DEFAULT 1.0,
  source_wallet_id TEXT NOT NULL REFERENCES wallets(id),
  target_wallet_id TEXT NOT NULL REFERENCES wallets(id),
  source_balance_before NUMERIC(15, 2) NOT NULL,
  source_balance_after NUMERIC(15, 2) NOT NULL,
  target_balance_before NUMERIC(15, 2) NOT NULL,
  target_balance_after NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exchange_records_user_id ON exchange_records(user_id);
CREATE INDEX idx_exchange_records_created_at ON exchange_records(created_at DESC);

-- 创建支付配置表
CREATE TABLE payment_config (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_type VARCHAR(50) NOT NULL,
  config_data JSONB NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_config_type ON payment_config(config_type);
CREATE INDEX idx_payment_config_enabled ON payment_config(is_enabled);

-- 插入默认支付配置
INSERT INTO payment_config (config_key, config_type, config_data, is_enabled, sort_order) VALUES
('deposit_alif_mobi', 'DEPOSIT', '{
  "method": "ALIF_MOBI",
  "enabled": true,
  "account_number": "+992 XX XXX XX XX",
  "account_name": "LuckyMart TJ",
  "instructions": {
    "zh": "请按照以下步骤完成充值:\n1. 打开Alif Mobi应用\n2. 转账到账号: +992 XX XXX XX XX\n3. 备注填写您的订单号\n4. 完成转账后上传截图",
    "ru": "Пожалуйста, выполните следующие шаги для пополнения:\n1. Откройте приложение Alif Mobi\n2. Переведите на счет: +992 XX XXX XX XX\n3. В примечании укажите номер заказа\n4. После перевода загрузите скриншот",
    "tg": "Лутфан барои пурра кардани ҳисоб қадамҳои зеринро иҷро кунед:\n1. Барномаи Alif Mobi-ро кушоед\n2. Ба ҳисоби зерин пул фиристед: +992 XX XXX XX XX\n3. Дар қайд рақами фармоиши худро нависед\n4. Пас аз гузаронидан скриншот бор кунед"
  },
  "min_amount": 10,
  "max_amount": 10000,
  "fee_rate": 0,
  "processing_time": "15"
}', true, 1),
('deposit_dc_bank', 'DEPOSIT', '{
  "method": "DC_BANK",
  "enabled": true,
  "bank_name": "Dushanbe City Bank",
  "account_number": "XXXXXXXXXXXXXXXX",
  "account_name": "LuckyMart TJ LLC",
  "instructions": {
    "zh": "请按照以下步骤完成充值:\n1. 通过银行转账\n2. 银行: Dushanbe City Bank\n3. 账号: XXXXXXXXXXXXXXXX\n4. 户名: LuckyMart TJ LLC\n5. 完成转账后上传截图",
    "ru": "Пожалуйста, выполните следующие шаги для пополнения:\n1. Банковский перевод\n2. Банк: Dushanbe City Bank\n3. Счет: XXXXXXXXXXXXXXXX\n4. Получатель: LuckyMart TJ LLC\n5. После перевода загрузите скриншот",
    "tg": "Лутфан барои пурра кардани ҳисоб қадамҳои зеринро иҷро кунед:\n1. Тавассути банк пул фиристед\n2. Банк: Dushanbe City Bank\n3. Ҳисоб: XXXXXXXXXXXXXXXX\n4. Гирандаи пул: LuckyMart TJ LLC\n5. Пас аз гузаронидан скриншот бор кунед"
  },
  "min_amount": 50,
  "max_amount": 50000,
  "fee_rate": 0,
  "processing_time": "30"
}', true, 2);
```

## 表关系说明

1. **deposit_requests** → users: 多对一 (一个用户可以有多个充值申请)
2. **withdrawal_requests** → users: 多对一 (一个用户可以有多个提现申请)
3. **exchange_records** → users: 多对一 (一个用户可以有多个兑换记录)
4. **exchange_records** → wallets: 多对一 (关联源钱包和目标钱包)
5. **payment_config**: 独立配置表,不依赖其他表

## 业务流程

### 充值流程
1. 用户提交充值申请 → deposit_requests (status=PENDING)
2. 管理员审核 → 更新 status=APPROVED/REJECTED
3. 如果APPROVED → 增加用户钱包余额 + 创建wallet_transaction记录

### 提现流程
1. 用户提交提现申请 → withdrawal_requests (status=PENDING)
2. 检查用户余额是否足够 → 冻结金额
3. 管理员审核 → 更新 status=APPROVED/REJECTED
4. 如果APPROVED → 扣除用户钱包余额 + 创建wallet_transaction记录
5. 管理员完成转账 → 更新 status=COMPLETED

### 兑换流程
1. 用户发起兑换 → 检查源钱包余额
2. 扣除源钱包金额 + 增加目标钱包金额
3. 创建exchange_records记录
4. 创建两条wallet_transaction记录 (EXCHANGE_OUT + EXCHANGE_IN)
