# 数据库Schema迁移文档

**日期**: 2026年1月11日  
**版本**: v1.0.0  
**项目**: LuckyMart-TJ

## 概述

本次迁移主要解决了数据库schema与代码不匹配的问题。通过在数据库中添加缺失的字段，确保所有Edge Functions能够正常运行，同时保持原有业务逻辑完整（如乐观锁、冻结余额等功能）。

## 迁移内容

### 1. wallets 表

添加以下字段以支持钱包高级功能：

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| version | INTEGER | 1 | 乐观锁版本号，用于并发控制 |
| frozen_balance | DECIMAL(20,8) | 0 | 冻结余额，用于提现等待处理 |
| total_withdrawals | DECIMAL(20,8) | 0 | 累计提现总额 |

### 2. wallet_transactions 表

添加以下字段以支持交易关联和追踪：

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| processed_at | TIMESTAMPTZ | NULL | 交易处理时间 |
| related_id | TEXT | NULL | 通用关联ID |
| related_order_id | UUID | NULL | 关联订单ID |
| related_lottery_id | UUID | NULL | 关联抽奖ID |

### 3. lottery_entries 表

添加以下字段以支持抽奖票据管理：

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| status | VARCHAR(50) | 'ACTIVE' | 票据状态 |
| numbers | VARCHAR(20) | NULL | 抽奖号码 |
| purchase_price | DECIMAL(20,8) | NULL | 购买价格 |

### 4. group_buy_sessions 表

添加以下字段以支持拼团功能：

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| session_code | VARCHAR(50) | NULL | 拼团会话码 |
| group_size | INTEGER | NULL | 拼团人数 |

### 5. group_buy_orders 表

添加以下字段以支持拼团订单管理：

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| refunded_at | TIMESTAMPTZ | NULL | 退款时间 |
| refund_amount | DECIMAL(20,8) | NULL | 退款金额 |
| refund_lucky_coins | DECIMAL(20,8) | NULL | 退还积分 |
| product_id | UUID | NULL | 商品ID |

### 6. prizes 表

添加以下字段以支持奖品订单类型：

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| order_type | VARCHAR(50) | NULL | 订单类型 |
| order_number | VARCHAR(100) | NULL | 订单编号 |

### 7. notifications 表

添加以下字段以支持通知功能：

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| content | TEXT | NULL | 通知内容 |
| related_id | TEXT | NULL | 关联ID |
| related_type | TEXT | NULL | 关联类型 |
| updated_at | TIMESTAMPTZ | NULL | 更新时间 |

### 8. withdrawal_requests 表

添加以下字段以支持提现请求管理：

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| order_number | VARCHAR(100) | NULL | 订单号 |
| transfer_reference | TEXT | NULL | 转账参考号 |
| transfer_proof_images | JSONB | NULL | 转账凭证图片 |
| failure_reason | TEXT | NULL | 失败原因 |
| estimated_arrival | TIMESTAMPTZ | NULL | 预计到账时间 |

### 9. showoffs 表

添加以下字段以支持晒单功能：

| 字段名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| rejected_reason | TEXT | NULL | 拒绝原因 |
| approved_at | TIMESTAMPTZ | NULL | 审核通过时间 |

## 性能优化索引

创建以下索引以提高查询性能：

```sql
CREATE INDEX idx_lottery_entries_status ON lottery_entries(status);
CREATE INDEX idx_wallet_transactions_related_order_id ON wallet_transactions(related_order_id);
CREATE INDEX idx_wallet_transactions_related_lottery_id ON wallet_transactions(related_lottery_id);
CREATE INDEX idx_wallets_version ON wallets(version);
```

## Edge Functions 部署

本次共部署了70个Edge Functions到Supabase，涵盖以下业务模块：

### 核心业务模块

| 模块 | 函数数量 | 主要功能 |
|------|----------|----------|
| 用户认证 | 1 | Telegram登录认证 |
| 钱包交易 | 8 | 充值、提现、余额兑换、交易记录 |
| 抽奖系统 | 6 | 购票、开奖、中奖查询 |
| 拼团系统 | 4 | 创建拼团、加入拼团、开奖、超时处理 |
| 物流系统 | 8 | 批次管理、发货、到货确认 |
| 自提系统 | 4 | 领奖、自提点管理 |
| 积分商城 | 3 | 转盘抽奖、积分兑换 |
| 佣金系统 | 3 | 佣金计算、批量发放 |
| 通知系统 | 4 | 站内通知、Telegram推送 |
| 管理后台 | 12 | 用户管理、财务管理、数据统计 |
| 其他功能 | 17 | AI客服、晒单、二手市场等 |

## 回滚方案

如需回滚，可执行以下SQL删除新增字段：

```sql
-- wallets表
ALTER TABLE wallets DROP COLUMN IF EXISTS version;
ALTER TABLE wallets DROP COLUMN IF EXISTS frozen_balance;
ALTER TABLE wallets DROP COLUMN IF EXISTS total_withdrawals;

-- wallet_transactions表
ALTER TABLE wallet_transactions DROP COLUMN IF EXISTS processed_at;
ALTER TABLE wallet_transactions DROP COLUMN IF EXISTS related_id;
ALTER TABLE wallet_transactions DROP COLUMN IF EXISTS related_order_id;
ALTER TABLE wallet_transactions DROP COLUMN IF EXISTS related_lottery_id;

-- lottery_entries表
ALTER TABLE lottery_entries DROP COLUMN IF EXISTS status;
ALTER TABLE lottery_entries DROP COLUMN IF EXISTS numbers;
ALTER TABLE lottery_entries DROP COLUMN IF EXISTS purchase_price;

-- 其他表类似...
```

## 注意事项

1. 所有新增字段都设置了合理的默认值，不会影响现有数据
2. 乐观锁（version字段）需要在并发更新时正确使用
3. frozen_balance用于提现流程，需要在提现申请时冻结，完成后释放
4. 建议在生产环境部署前进行充分测试

## 联系方式

如有问题，请联系开发团队。
