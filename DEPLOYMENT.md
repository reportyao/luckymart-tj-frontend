# TezBarakat TJ Frontend - 部署指南

## 前后端分离部署

本项目已完成前后端分离，前端为独立的 React 应用，后端为独立的管理系统。

### 前端部署

#### 1. 环境变量配置

在部署前，需要设置以下环境变量：

```bash
# Supabase 配置（必需）
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# 应用环境
NODE_ENV=production

# 可选：后端 API 地址（如果有独立后端）
VITE_API_BASE_URL=https://api.yourdomain.com

# 可选：允许的主机名（逗号分隔）
ALLOWED_HOSTS=localhost,yourdomain.com
```

#### 2. 构建

```bash
# 安装依赖
pnpm install

# 生产构建
pnpm build:prod

# 或标准构建
pnpm build
```

#### 3. 部署

将 `dist` 目录部署到静态服务器：

- **Vercel**: 直接连接 GitHub 仓库，自动部署
- **Netlify**: 直接连接 GitHub 仓库，自动部署
- **自托管**: 使用 Nginx 或 Apache 服务器

#### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        root /var/www/tezbarakat-tj-frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 跨域配置（如果需要）
    add_header 'Access-Control-Allow-Origin' '*';
    add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization';
}
```

### 后端 CORS 配置

如果前端需要访问后端 API，确保后端允许跨域请求：

#### Supabase Edge Functions

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-frontend-domain.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

export const corsHandler = (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
}
```

#### Express/Node.js 后端

```typescript
import cors from 'cors'

app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://your-frontend-domain.com',
  credentials: true,
}))
```

### 安全建议

1. **环境变量管理**
   - 不要在代码中硬编码敏感信息
   - 使用平台提供的环境变量管理工具（Vercel、Netlify、GitHub Secrets）
   - 定期轮换 API 密钥

2. **HTTPS**
   - 所有生产部署必须使用 HTTPS
   - 使用 Let's Encrypt 获取免费 SSL 证书

3. **内容安全策略 (CSP)**
   - 配置 CSP 头防止 XSS 攻击
   - 限制脚本、样式和其他资源的来源

4. **Supabase 安全**
   - 定期检查 Supabase 审计日志
   - 使用行级安全 (RLS) 限制数据访问
   - 启用 Supabase 的两因素认证

### 监控和日志

1. **性能监控**
   - 使用 Sentry 监控前端错误
   - 使用 Google Analytics 跟踪用户行为
   - 使用 Lighthouse 定期检查性能

2. **日志**
   - 配置日志聚合（如 ELK Stack、Datadog）
   - 监控关键错误和异常
   - 设置告警规则

### 故障排查

#### 常见问题

1. **环境变量未定义**
   ```
   Error: Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   ```
   解决：确保在部署平台中设置了所有必需的环境变量

2. **跨域请求失败**
   ```
   Access to XMLHttpRequest blocked by CORS policy
   ```
   解决：检查后端 CORS 配置，确保允许前端域名

3. **Telegram WebApp 初始化失败**
   ```
   Not in Telegram environment
   ```
   解决：确保应用在 Telegram 中打开，或在开发环境中使用 mock 数据

### 版本管理

遵循 [Semantic Versioning](https://semver.org/):
- **MAJOR**: 不兼容的 API 更改
- **MINOR**: 向后兼容的功能添加
- **PATCH**: 向后兼容的错误修复

### 发布流程

1. 在 `main` 分支上创建发布分支
2. 更新版本号和 CHANGELOG
3. 创建 Pull Request 进行审查
4. 合并到 `main` 分支
5. 创建 Git Tag：`v1.0.0`
6. 自动部署到生产环境

### 相关文档

- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html)
- [Supabase 文档](https://supabase.com/docs)
- [Telegram Mini App 文档](https://core.telegram.org/bots/webapps)
- [React 最佳实践](https://react.dev/learn)
