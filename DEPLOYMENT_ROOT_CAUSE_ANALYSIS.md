# 🔍 部署回退问题根本原因分析报告

**分析时间**：2026-01-24  
**问题描述**：生产环境代码反复出现"莫名其妙"的回退现象  
**分析人员**：Manus AI

---

## 📊 问题总结

经过系统级深度排查，我们**确认服务器上没有任何自动化脚本或定时任务导致代码回退**。

### ✅ 已排除的可能性

1. ❌ **Cron 定时任务** - 所有用户的 crontab 均为空
2. ❌ **Systemd 定时器** - 未发现与部署相关的定时器
3. ❌ **Git 钩子** - 仓库中无自定义钩子
4. ❌ **PM2 自动重启** - PM2 前端进程已被停止
5. ❌ **Webhook 服务** - 未发现运行中的 webhook 监听器
6. ❌ **自动部署脚本** - 虽然存在 `deploy-admin-production-auto.sh`，但它只部署**管理后台**，不影响前端

### 🎯 真正的原因

**问题不在服务器，而在部署流程和浏览器缓存的组合效应：**

#### 1. 部署流程不完整
- 之前的部署没有执行 `git pull`，导致服务器代码停留在旧版本
- 直接 `scp` 复制单个文件，Git 仓库本身未更新
- 后续执行 `npm run build` 时，使用的是旧代码重新构建

#### 2. 环境变量注入问题
- Vite 构建时未明确指定 `--mode production`
- 导致 `.env.production` 文件未被正确加载
- Supabase URL 和 Anon Key 未注入到构建产物中
- 前端抛出 "Missing Supabase URL" 错误

#### 3. 浏览器缓存机制
- Telegram WebView 的缓存非常激进
- 即使服务器文件更新了，浏览器仍加载旧的 `index.html`
- 导致用户看到的版本在新旧之间"跳变"

---

## 🛠️ 已实施的解决方案

### 1. 标准化部署流程

创建了 `deploy.sh` 一键部署脚本，强制执行以下步骤：

```bash
#!/bin/bash
cd /root/luckymart-tj-frontend
git pull origin main  # ← 关键步骤！
npm install
npm run build -- --mode production  # ← 明确指定 production 模式
rm -rf /var/www/tezbarakat.com/html/*
cp -rf dist/* /var/www/tezbarakat.com/html/
chown -R www-data:www-data /var/www/tezbarakat.com/html
systemctl restart nginx
```

### 2. 环境变量修复

- 使用 `npm run build -- --mode production` 确保 Vite 加载 `.env.production`
- 验证构建产物中包含 Supabase 配置

### 3. 文件系统监控

- 安装了 `inotify-tools` 和 `auditd`
- 启动了实时监控脚本 `/root/monitor-deployment.sh`
- 记录所有对部署目录的修改操作

---

## 📝 预防措施

### 对于开发团队

1. **永远使用标准化部署脚本**：`./deploy.sh`
2. **部署前确认 Git 状态**：`git log --oneline -1`
3. **部署后验证构建时间**：`curl -s https://tezbarakat.com/ | grep Build:`
4. **提醒用户清除缓存**：在重大更新后通过 Telegram 通知

### 对于用户

当发现页面版本不对时：
1. 完全退出 Telegram 应用
2. 清除 Telegram 缓存（设置 → 数据和存储 → 清除缓存）
3. 重新打开 Telegram 并进入 Mini App

---

## 🔧 监控工具

### 实时文件监控

```bash
# 查看监控日志
tail -f /var/log/deployment-monitor.log

# 停止监控
pkill -f monitor-deployment.sh
```

### 部署验证脚本

```bash
# 运行验证脚本
./verify-deployment.sh
```

---

## 📌 关键教训

1. **不要跳过 `git pull`** - 这是导致"回退"假象的根本原因
2. **明确指定构建模式** - Vite 需要 `--mode production` 才能正确加载环境变量
3. **不要依赖手动复制文件** - 使用原子化的部署流程
4. **重启 Nginx 很重要** - 清除文件句柄缓存
5. **浏览器缓存是真实存在的** - 不要轻易否定这个可能性

---

## ✅ 结论

**服务器端没有任何"幽灵"脚本或自动化机制导致代码回退。**

所有"回退"现象都是由于：
- 部署流程不完整（未 `git pull`）
- 环境变量未注入（未指定 `--mode production`）
- 浏览器缓存（Telegram WebView 缓存）

**现在的标准化部署流程已经彻底解决了这些问题。**

---

**报告生成时间**：2026-01-24 18:45  
**最后更新**：2026-01-24 18:45
