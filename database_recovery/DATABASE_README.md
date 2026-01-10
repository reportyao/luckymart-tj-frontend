# LuckyMart-TJ 完整数据库恢复包

> 版本: v4.0 (最终完整版)
> 更新时间: 2026-01-10
> 验证状态: ✅ 全部通过

---

## 概述

本恢复包包含 LuckyMart-TJ 项目的完整数据库结构，包括：

- **PostgreSQL 数据库结构** (表、索引、函数、触发器、RLS策略)
- **Supabase Edge Functions** (66个 TypeScript 函数)
- **Cron Jobs 配置** (定时任务)
- **初始配置数据** (佣金设置、转盘奖池等)

---

## 文件清单

| 文件/目录 | 说明 |
|-----------|------|
| `LUCKYMART_TJ_COMPLETE_DATABASE.sql` | **完整数据库恢复脚本** (3199行) |
| `DATABASE_TABLES_LIST.md` | 数据库表和函数清单 (70个表, 37个函数) |
| `EDGE_FUNCTIONS_LIST.md` | Edge Functions 清单 (66个函数) |
| `VERIFICATION_REPORT.md` | 详细验证报告 |
| `edge_functions/` | 完整的 Edge Functions 源代码 |
| `migrations/` | 27个原始迁移文件 |
| `SUPPLEMENT_MISSING_TABLES.sql` | 补充的遗漏表 |
| `SUPPLEMENT_MISSING_FUNCTIONS.sql` | 补充的遗漏函数 |

---

## 统计信息

| 类别 | 数量 |
|------|------|
| **数据表** | **70** |
| **索引** | **202** |
| **PostgreSQL 函数** | **37** |
| **触发器** | **10** |
| **枚举类型** | **4** |
| **视图** | **2** |
| **Edge Functions** | **66** |
| **共享模块** | **3** |
| **SQL总行数** | **3199** |

---

## 使用方法

### 1. 恢复 PostgreSQL 数据库

```sql
-- 在 Supabase SQL Editor 中执行
-- 复制 LUCKYMART_TJ_COMPLETE_DATABASE.sql 的全部内容并执行
```

**注意事项：**
- 建议在空数据库中执行
- 脚本使用 `IF NOT EXISTS` 和 `CREATE OR REPLACE` 确保幂等性
- 如果已有数据，建议先备份

### 2. 部署 Edge Functions

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 链接项目
supabase link --project-ref YOUR_PROJECT_REF

# 部署所有 Edge Functions
cd edge_functions
supabase functions deploy --all
```

### 3. 配置 Cron Jobs

在 Supabase SQL Editor 中执行以下迁移文件：
- `migrations/setup_cron_job.sql` - 抽奖开奖定时任务
- `migrations/setup_group_buy_timeout_cron.sql` - 拼团超时检查

**注意：** 需要替换 SQL 中的 Supabase URL 和 Service Role Key

### 4. 配置环境变量

在 Supabase Dashboard > Edge Functions > Secrets 中配置：

| 变量名 | 说明 |
|--------|------|
| SUPABASE_URL | 项目 URL |
| SUPABASE_SERVICE_ROLE_KEY | Service Role Key |
| TELEGRAM_BOT_TOKEN | Telegram Bot Token |

---

## 验证清单

执行恢复后，请验证以下内容：

### PostgreSQL 数据库

- [ ] 表数量: 70个
- [ ] 函数数量: 37个
- [ ] 索引数量: 202个
- [ ] 触发器数量: 10个

### Edge Functions

- [ ] 函数数量: 66个
- [ ] 所有函数状态为 ACTIVE

### 功能测试

- [ ] 用户认证 (auth-telegram)
- [ ] 抽奖购买 (lottery-purchase)
- [ ] 充值提现 (deposit-request, withdraw-request)
- [ ] 转盘抽奖 (spin-lottery)

---

## 数据来源

本恢复包整合了以下所有数据来源：

| 来源 | 说明 |
|------|------|
| GitHub luckymart-tj-frontend | 27个迁移文件 + 66个Edge Functions |
| GitHub luckymart-tj-admin | 3个SQL文件 |
| 测试服务器 (47.82.78.182) | 已部署代码 |
| 用户提供的恢复数据库 | 26个迁移文件 |
| Supabase 测试环境 | 66个已部署Edge Functions |
| database.types.ts | TypeScript 类型定义 |

---

## 数据库架构概览

```
LuckyMart-TJ Database (70个表)
├── 用户系统 (7表)
│   ├── users, user_profiles, user_sessions
│   ├── wallets, wallet_transactions
│   ├── bot_user_settings, referrals
│
├── 商品系统 (3表)
│   ├── products, inventory_products
│   └── inventory_transactions
│
├── 抽奖系统 (4表)
│   ├── lotteries, lottery_entries
│   ├── tickets, lottery_results
│
├── 奖品系统 (3表)
│   ├── prizes, pickup_points, pickup_logs
│
├── 订单系统 (3表)
│   ├── orders, full_purchase_orders, transactions
│
├── 拼团系统 (4表)
│   ├── group_buy_products, group_buy_sessions
│   ├── group_buy_orders, group_buy_results
│
├── 物流批次系统 (2表)
│   ├── shipment_batches, batch_order_items
│
├── 发货系统 (5表)
│   ├── shipping, shipping_requests
│   ├── shipping_records, shipping_history
│   └── shipping_addresses
│
├── 金融系统 (8表)
│   ├── deposit_requests, deposits
│   ├── withdrawal_requests, withdrawals
│   ├── payment_config, payment_methods
│   ├── payment_configs, exchange_records
│
├── 佣金系统 (4表)
│   ├── commissions, commission_settings
│   ├── commission_withdrawals, share_logs
│
├── 转盘系统 (4表)
│   ├── user_spin_balance, spin_rewards
│   ├── spin_records, invite_rewards
│
├── 社交系统 (8表)
│   ├── showoffs, showoff_posts
│   ├── showoff_comments, showoff_likes
│   ├── likes, notifications
│   ├── notification_queue
│
├── 二手市场 (3表)
│   ├── resales, resale_items, market_listings
│
├── 系统管理 (10表)
│   ├── admin_users, admin_audit_logs
│   ├── audit_logs, role_permissions
│   ├── monitoring_alerts, system_configs
│   ├── system_config, banners
│   ├── draw_algorithms, draw_logs
│
└── Bot系统 (3表)
    ├── bot_sessions, bot_messages
    └── bot_command_stats
```

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-01-09 | 初始版本 (67表, 24函数) |
| v2.0 | 2026-01-10 | 补充遗漏的表 (70表) |
| v3.0 | 2026-01-10 | 补充遗漏的函数 (37个) |
| v4.0 | 2026-01-10 | 添加 Edge Functions (66个) |

---

## 技术支持

如有问题，请参考：
- `VERIFICATION_REPORT.md` - 详细验证报告
- `DATABASE_TABLES_LIST.md` - 完整表和函数清单
- `EDGE_FUNCTIONS_LIST.md` - Edge Functions 详细说明
