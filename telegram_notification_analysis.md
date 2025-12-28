# Telegram通知系统现状分析

## 执行时间
2025-12-28 06:35 UTC

---

## 📊 现有实现情况

### 1. Edge Functions

#### 已存在的Telegram相关函数
| 函数名 | 用途 | 状态 |
|--------|------|------|
| `telegram-notification-sender` | 通知队列处理器 | ✅ 已实现 |
| `telegram-bot-webhook` | Bot Webhook处理 | ✅ 已实现 |
| `telegram-bot-manager` | Bot管理 | ✅ 已实现 |
| `telegram-bot-cron` | 定时调用通知发送器 | ✅ 已实现 |
| `auth-telegram` | Telegram登录认证 | ✅ 已实现 |

#### ⚠️ 缺失的函数
- `send-telegram-notification` - 代码中多处调用但**不存在**!

---

### 2. 数据库表结构

#### `notification_queue` 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | text | 主键 |
| user_id | text | 用户ID |
| telegram_chat_id | bigint | Telegram Chat ID |
| notification_type | varchar | 通知类型 |
| title | varchar | 标题 |
| message | text | 消息内容 |
| data | jsonb | 附加数据 |
| priority | integer | 优先级 |
| scheduled_at | timestamp | 计划发送时间 |
| sent_at | timestamp | 实际发送时间 |
| status | varchar | 状态(pending/sent/failed/cancelled) |
| error_message | text | 错误信息 |
| retry_count | integer | 重试次数 |
| max_retries | integer | 最大重试次数 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

---

### 3. 现有通知模板

#### 已实现的通知类型

**夺宝(Lottery)相关**:
- ✅ `lottery_win` - 中奖通知
- ✅ `lottery_lost` - 未中奖通知
- ✅ `lottery_draw_soon` - 即将开奖提醒

**钱包(Wallet)相关**:
- ✅ `wallet_deposit` - 充值成功
- ✅ `wallet_withdraw_pending` - 提现审核中
- ✅ `wallet_withdraw_completed` - 提现完成

**推荐(Referral)相关**:
- ✅ `referral_reward` - 推荐奖励

**系统(System)相关**:
- ✅ `system_maintenance` - 系统维护
- ✅ `system_update` - 功能更新

#### ❌ 缺失的通知类型
- `group_buy_win` - 拼团中奖
- `group_buy_refund` - 拼团未中奖退款
- `wallet_withdraw_failed` - 提现失败

---

### 4. 多语言支持

#### 已支持的语言
- ✅ `zh` - 中文
- ✅ `ru` - 俄语
- ✅ `tg` - 塔吉克语

#### 语言选择逻辑
- 从 `bot_user_settings.language_code` 读取用户语言偏好
- 默认语言: 中文 (zh)

---

### 5. 通知发送流程

#### 当前流程
```
1. 业务逻辑触发 → 调用 supabase.functions.invoke('send-telegram-notification')
2. ⚠️ send-telegram-notification 函数不存在!
3. 应该插入到 notification_queue 表
4. telegram-bot-cron 定时调用 telegram-notification-sender
5. telegram-notification-sender 从队列读取并发送
```

#### ⚠️ 问题
- **关键函数缺失**: `send-telegram-notification` 不存在
- 代码中多处调用但无法执行
- 需要创建该函数来接收通知请求并入队

---

### 6. 代码调用位置

#### 拼团功能
- `group-buy-draw/index.ts` (第192行, 第210行)
  - 中奖通知: `GROUP_BUY_WIN`
  - 未中奖通知: `GROUP_BUY_REFUND`

- `group-buy-timeout-check/index.ts` (第139行)
  - 超时退款通知

#### 其他功能
- `handle-purchase-commission/index.ts` (第122行)
  - 使用 `sendTelegramMessage` 共享函数

---

### 7. 共享工具函数

#### `_shared/sendTelegramMessage.ts`
- ✅ 提供基础的Telegram消息发送功能
- ✅ 支持多语言
- ⚠️ 仅支持3种通知类型:
  - `commission_earned`
  - `purchase_success`
  - `first_deposit_bonus`
- ⚠️ 功能有限,不支持拼团/夺宝/充值提现

---

## 🔍 问题总结

### 关键问题
1. ❌ **`send-telegram-notification` 函数不存在** - 代码多处调用但未实现
2. ⚠️ **拼团通知模板缺失** - `telegram-notification-sender` 中没有拼团相关模板
3. ⚠️ **提现失败通知缺失** - 只有pending和completed,没有failed
4. ⚠️ **Bot Token未配置** - 环境变量 `TELEGRAM_BOT_TOKEN` 需要设置

### 需要开发的功能
1. 创建 `send-telegram-notification` Edge Function
2. 添加拼团通知模板到 `telegram-notification-sender`
3. 添加提现失败通知模板
4. 配置Bot Token环境变量
5. 实现实时推送(WebSocket/SSE)

---

## 📋 开发计划

### Phase 1: 修复现有问题
1. 创建 `send-telegram-notification` Edge Function
2. 添加拼团相关通知模板
3. 添加提现失败通知模板
4. 配置Bot Token

### Phase 2: 集成到业务流程
1. 验证拼团开奖通知
2. 验证充值/提现通知
3. 验证夺宝开奖通知

### Phase 3: 实时推送
1. 实现WebSocket/SSE服务
2. 前端集成实时通知
3. 测试实时推送功能

---

## 🎯 下一步行动

1. 创建 `send-telegram-notification` Edge Function
2. 更新 `telegram-notification-sender` 添加拼团模板
3. 配置环境变量
4. 部署并测试

