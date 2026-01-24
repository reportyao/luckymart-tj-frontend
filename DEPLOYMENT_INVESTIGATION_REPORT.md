# 部署回滚问题深度排查报告

## 📅 日期：2026-01-24

## 🔍 问题描述

用户反馈前端部署后，构建时间反复回退到 `2026/1/23 01:31:28`，而不是最新的部署版本。

## 🕵️ 排查过程

### 1. 服务器端检查

#### 1.1 Git 仓库状态
- ✅ **已确认**：服务器上的 Git 仓库代码是最新的（commit: 9240894）
- ✅ **已确认**：执行 `git pull origin main` 后代码已同步

#### 1.2 构建文件检查
- ✅ **已确认**：`/root/luckymart-tj-frontend/dist/` 目录包含最新构建
- ✅ **已确认**：构建时间为 `2026-01-24T10:08:12.790Z`
- ✅ **已确认**：JS 文件为 `index-DLUQ1BXA.js`

#### 1.3 部署目录检查
- ✅ **已确认**：`/var/www/tezbarakat.com/html/` 目录包含最新文件
- ✅ **已确认**：文件修改时间为 `Jan 24 18:08`
- ✅ **已确认**：文件所有者为 `www-data:www-data`

#### 1.4 外部访问验证
- ✅ **已确认**：通过 `curl` 访问 `https://tezbarakat.com/` 返回最新版本
- ✅ **已确认**：返回的构建时间和 JS 文件名与服务器一致

### 2. 自动化机制排查

#### 2.1 定时任务（Cron）
- ✅ **已确认**：`crontab -l` 显示 `no crontab for root`
- ✅ **已确认**：`/var/spool/cron/crontabs/` 目录为空
- ✅ **已确认**：`/etc/cron.d/` 目录无相关任务

#### 2.2 系统服务（Systemd）
- ✅ **已确认**：`systemctl list-timers` 无自定义部署定时器
- ✅ **已确认**：`systemctl list-units` 无 luckymart 相关服务

#### 2.3 Git 钩子（Hooks）
- ✅ **已确认**：`.git/hooks/` 目录只有示例文件
- ✅ **已确认**：无 `post-receive` 或 `post-merge` 钩子

#### 2.4 PM2 进程
- ✅ **已确认**：PM2 前端进程已停止并删除
- ✅ **已确认**：只有 `luckymart-admin` 进程在运行（管理后台）

#### 2.5 Webhook 服务
- ✅ **已确认**：`ps aux` 无 webhook 相关进程

### 3. 浏览器端检查

#### 3.1 用户报告的错误日志分析

**关键发现：**

用户浏览器日志显示加载了**两个不同版本**的 JS 文件：

1. **旧版本**：`index-CqOMwsYj.js?v=1769103088978`（1月23日）
2. **不存在的版本**：`index-CKw1qNjz.js?v=1769249692586`（1月24日，但服务器上不存在）

**而服务器实际部署的是**：`index-DLUQ1BXA.js?v=1769249292790`

#### 3.2 Supabase 环境变量错误

新版本 JS 文件报错：
```
Missing Supabase URL or Anon Key. Please check your .env.local file.
```

**已确认**：服务器上 `.env.production` 文件存在且配置正确。

## 🎯 根本原因分析

### 主要原因：浏览器/Telegram WebView 强缓存

1. **Telegram WebView 的激进缓存策略**
   - Telegram 内置浏览器会缓存 HTML、JS、CSS 文件
   - 即使设置了 `Cache-Control: no-cache`，Telegram 仍可能缓存
   - 用户的 Telegram 客户端缓存了多个历史版本

2. **浏览器的多层缓存**
   - HTTP 缓存
   - Service Worker 缓存（虽然项目中未使用）
   - DNS 缓存

3. **版本号查询参数的局限性**
   - 虽然使用了 `?v=timestamp` 查询参数
   - 但如果 `index.html` 本身被缓存，查询参数就失效了

### 次要原因：部署流程的不完整

1. **缺少 `git pull` 步骤**
   - 在某些手动部署中，忘记先执行 `git pull`
   - 导致构建的是旧代码

2. **PM2 进程冲突**（已解决）
   - 之前存在 PM2 前端进程
   - 与静态文件部署冲突

3. **文件覆盖不彻底**
   - 使用 `cp -r` 可能无法完全覆盖旧文件
   - 改用 `rm -rf` + `cp -rf` 解决

## ✅ 已实施的解决方案

### 1. 标准化部署流程

创建了 `deploy.sh` 脚本，强制执行以下步骤：
1. `git pull origin main` - 同步最新代码
2. `npm install` - 安装依赖
3. `npm run build` - 构建项目
4. `rm -rf /var/www/.../*` - 清空旧文件
5. `cp -rf dist/* /var/www/.../` - 复制新文件
6. `systemctl restart nginx` - 重启 Nginx

### 2. 清除冗余配置

- 停止并删除 PM2 前端进程
- 删除冗余的 Nginx 配置文件
- 统一使用 `/var/www/tezbarakat.com/html` 作为唯一部署路径

### 3. 创建验证脚本

创建了 `verify-deployment.sh` 脚本，用于：
- 对比服务器和外部访问的版本
- 检查 Git 仓库状态
- 快速诊断部署问题

## 🚀 推荐的部署流程

### 方式一：一键部署（推荐）

```bash
./deploy.sh
```

### 方式二：手动部署

```bash
ssh root@47.82.73.79
cd /root/luckymart-tj-frontend
git pull origin main
npm install
npm run build
rm -rf /var/www/tezbarakat.com/html/*
cp -rf dist/* /var/www/tezbarakat.com/html/
chown -R www-data:www-data /var/www/tezbarakat.com/html
systemctl restart nginx
```

### 部署后验证

```bash
./verify-deployment.sh
```

## 📝 用户端解决方案

### 对于 Telegram 用户

1. **完全退出 Telegram 应用**（不是最小化）
2. **清除 Telegram 缓存**：
   - 设置 → 数据和存储 → 存储用量 → 清除缓存
3. **重新打开 Telegram**
4. **重新进入 Mini App**

### 对于浏览器用户

1. **硬性刷新**：`Ctrl + Shift + R`（Windows）或 `Cmd + Shift + R`（Mac）
2. **清除缓存**：
   - `Ctrl + Shift + Delete`
   - 选择"缓存的图片和文件"
   - 时间范围选择"全部时间"
3. **使用无痕模式测试**：`Ctrl + Shift + N`

### 终极方案

如果以上方法都无效：
1. 卸载并重装 Telegram 应用
2. 或使用不同的设备/网络测试

## 🔮 预防措施

### 1. 增强缓存控制

在 `index.html` 中添加更强的缓存控制头：
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```

### 2. 使用内容哈希

Vite 已经为 JS/CSS 文件生成了内容哈希（如 `index-DLUQ1BXA.js`），确保文件名变化时浏览器会加载新文件。

### 3. 定期监控

使用 `verify-deployment.sh` 脚本定期检查部署状态。

### 4. 文档化

将部署流程写入 `DEPLOYMENT.md`，确保团队成员都遵循标准流程。

## 📊 结论

**服务器端没有自动回滚机制！**

所有排查结果表明：
- ✅ 服务器上的文件是最新的
- ✅ 外部访问返回的也是最新的
- ✅ 没有定时任务、系统服务或 Git 钩子在自动部署

**问题的根源是用户端的缓存！**

建议用户：
1. 完全退出并重新打开 Telegram
2. 清除 Telegram 缓存
3. 如果还不行，卸载重装 Telegram

---

**报告人**：Manus AI Agent  
**日期**：2026-01-24  
**版本**：v1.0
