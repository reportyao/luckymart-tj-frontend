# LuckyMart-TJ 数据库完整清单

> 版本: v3.0 (最终完整版 - 已全面验证)
> 更新时间: 2026-01-10
> 来源: GitHub 代码仓库 + 测试服务器 + 恢复数据库 整合验证

## 数据库统计

| 类别 | 数量 |
|------|------|
| **数据表** | **70** |
| **索引** | **202** |
| **函数/RPC** | **37** |
| **触发器** | **10** |
| **枚举类型** | **4** |
| **视图** | **2** |
| **SQL总行数** | **3199** |

---

## 验证状态

| 验证项 | 状态 |
|--------|------|
| database.types.ts 中的表 (43个) | ✅ 全部包含 |
| database.types.ts 中的函数 (15个) | ✅ 全部包含 |
| 迁移文件中的表 (32个) | ✅ 全部包含 |
| 迁移文件中的函数 (20个) | ✅ 全部包含 |
| Admin项目中的表 (14个) | ✅ 全部包含 |
| Admin项目中的函数 (9个) | ✅ 全部包含 |
| 恢复数据库中的表 | ✅ 全部包含 |
| 恢复数据库中的函数 (27个) | ✅ 全部包含 |

---

## 一、数据表清单 (70个)

### 1. 核心用户系统 (7表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 1 | users | 用户基本信息 |
| 2 | user_profiles | 用户详细资料 |
| 3 | user_sessions | 用户会话 |
| 4 | wallets | 用户钱包 |
| 5 | wallet_transactions | 钱包交易记录 |
| 6 | bot_user_settings | Bot用户设置 |
| 7 | referrals | 邀请关系 |

### 2. 商品和库存系统 (3表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 8 | products | 商品基础信息 |
| 9 | inventory_products | 库存商品 |
| 10 | inventory_transactions | 库存变动记录 |

### 3. 抽奖/一元购物系统 (4表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 11 | lotteries | 抽奖活动/一元购物 |
| 12 | lottery_entries | 抽奖参与记录 |
| 13 | tickets | 抽奖券记录 |
| 14 | lottery_results | 开奖结果 |

### 4. 中奖和奖品系统 (3表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 15 | prizes | 中奖记录 (含提货和物流字段) |
| 16 | pickup_points | 自提点 |
| 17 | pickup_logs | 提货日志 |

### 5. 订单系统 (3表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 18 | orders | 订单主表 |
| 19 | full_purchase_orders | 全款购买订单 |
| 20 | transactions | 通用交易记录 |

### 6. 拼团系统 (4表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 21 | group_buy_products | 拼团商品 |
| 22 | group_buy_sessions | 拼团会话 |
| 23 | group_buy_orders | 拼团订单 |
| 24 | group_buy_results | 拼团结果 |

### 7. 物流批次管理系统 (2表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 25 | shipment_batches | 发货批次 |
| 26 | batch_order_items | 批次订单关联 |

### 8. 发货和物流系统 (6表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 27 | shipping | 发货信息 |
| 28 | shipping_requests | 发货请求 |
| 29 | shipping_records | 物流记录 |
| 30 | shipping_history | 物流历史 |
| 31 | shipping_addresses | 收货地址 |

### 9. 金融系统 (8表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 32 | deposit_requests | 充值申请 |
| 33 | deposits | 充值记录 |
| 34 | withdrawal_requests | 提现申请 |
| 35 | withdrawals | 提现记录 |
| 36 | payment_config | 支付配置 |
| 37 | payment_methods | 支付方式 |
| 38 | payment_configs | 支付配置扩展 |
| 39 | exchange_records | 兑换记录 |

### 10. 推荐和佣金系统 (4表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 40 | commissions | 佣金流水 |
| 41 | commission_settings | 佣金配置 |
| 42 | commission_withdrawals | 佣金提现 |
| 43 | share_logs | 分享日志 |

### 11. 转盘抽奖系统 (4表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 44 | user_spin_balance | 用户抽奖次数 |
| 45 | spin_rewards | 转盘奖池配置 |
| 46 | spin_records | 抽奖记录 |
| 47 | invite_rewards | 邀请奖励记录 |

### 12. 社交系统 (8表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 48 | showoffs | 晒单动态 |
| 49 | showoff_posts | 晒单帖子 |
| 50 | showoff_comments | 晒单评论 |
| 51 | showoff_likes | 晒单点赞 |
| 52 | likes | 通用点赞 |
| 53 | notifications | 通知消息 |
| 54 | notification_queue | 通知队列 |

### 13. 二手市场 (3表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 55 | resales | 二手交易 |
| 56 | resale_items | 二手商品列表 |
| 57 | market_listings | 市场列表 |

### 14. 系统管理 (10表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 58 | admin_users | 管理员用户 |
| 59 | admin_audit_logs | 管理员审计日志 |
| 60 | audit_logs | 审计日志 |
| 61 | role_permissions | 角色权限 |
| 62 | monitoring_alerts | 系统监控警报 |
| 63 | system_configs | 系统配置 |
| 64 | system_config | 系统配置（简化版） |
| 65 | banners | 轮播图 |
| 66 | draw_algorithms | 开奖算法配置 |
| 67 | draw_logs | 开奖记录 |

### 15. Bot相关 (3表)

| 序号 | 表名 | 说明 |
|------|------|------|
| 68 | bot_sessions | Bot会话 |
| 69 | bot_messages | Bot消息 |
| 70 | bot_command_stats | Bot命令统计 |

---

## 二、函数/RPC清单 (37个)

### 1. 用户余额管理函数 (6个)

| 序号 | 函数名 | 说明 |
|------|--------|------|
| 1 | increment_user_balance | 增加用户余额 |
| 2 | decrement_user_balance | 减少用户余额 |
| 3 | increase_user_balance | 增加用户余额（Admin） |
| 4 | decrease_user_balance | 减少用户余额（Admin） |
| 5 | add_bonus_balance | 增加夺宝币余额 |
| 6 | exchange_real_to_bonus_balance | 余额兑换 |

### 2. 佣金管理函数 (5个)

| 序号 | 函数名 | 说明 |
|------|--------|------|
| 7 | increase_commission_balance | 增加佣金余额 |
| 8 | decrease_commission_balance | 减少佣金余额 |
| 9 | get_commission_settings | 获取佣金配置 |
| 10 | update_commission_settings | 更新佣金配置 |
| 11 | trigger_commission_for_exchange | 触发佣金计算 |

### 3. 抽奖购买函数 (4个)

| 序号 | 函数名 | 说明 |
|------|--------|------|
| 12 | place_lottery_order | 下单抽奖 |
| 13 | purchase_lottery_atomic | 购买抽奖券原子操作 |
| 14 | purchase_lottery_with_concurrency_control | 带并发控制的抽奖购买 |
| 15 | increment_sold_quantity | 增加已售数量 |

### 4. 开奖相关函数 (2个)

| 序号 | 函数名 | 说明 |
|------|--------|------|
| 16 | draw_lottery | 执行开奖 |
| 17 | auto_draw_lotteries | 自动开奖 |

### 5. 提现管理函数 (2个)

| 序号 | 函数名 | 说明 |
|------|--------|------|
| 18 | approve_withdrawal_request | 批准提现请求 |
| 19 | reject_withdrawal_request | 拒绝提现请求 |

### 6. 转盘抽奖函数 (3个)

| 序号 | 函数名 | 说明 |
|------|--------|------|
| 20 | add_user_spin_count | 增加用户抽奖次数 |
| 21 | deduct_user_spin_count | 扣减用户抽奖次数 |
| 22 | add_user_lucky_coins | 增加用户积分 |

### 7. 统计查询函数 (3个)

| 序号 | 函数名 | 说明 |
|------|--------|------|
| 23 | get_user_referral_stats | 获取用户推荐统计 |
| 24 | get_dashboard_stats | 获取仪表板统计 |
| 25 | get_revenue_by_day | 获取每日收入统计 |

### 8. 社交互动函数 (2个)

| 序号 | 函数名 | 说明 |
|------|--------|------|
| 26 | increment_likes_count | 增加点赞数 |
| 27 | decrement_likes_count | 减少点赞数 |

### 9. 批次管理函数 (3个)

| 序号 | 函数名 | 说明 |
|------|--------|------|
| 28 | generate_batch_no | 生成批次号 |
| 29 | update_batch_statistics | 更新批次统计 |
| 30 | trigger_update_batch_statistics | 批次统计触发器 |

### 10. 提货相关函数 (1个)

| 序号 | 函数名 | 说明 |
|------|--------|------|
| 31 | generate_pickup_code | 生成提货码 |

### 11. 触发器函数 (6个)

| 序号 | 函数名 | 说明 |
|------|--------|------|
| 32 | update_updated_at_column | 更新时间戳 |
| 33 | update_inventory_product_status | 更新库存状态 |
| 34 | update_inventory_products_updated_at | 库存商品更新时间 |
| 35 | update_shipment_batches_updated_at | 发货批次更新时间 |
| 36 | update_batch_order_items_updated_at | 批次订单更新时间 |
| 37 | update_spin_tables_updated_at | 转盘表更新时间 |

---

## 三、视图列表 (2个)

| 序号 | 视图名 | 说明 |
|------|--------|------|
| 1 | batch_statistics | 批次统计视图 |
| 2 | batch_sku_summary | SKU统计视图 |

---

## 四、枚举类型列表 (4个)

| 序号 | 枚举名 | 说明 |
|------|--------|------|
| 1 | WalletType | 钱包类型 (TJS, LUCKY_COIN) |
| 2 | TransactionType | 交易类型 |
| 3 | CommissionStatus | 佣金状态 |
| 4 | CommissionType | 佣金类型 |

---

## 五、触发器列表 (10个)

| 序号 | 触发器名 | 关联表 |
|------|----------|--------|
| 1 | trigger_update_batch_order_items_updated_at | batch_order_items |
| 2 | trigger_update_shipment_batches_updated_at | shipment_batches |
| 3 | trigger_update_inventory_products_updated_at | inventory_products |
| 4 | update_user_spin_balance_updated_at | user_spin_balance |
| 5 | update_spin_rewards_updated_at | spin_rewards |
| 6 | update_spin_records_updated_at | spin_records |
| 7 | update_invite_rewards_updated_at | invite_rewards |
| 8 | trigger_update_batch_statistics | batch_order_items |
| 9 | trigger_inventory_status | inventory_products |
| 10 | update_*_updated_at | 多个表 |

---

## 六、使用说明

1. 此文件整合了所有来源的数据库结构
2. 包含完整的表、索引、函数、触发器和RLS策略
3. 可直接在 Supabase SQL Editor 中执行
4. 建议在空数据库中执行，避免冲突
5. 脚本使用 `IF NOT EXISTS` 确保幂等性
