# LuckyMart TJ - Telegram Mini App 夺宝平台

一个基于Telegram Mini App的社交夺宝平台前端项目。

## 🎯 功能特性

### 核心功能
- 🎲 **夺宝系统** - 完整的夺宝购买、开奖、中奖流程
- 💰 **双钱包系统** - 余额钱包 + 夺宝币钱包
- 💳 **充值提现** - 支持Alif Mobi、DC Bank等支付方式
- 🔄 **余额兑换** - 余额与夺宝币1:1互相兑换
- 👥 **三级邀请** - 10%/5%/2%返佣机制
- 🎁 **晒单系统** - 用户分享中奖喜悦
- 🛒 **转售市场** - 中奖商品二次交易

### 用户功能
- 👤 个人资料编辑
- ⚙️ 系统设置
- 🌍 多语言支持 (中文/俄语/塔吉克语)
- 🎫 我的彩票
- 🏆 我的奖品
- 📊 邀请统计

## 🛠️ 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **动画**: Framer Motion
- **路由**: React Router v6
- **状态管理**: React Context
- **国际化**: react-i18next
- **后端**: Supabase
- **SDK**: Telegram Mini App SDK

## 📦 项目结构

```
luckymart-tj/
├── src/
│   ├── components/        # 组件
│   │   ├── lottery/      # 夺宝相关组件
│   │   ├── wallet/       # 钱包相关组件
│   │   └── navigation/   # 导航组件
│   ├── pages/            # 页面
│   │   ├── HomePage.tsx
│   │   ├── LotteryPage.tsx
│   │   ├── WalletPage.tsx
│   │   ├── ProfilePage.tsx
│   │   ├── DepositPage.tsx
│   │   ├── WithdrawPage.tsx
│   │   └── ...
│   ├── contexts/         # Context
│   │   └── UserContext.tsx
│   ├── lib/             # 工具库
│   │   ├── supabase.ts
│   │   └── utils.ts
│   ├── i18n/            # 国际化
│   │   ├── config.ts
│   │   └── locales/
│   └── App.tsx
├── supabase/
│   └── functions/       # Edge Functions
│       ├── auth-telegram/
│       ├── purchase-lottery/
│       ├── deposit-request/
│       ├── withdraw-request/
│       └── ...
└── package.json
```

## 🚀 快速开始

### 安装依赖
```bash
pnpm install
```

### 开发环境
```bash
pnpm dev
```

### 构建生产版本
```bash
pnpm build
```

### 预览生产版本
```bash
pnpm preview
```

## 🔧 环境变量

创建 `.env` 文件并配置以下变量:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_TELEGRAM_BOT_USERNAME=your_bot_username
```

## 📱 Telegram Mini App 配置

1. 在 BotFather 中创建 Telegram Bot
2. 配置 Mini App URL
3. 设置 Bot 命令和菜单

## 🌍 多语言支持

项目支持以下语言:
- 🇨🇳 简体中文 (zh)
- 🇷🇺 俄语 (ru)
- 🇹🇯 塔吉克语 (tg)

翻译文件位于 `src/i18n/locales/`

## 📊 数据库

使用 Supabase 作为后端服务:
- PostgreSQL 数据库
- Edge Functions
- 实时订阅
- 文件存储

主要数据表:
- `users` - 用户信息
- `wallets` - 钱包
- `lotteries` - 夺宝商品
- `lottery_entries` - 夺宝记录
- `orders` - 订单
- `deposit_requests` - 充值申请
- `withdrawal_requests` - 提现申请
- `exchange_records` - 兑换记录

## 🎨 UI 组件

- 响应式设计
- 流畅动画效果
- 现代化界面
- Telegram 风格主题

## 📝 开发说明

### Mock 数据
开发环境下使用 mock 用户数据,方便本地测试。

### 类型安全
全面使用 TypeScript,确保类型安全。

### 代码规范
- ESLint
- Prettier
- TypeScript strict mode

## 🔐 安全性

- JWT 认证
- Telegram WebApp 数据验证
- RLS (Row Level Security)
- API 密钥保护

## 📄 许可证

MIT License

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系方式

- GitHub: [@reportyao](https://github.com/reportyao)
- 项目地址: [luckymart-tj-frontend](https://github.com/reportyao/luckymart-tj-frontend)

---

**注意**: 本项目仅供学习和研究使用。
