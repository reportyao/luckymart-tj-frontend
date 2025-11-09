# LuckyMart 管理后台集成指南

本项目现已包含完整的用户前端和管理后台。

## 项目结构

```
luckymart-tj-frontend/
├── src/
│   ├── pages/              # 所有页面（用户页面 + 管理后台页面）
│   ├── components/         # UI组件（包括DashboardLayout）
│   ├── lib/               # 库文件（包括tRPC客户端）
│   ├── App.tsx            # 主应用路由（已包含管理后台路由）
│   └── main.tsx
├── server/                # 后端服务器代码
│   ├── routers.ts         # tRPC路由定义
│   ├── db.ts              # 数据库查询助手
│   ├── supabase.ts        # Supabase配置
│   └── _core/             # 核心框架代码
├── drizzle/               # 数据库schema和迁移
├── supabase/              # Supabase Edge Functions
└── package.json           # 项目依赖

```

## 功能模块

### 用户前端功能
- 首页 (HomePage)
- 夺宝 (LotteryPage)
- 钱包 (WalletPage)
- 订单 (OrderPage)
- 晒单 (ShowoffPage)
- 转售市场 (MarketPage)
- 个人资料 (ProfilePage)
- 充值/提现 (DepositPage, WithdrawPage)
- 邀请 (InvitePage)
- 通知 (NotificationPage)

### 管理后台功能
- **仪表板** (/admin/dashboard) - 统计数据和概览
- **用户管理** (/admin/users) - 用户列表、详情、状态管理、余额调整
- **夺宝管理** (/admin/lotteries) - 商品列表、创建/编辑、开奖管理
- **订单管理** (/admin/orders) - 订单列表和详情
- **充值审核** (/admin/deposit-review) - 充值申请审核
- **提现审核** (/admin/withdrawal-review) - 提现申请审核
- **发货管理** (/admin/shipping-management) - 物流信息管理
- **晒单审核** (/admin/showoff-review) - 晒单内容审核
- **转售管理** (/admin/resale-management) - 转售市场管理
- **支付配置** (/admin/payment-config) - 支付方式配置
- **操作日志** (/admin/audit-logs) - 管理员操作记录

## 访问管理后台

### 本地开发
```bash
# 启动开发服务器
pnpm dev

# 访问管理后台
http://localhost:5173/admin
```

### 生产环境
```bash
# 构建项目
pnpm build

# 访问管理后台
https://your-domain.com/admin
```

## 环境变量配置

### 必需的环境变量
```env
# Supabase配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OAuth配置
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im

# 应用配置
VITE_APP_TITLE=LuckyMart
VITE_APP_LOGO=https://your-logo-url.com/logo.png

# 数据库
DATABASE_URL=your-database-url
JWT_SECRET=your-jwt-secret

# 内置API
BUILT_IN_FORGE_API_URL=https://forge-api.manus.im
BUILT_IN_FORGE_API_KEY=your-api-key
VITE_FRONTEND_FORGE_API_URL=https://forge-api.manus.im
VITE_FRONTEND_FORGE_API_KEY=your-frontend-api-key

# 所有者信息
OWNER_NAME=Your Name
OWNER_OPEN_ID=your-open-id
```

## 技术栈

### 前端
- **框架**: React 19 + TypeScript
- **路由**: React Router v6
- **构建**: Vite
- **样式**: Tailwind CSS 4
- **UI组件**: shadcn/ui + Radix UI
- **状态管理**: React Context + Custom Hooks
- **API通信**: tRPC + React Query

### 后端
- **框架**: Express 4 + TypeScript
- **API**: tRPC 11
- **数据库**: Supabase (PostgreSQL)
- **ORM**: Drizzle ORM
- **认证**: Manus OAuth
- **数据库迁移**: Drizzle Kit

### 基础设施
- **数据库**: Supabase PostgreSQL
- **认证**: Manus OAuth
- **存储**: Supabase Storage (S3)
- **Edge Functions**: Supabase Edge Functions

## API路由

### 用户管理
- `GET /api/trpc/users.list` - 获取用户列表
- `GET /api/trpc/users.getById` - 获取用户详情
- `POST /api/trpc/users.updateStatus` - 更新用户状态
- `POST /api/trpc/users.adjustBalance` - 调整用户余额

### 夺宝管理
- `GET /api/trpc/lotteries.list` - 获取夺宝列表
- `GET /api/trpc/lotteries.getById` - 获取夺宝详情
- `POST /api/trpc/lotteries.create` - 创建夺宝
- `POST /api/trpc/lotteries.update` - 更新夺宝
- `POST /api/trpc/lotteries.draw` - 执行开奖

### 其他模块
- `deposits.*` - 充值管理
- `withdrawals.*` - 提现管理
- `shipping.*` - 发货管理
- `paymentConfigs.*` - 支付配置
- `auditLogs.*` - 操作日志

## 开发指南

### 添加新的管理后台页面

1. **创建页面组件**
   ```typescript
   // src/pages/MyAdminPage.tsx
   import DashboardLayout from "@/components/DashboardLayout";
   
   export default function MyAdminPage() {
     return (
       <DashboardLayout>
         {/* 页面内容 */}
       </DashboardLayout>
     );
   }
   ```

2. **在App.tsx中添加路由**
   ```typescript
   import MyAdminPage from './pages/MyAdminPage'
   
   // 在Routes中添加
   <Route path="/admin/my-page" element={<MyAdminPage />} />
   ```

3. **在DashboardLayout菜单中添加导航项**
   ```typescript
   // src/components/DashboardLayout.tsx
   const menuItems = [
     // ...
     { icon: MyIcon, label: "我的页面", path: "/admin/my-page" },
   ];
   ```

### 添加新的API路由

1. **定义tRPC过程**
   ```typescript
   // server/routers.ts
   myFeature: router({
     list: protectedProcedure.query(async () => {
       // 实现逻辑
     }),
     create: protectedProcedure
       .input(z.object({ /* 输入schema */ }))
       .mutation(async ({ input }) => {
         // 实现逻辑
       }),
   }),
   ```

2. **在前端调用API**
   ```typescript
   const { data } = trpc.myFeature.list.useQuery();
   const mutation = trpc.myFeature.create.useMutation();
   ```

## 数据库管理

### 查看数据库表
访问 Supabase Dashboard → Database → Tables

### 执行数据库迁移
```bash
# 生成迁移文件
pnpm db:generate

# 应用迁移
pnpm db:push

# 查看迁移历史
pnpm db:studio
```

## 部署

### 部署到Vercel（推荐）
```bash
# 1. 推送代码到GitHub
git push origin main

# 2. 在Vercel中导入项目
# https://vercel.com/new

# 3. 配置环境变量
# 在Vercel项目设置中添加所有必需的环境变量

# 4. 部署
# Vercel会自动部署
```

### 部署到其他平台
```bash
# 构建项目
pnpm build

# 启动生产服务器
pnpm preview
```

## 故障排除

### 问题：管理后台页面显示白屏
**解决方案**：
1. 检查浏览器控制台是否有错误
2. 确保Supabase环境变量已正确配置
3. 检查用户是否已认证

### 问题：API调用失败
**解决方案**：
1. 检查后端服务器是否正在运行
2. 验证Supabase连接字符串
3. 检查网络请求是否被CORS阻止

### 问题：数据库连接错误
**解决方案**：
1. 验证DATABASE_URL环境变量
2. 确保Supabase项目正在运行
3. 检查数据库表是否存在

## 后续优化方向

1. **添加数据导出功能** - 为列表页面添加Excel导出
2. **实现批量操作** - 支持批量审核、批量更新
3. **添加系统设置** - 平台参数配置、佣金设置
4. **增强数据可视化** - 添加图表和统计分析
5. **添加用户通知** - 推送通知系统
6. **性能优化** - 缓存、分页优化、查询优化

## 支持和反馈

如有问题或建议，请提交Issue或Pull Request。

---

**最后更新**: 2025-11-09
**版本**: 1.0.0
