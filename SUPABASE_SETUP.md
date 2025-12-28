# Supabase 配置说明

## 环境变量配置

管理后台需要配置以下Supabase环境变量才能正常运行：

### 必需的环境变量

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 如何获取这些变量

1. **登录Supabase控制台**
   - 访问 https://supabase.com
   - 登录你的账号

2. **选择或创建项目**
   - 如果还没有项目，点击"New Project"创建一个新项目
   - 选择你要使用的项目

3. **获取API凭证**
   - 在项目控制台中，点击左侧菜单的 "Settings" (设置)
   - 点击 "API" 选项卡
   - 找到以下信息：
     - **Project URL**: 这就是 `SUPABASE_URL`
     - **service_role key**: 这就是 `SUPABASE_SERVICE_ROLE_KEY`

### 在Manus平台配置

1. 打开管理后台的Management UI
2. 进入 Settings → Secrets 面板
3. 添加以下两个环境变量：
   - Key: `SUPABASE_URL`, Value: 你的Supabase项目URL
   - Key: `SUPABASE_SERVICE_ROLE_KEY`, Value: 你的service_role密钥

### 注意事项

⚠️ **重要安全提示**：
- `service_role` 密钥拥有完全的数据库访问权限，**绝对不要**在客户端代码中使用
- **不要**将这些密钥提交到Git仓库
- 只在服务器端代码中使用这些密钥

## 数据库表结构

管理后台依赖以下Supabase数据库表：

### 核心表

1. **users** - 用户表
   ```sql
   - id (uuid, primary key)
   - telegram_id (text)
   - telegram_username (text)
   - first_name (text)
   - referral_code (text)
   - balance (numeric)
   - lottery_coins (integer)
   - status (text) - ACTIVE, SUSPENDED, BANNED
   - created_at (timestamp)
   - updated_at (timestamp)
   ```

2. **lotteries** - 积分商城商品表
   ```sql
   - id (uuid, primary key)
   - title (text)
   - description (text)
   - period (text)
   - ticket_price (numeric)
   - total_tickets (integer)
   - sold_tickets (integer)
   - currency (text)
   - status (text) - DRAFT, ACTIVE, COMPLETED, CANCELLED
   - start_time (timestamp)
   - end_time (timestamp)
   - created_at (timestamp)
   - updated_at (timestamp)
   ```

3. **tickets** - 订单/购买记录表
   ```sql
   - id (uuid, primary key)
   - user_id (uuid, foreign key → users)
   - lottery_id (uuid, foreign key → lotteries)
   - winning_code (text)
   - quantity (integer)
   - total_amount (numeric)
   - currency (text)
   - is_winner (boolean)
   - created_at (timestamp)
   ```

4. **prizes** - 中奖记录表
   ```sql
   - id (uuid, primary key)
   - lottery_id (uuid, foreign key → lotteries)
   - user_id (uuid, foreign key → users)
   - prize_name (text)
   - prize_image (text)
   - winning_code (text)
   - created_at (timestamp)
   ```

5. **deposit_requests** - 充值申请表
   ```sql
   - id (uuid, primary key)
   - user_id (uuid, foreign key → users)
   - amount (numeric)
   - payment_method (text)
   - payment_proof (text)
   - status (text) - PENDING, APPROVED, REJECTED
   - admin_notes (text)
   - created_at (timestamp)
   - reviewed_at (timestamp)
   ```

6. **withdrawal_requests** - 提现申请表
   ```sql
   - id (uuid, primary key)
   - user_id (uuid, foreign key → users)
   - amount (numeric)
   - withdrawal_method (text)
   - account_info (text)
   - status (text) - PENDING, PROCESSING, COMPLETED, REJECTED
   - admin_notes (text)
   - created_at (timestamp)
   - processed_at (timestamp)
   ```

7. **shipping_requests** - 发货申请表
   ```sql
   - id (uuid, primary key)
   - prize_id (uuid, foreign key → prizes)
   - user_id (uuid, foreign key → users)
   - recipient_name (text)
   - recipient_phone (text)
   - recipient_address (text)
   - recipient_city (text)
   - recipient_country (text)
   - tracking_number (text)
   - shipping_company (text)
   - status (text) - PENDING, PROCESSING, SHIPPED, DELIVERED
   - requested_at (timestamp)
   - shipped_at (timestamp)
   ```

8. **showoffs** - 晒单表
   ```sql
   - id (uuid, primary key)
   - user_id (uuid, foreign key → users)
   - prize_id (uuid, foreign key → prizes)
   - content (text)
   - images (text[])
   - status (text) - PENDING, APPROVED, REJECTED
   - admin_notes (text)
   - created_at (timestamp)
   - reviewed_at (timestamp)
   ```

9. **resales** - 转售表
   ```sql
   - id (uuid, primary key)
   - seller_id (uuid, foreign key → users)
   - buyer_id (uuid, foreign key → users)
   - prize_id (uuid, foreign key → prizes)
   - price (numeric)
   - currency (text)
   - description (text)
   - status (text) - ACTIVE, SOLD, CANCELLED, EXPIRED
   - created_at (timestamp)
   - sold_at (timestamp)
   ```

10. **payment_configs** - 支付配置表
    ```sql
    - id (uuid, primary key)
    - payment_method (text)
    - is_enabled (boolean)
    - config (jsonb)
    - created_at (timestamp)
    - updated_at (timestamp)
    ```

### 创建表的SQL脚本

你可以在Supabase SQL Editor中运行以下脚本来创建所需的表结构。

**注意**：这只是示例结构，实际的表结构可能需要根据你的Telegram Mini App的具体需求进行调整。

```sql
-- 如果你的Telegram Mini App已经创建了这些表，请跳过此步骤
-- 这里只是提供参考结构
```

## 测试连接

配置完成后，重启开发服务器，检查控制台是否还有Supabase连接错误。

如果配置正确，服务器应该能够正常启动，不再显示 "Missing Supabase environment variables" 错误。

## 故障排查

### 问题：仍然显示 "Missing Supabase environment variables"

**解决方案**：
1. 确认环境变量已正确添加到 Settings → Secrets
2. 重启开发服务器（使用Management UI的Restart按钮）
3. 检查变量名是否完全匹配（区分大小写）

### 问题：API调用返回 401 或 403 错误

**解决方案**：
1. 确认使用的是 `service_role` 密钥，而不是 `anon` 密钥
2. 检查Supabase项目的RLS（Row Level Security）策略
3. 确认密钥没有过期或被重置

### 问题：找不到表或列

**解决方案**：
1. 确认Supabase数据库中已创建所需的表
2. 检查表名和列名是否与代码中的一致
3. 确认使用的是正确的Supabase项目

## 相关资源

- [Supabase官方文档](https://supabase.com/docs)
- [Supabase JavaScript客户端](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)
