# TezBarakat 前端部署文档

## 📋 目录
- [快速开始](#快速开始)
- [部署架构](#部署架构)
- [一键部署](#一键部署)
- [手动部署](#手动部署)
- [回滚操作](#回滚操作)
- [环境配置](#环境配置)
- [安全建议](#安全建议)
- [常见问题](#常见问题)

---

## 🚀 快速开始

### 使用一键部署脚本（推荐）

```bash
# 1. 进入项目目录
cd /path/to/luckymart-tj-frontend

# 2. 给脚本添加执行权限（首次使用）
chmod +x deploy.sh

# 3. 执行部署脚本
./deploy.sh
```

---

## 🏗️ 部署架构

### 生产环境配置
- **服务器IP**: 47.82.73.79
- **域名**: https://tezbarakat.com
- **Web服务器**: Nginx
- **部署方式**: 静态文件部署（推荐）
- **前端路径**: `/var/www/tezbarakat.com/html`
- **管理后台路径**: `/var/www/tezbarakat.com/admin`

### 部署流程图
```
本地开发 → GitHub → 生产服务器 → Nginx 静态文件服务
```

### ⚠️ 已弃用的部署方式
以下部署方式已**不再使用**，请勿尝试：
- ❌ 使用 PM2 运行 `npm run preview`
- ❌ 部署到 `/root/projects/luckymart-tj-frontend`
- ❌ 使用 Nginx 反向代理到 4173 端口

### ✅ 标准部署方式
**唯一推荐的部署方式**：
1. 构建静态文件：`npm run build`
2. 部署到 Nginx 目录：`/var/www/tezbarakat.com/html`
3. 重启 Nginx：`systemctl restart nginx`

---

## 🎯 一键部署

### 使用 deploy.sh 脚本

`deploy.sh` 脚本会自动完成以下操作：
1. 检查依赖（sshpass, git）
2. 询问是否推送代码到 GitHub
3. SSH 连接到生产服务器
4. 拉取最新代码
5. 安装依赖并构建
6. 备份旧版本
7. 部署新版本
8. 重启 Nginx
9. 验证部署结果

### 脚本使用示例

```bash
# 标准部署（会询问是否推送到 GitHub）
./deploy.sh

# 如果脚本执行失败，检查依赖
which sshpass  # 应该返回 /usr/bin/sshpass
which git      # 应该返回 /usr/bin/git

# 如果缺少依赖，安装它们
sudo apt-get install sshpass git
```

---

## 🛠️ 手动部署

### 步骤 1: 推送代码到 GitHub

```bash
# 提交代码
git add .
git commit -m "描述你的更改"
git push origin main
```

### 步骤 2: SSH 连接到生产服务器

```bash
ssh root@47.82.73.79
```

### 步骤 3: 更新前端代码

```bash
# 进入前端仓库目录
cd /root/luckymart-tj-frontend

# 拉取最新代码
git pull origin main

# 安装依赖
npm install

# 构建前端
npm run build
```

### 步骤 4: 部署到 Nginx 目录

```bash
# 备份旧版本（可选）
cp -r /var/www/tezbarakat.com/html /var/www/tezbarakat.com/html.backup

# 清空旧文件
rm -rf /var/www/tezbarakat.com/html/*

# 复制新文件
cp -rf dist/* /var/www/tezbarakat.com/html/

# 设置文件权限
chown -R www-data:www-data /var/www/tezbarakat.com/html
chmod -R 755 /var/www/tezbarakat.com/html
```

### 步骤 5: 重启 Nginx

```bash
systemctl restart nginx
```

### 步骤 6: 验证部署

```bash
# 检查构建时间
curl -s https://tezbarakat.com/ | grep "Build:"
```

---

## 🔄 回滚操作

### 快速回滚到上一个版本

```bash
# SSH 连接到生产服务器
ssh root@47.82.73.79

# 恢复备份
rm -rf /var/www/tezbarakat.com/html
mv /var/www/tezbarakat.com/html.backup /var/www/tezbarakat.com/html

# 重启 Nginx
systemctl restart nginx
```

### 回滚到指定 Git 版本

```bash
# SSH 连接到生产服务器
ssh root@47.82.73.79

# 进入仓库目录
cd /root/luckymart-tj-frontend

# 查看提交历史
git log --oneline

# 回滚到指定版本
git reset --hard <commit-id>

# 重新构建并部署
npm run build
rm -rf /var/www/tezbarakat.com/html/*
cp -rf dist/* /var/www/tezbarakat.com/html/
systemctl restart nginx
```

---

## 🔧 环境配置

### 环境变量

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

### Nginx 配置

生产服务器的 Nginx 配置位于：`/etc/nginx/sites-available/tezbarakat.com`

```nginx
# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name tezbarakat.com www.tezbarakat.com;
    
    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/tezbarakat.com.pem;
    ssl_certificate_key /etc/nginx/ssl/tezbarakat.com.key;
    
    # Frontend Root
    root /var/www/tezbarakat.com/html;
    index index.html;
    
    # Static assets with version query strings - cache aggressively
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }
    
    # HTML files - never cache
    location ~* \.html$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0";
        add_header Pragma "no-cache";
        add_header Expires "0";
        etag off;
        if_modified_since off;
        add_header Last-Modified "";
        try_files $uri =404;
    }
    
    # Frontend - SPA routing
    location / {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 🔒 安全建议

### 1. 环境变量管理
- ✅ 不要在代码中硬编码敏感信息
- ✅ 使用平台提供的环境变量管理工具
- ✅ 定期轮换 API 密钥

### 2. HTTPS
- ✅ 所有生产部署必须使用 HTTPS
- ✅ 使用 Let's Encrypt 获取免费 SSL 证书

### 3. 内容安全策略 (CSP)
- ✅ 配置 CSP 头防止 XSS 攻击
- ✅ 限制脚本、样式和其他资源的来源

### 4. Supabase 安全
- ✅ 定期检查 Supabase 审计日志
- ✅ 使用行级安全 (RLS) 限制数据访问
- ✅ 启用 Supabase 的两因素认证

---

## ❓ 常见问题

### Q1: 部署后浏览器显示的还是旧版本？

**A:** 这是浏览器缓存问题，请尝试：
1. 强制刷新：`Ctrl + Shift + R` (Windows) 或 `Cmd + Shift + R` (Mac)
2. 清除浏览器缓存
3. 使用无痕模式访问
4. 如果是 Telegram Mini App，完全关闭 Telegram 后重新打开

### Q2: 构建时间显示正确，但功能没有更新？

**A:** 检查以下几点：
1. 确认代码已推送到 GitHub：`git log --oneline`
2. 确认服务器已拉取最新代码：
   ```bash
   ssh root@47.82.73.79 "cd /root/luckymart-tj-frontend && git log --oneline"
   ```
3. 确认构建成功：检查 `dist/` 目录是否有新文件
4. 确认 Nginx 已重启：
   ```bash
   ssh root@47.82.73.79 "systemctl status nginx"
   ```

### Q3: 部署后网站无法访问？

**A:** 检查 Nginx 状态：
```bash
ssh root@47.82.73.79 "systemctl status nginx"
```

如果 Nginx 未运行，重启它：
```bash
ssh root@47.82.73.79 "systemctl restart nginx"
```

### Q4: 如何查看 Nginx 错误日志？

**A:**
```bash
ssh root@47.82.73.79 "tail -n 50 /var/log/nginx/tezbarakat.com.error.log"
```

### Q5: PM2 进程还在运行怎么办？

**A:** PM2 进程已被弃用，如果发现还在运行，请停止它：
```bash
ssh root@47.82.73.79 "pm2 stop luckymart-frontend && pm2 delete luckymart-frontend"
```

### Q6: 环境变量未定义错误

**错误信息:**
```
Error: Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

**解决方案:** 确保在部署平台中设置了所有必需的环境变量

### Q7: 跨域请求失败

**错误信息:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**解决方案:** 检查后端 CORS 配置，确保允许前端域名

### Q8: Telegram WebApp 初始化失败

**错误信息:**
```
Not in Telegram environment
```

**解决方案:** 确保应用在 Telegram 中打开，或在开发环境中使用 mock 数据

---

## 📊 监控和日志

### 性能监控
- 使用 Sentry 监控前端错误
- 使用 Google Analytics 跟踪用户行为
- 使用 Lighthouse 定期检查性能

### 日志管理
- 配置日志聚合（如 ELK Stack、Datadog）
- 监控关键错误和异常
- 设置告警规则

---

## 📦 版本管理

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

---

## 📚 相关文档

- [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html)
- [Supabase 文档](https://supabase.com/docs)
- [Telegram Mini App 文档](https://core.telegram.org/bots/webapps)
- [React 最佳实践](https://react.dev/learn)
- [Nginx 官方文档](https://nginx.org/en/docs/)

---

## 📞 联系支持

如果遇到无法解决的问题，请：
1. 检查本文档的"常见问题"部分
2. 查看 Nginx 错误日志
3. 联系技术负责人

---

**最后更新**: 2026-01-24  
**维护者**: Manus AI
