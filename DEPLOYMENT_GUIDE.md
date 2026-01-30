# TezBarakat 前端项目部署指南

## 项目信息

- **项目名称**: luckymart-tj-frontend
- **GitHub 仓库**: https://github.com/reportyao/luckymart-tj-frontend
- **生产服务器**: 47.82.73.79
- **域名**: https://tezbarakat.com
- **部署目录**: /var/www/tezbarakat.com/html

## 服务器配置

### 基本信息
- **服务器IP**: 47.82.73.79
- **SSH用户**: root
- **SSH密码**: Lingjiu123@
- **操作系统**: Ubuntu 22.04

### 目录结构
```
/var/www/tezbarakat.com/
├── html/           # 前端部署目录（生产环境）
│   ├── index.html
│   ├── assets/
│   │   ├── js/
│   │   └── css/
│   ├── telegram-init.js
│   └── ...
└── admin/          # 管理后台目录
```

### Nginx 配置
- **配置文件**: /etc/nginx/sites-available/tezbarakat.com
- **监听端口**: 80 (HTTP) 和 443 (HTTPS)
- **SSL证书**: /etc/nginx/ssl/tezbarakat.com.pem
- **根目录**: /var/www/tezbarakat.com/html
- **SPA路由**: try_files $uri $uri/ /index.html

## 历史问题总结

### 问题1: 随机加载旧版本文件

**现象**:
- 新用户和老用户都有概率遇到错误
- 服务器上存在多份构建文件（1月26日的旧文件和最新文件）
- 随机加载导致"Telegram 认证失败"错误

**根本原因**:
1. 多个目录存在旧的构建文件：
   - `/tmp/luckymart-tj-frontend/dist/`
   - `/opt/luckymart-tj-frontend/dist/`
   - `/root/assets/`
   - `/root/backups/`
2. 部署目录中存在多个版本的 index JS 文件

**解决方案**:
- 彻底清理所有旧构建文件
- 确保部署目录只有一个版本的文件

### 问题2: Supabase API 返回 HTML 错误

**现象**:
```
SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
Error fetching showoffs: SyntaxError: Unexpected token '<'
```

**根本原因**:
- 代码中直接使用 `import.meta.env.VITE_SUPABASE_URL`
- 构建时没有设置环境变量，导致值为 `undefined`
- 请求发送到 `undefined/rest/v1/...`，被 Nginx 返回 HTML 错误页面

**解决方案**:
1. 在 `src/lib/supabase.ts` 中导出 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
2. 修改所有使用环境变量的地方，改为导入这些常量
3. 添加认证重试机制（3次重试，指数退避）
4. 延长登录超时时间（4秒 → 15秒）

### 问题3: Clipboard API 权限被阻止

**现象**:
```
The Clipboard API has been blocked because of a permissions policy applied to the current document
```

**根本原因**:
- Telegram WebView 的安全限制，禁止直接使用浏览器的 Clipboard API

**解决方案**:
- 优化 `copyToClipboard` 函数，优先使用 Telegram WebApp API
- 降级方案使用浏览器原生 API

### 问题4: Nginx 端口冲突

**现象**:
```
nginx: [emerg] bind() to 0.0.0.0:9000 failed (98: Unknown error)
```

**根本原因**:
- `/etc/nginx/sites-available/earn-new` 配置监听 9000 端口
- Node.js webhook 服务也在使用 9000 端口

**解决方案**:
- 修改 `earn-new` 配置，将端口从 9000 改为 9001
- 或停止 webhook 服务

### 问题5: 403 Forbidden 错误

**现象**:
- 网站返回 403 错误
- 错误日志显示：`directory index of "/var/www/tezbarakat.com/html/" is forbidden`

**根本原因**:
- Nginx 缓存了旧的文件系统状态
- 文件存在但 Nginx 无法读取

**解决方案**:
- 重启 Nginx 服务：`systemctl restart nginx`

### 问题6: tar 包解压路径错误

**现象**:
- 解压后文件在 `/var/www/tezbarakat.com/html/dist/dist/` 嵌套目录中
- 或者文件直接在 `/var/www/tezbarakat.com/html/` 但 Nginx 看不到

**根本原因**:
- 打包时包含了 `dist` 目录本身
- 正确的打包方式应该是打包 `dist` 目录的内容

**解决方案**:
```bash
# 错误的打包方式
tar -czf dist.tar.gz dist/

# 正确的打包方式
tar -czf dist.tar.gz -C dist .
```

## 标准部署流程

### 前置条件检查

1. **确认服务器连接**:
```bash
ssh root@47.82.73.79
```

2. **检查 Nginx 状态**:
```bash
systemctl status nginx
```

3. **检查端口占用**:
```bash
netstat -tlnp | grep -E "80|443|9000"
```

### 步骤1: 本地构建

```bash
# 1. 进入项目目录
cd /home/ubuntu/luckymart-tj-frontend

# 2. 确保依赖已安装
pnpm install

# 3. 运行类型检查
pnpm type-check

# 4. 构建项目
pnpm build

# 5. 验证构建结果
ls -la dist/
cat dist/index.html | grep "index-"

# 6. 打包构建文件（重要：不包含 dist 目录本身）
tar -czf /home/ubuntu/dist-new.tar.gz -C dist .

# 7. 验证 tar 包内容
tar -tzf /home/ubuntu/dist-new.tar.gz | head -10
# 应该看到：
# ./
# ./index.html
# ./assets/
# 而不是：
# dist/
# dist/index.html
```

### 步骤2: 清理旧文件

```bash
# 创建清理脚本
cat > /home/ubuntu/cleanup_old_files.sh << 'EOF'
#!/bin/bash
set -e

echo "=== 清理旧构建文件 ==="

# 清理 /tmp 目录
rm -rf /tmp/dist /tmp/luckymart* /tmp/tezbarakat* 2>/dev/null || true
echo "已清理 /tmp"

# 清理 /opt 目录
rm -rf /opt/luckymart* /opt/tezbarakat* 2>/dev/null || true
echo "已清理 /opt"

# 清理 /root 目录下的旧备份
cd /root
rm -rf assets backups dist 2>/dev/null || true
echo "已清理 /root 旧文件"

echo "清理完成"
EOF

# 上传并执行清理脚本
SCRIPT=$(base64 -w0 /home/ubuntu/cleanup_old_files.sh)
sshpass -p 'Lingjiu123@' ssh -o StrictHostKeyChecking=no root@47.82.73.79 \
  "echo $SCRIPT | base64 -d | bash"
```

### 步骤3: 上传新文件

```bash
# 上传 tar 包到服务器
sshpass -p 'Lingjiu123@' scp -o StrictHostKeyChecking=no \
  /home/ubuntu/dist-new.tar.gz root@47.82.73.79:/root/dist-new.tar.gz

# 验证上传成功
sshpass -p 'Lingjiu123@' ssh -o StrictHostKeyChecking=no root@47.82.73.79 \
  'ls -lh /root/dist-new.tar.gz'
```

### 步骤4: 部署到生产环境

```bash
# 创建部署脚本
cat > /home/ubuntu/deploy_production.sh << 'EOF'
#!/bin/bash
set -e

echo "=========================================="
echo "=== 开始部署 ==="
echo "=========================================="

# 1. 备份当前部署（可选）
if [ -f /var/www/tezbarakat.com/html/index.html ]; then
  BACKUP_DIR="/root/backups/frontend-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  cp -r /var/www/tezbarakat.com/html/* "$BACKUP_DIR/" 2>/dev/null || true
  echo "已备份到: $BACKUP_DIR"
fi

# 2. 清空部署目录
rm -rf /var/www/tezbarakat.com/html/*
echo "已清空部署目录"

# 3. 解压新文件到部署目录
cd /var/www/tezbarakat.com/html
tar -xzf /root/dist-new.tar.gz
echo "已解压新文件"

# 4. 验证文件结构
if [ ! -f /var/www/tezbarakat.com/html/index.html ]; then
  echo "错误: index.html 不存在！"
  exit 1
fi

# 5. 设置权限
chown -R www-data:www-data /var/www/tezbarakat.com/html
chmod -R 755 /var/www/tezbarakat.com/html
echo "已设置权限"

# 6. 重启 Nginx
systemctl restart nginx
echo "已重启 Nginx"

# 7. 验证部署结果
echo ""
echo "=========================================="
echo "=== 部署验证 ==="
echo "=========================================="

echo "index.html 引用的 JS 文件:"
grep 'index-' /var/www/tezbarakat.com/html/index.html

echo ""
echo "JS 文件列表:"
ls -lh /var/www/tezbarakat.com/html/assets/js/

echo ""
echo "检查旧文件残留:"
find /tmp /opt -name "*.js" -path "*dist*" 2>/dev/null | head -5 || echo "无旧文件残留"

echo ""
echo "=========================================="
echo "=== 部署成功完成! ==="
echo "=========================================="
EOF

# 上传并执行部署脚本
SCRIPT=$(base64 -w0 /home/ubuntu/deploy_production.sh)
sshpass -p 'Lingjiu123@' ssh -o StrictHostKeyChecking=no root@47.82.73.79 \
  "echo $SCRIPT | base64 -d | bash"
```

### 步骤5: 验证部署

```bash
# 1. 检查 HTTP 状态码
curl -s -I https://tezbarakat.com/ | head -5
# 应该返回: HTTP/2 200

# 2. 检查加载的 JS 文件版本
curl -s https://tezbarakat.com/ | grep 'index-'
# 应该只有一个 index-*.js 文件

# 3. 在浏览器中测试
# 访问 https://tezbarakat.com/
# 打开开发者工具，检查控制台是否有错误

# 4. 在 Telegram 中测试
# 打开 Telegram Bot，测试功能是否正常
```

### 步骤6: 提交代码到 GitHub

```bash
cd /home/ubuntu/luckymart-tj-frontend

# 1. 查看修改
git status

# 2. 添加所有修改
git add -A

# 3. 提交修改
git commit -m "部署说明: 描述本次修改内容"

# 4. 推送到远程仓库
git push origin main
```

## 关键注意事项

### ⚠️ 必须遵守的规则

1. **tar 包打包方式**:
   - ✅ 正确: `tar -czf dist.tar.gz -C dist .`
   - ❌ 错误: `tar -czf dist.tar.gz dist/`

2. **部署前必须清理旧文件**:
   - 清理 `/tmp` 目录
   - 清理 `/opt` 目录
   - 清理 `/root/assets` 和 `/root/backups`

3. **部署后必须重启 Nginx**:
   ```bash
   systemctl restart nginx
   ```
   不要使用 `reload`，因为可能无法清除文件系统缓存

4. **验证部署结果**:
   - 检查 `index.html` 引用的 JS 文件名
   - 检查实际存在的 JS 文件列表
   - 两者必须完全一致

5. **环境变量配置**:
   - 不要在代码中直接使用 `import.meta.env.VITE_*`
   - 在 `supabase.ts` 中定义常量并导出
   - 其他文件导入这些常量

6. **端口冲突检查**:
   - 部署前检查 9000 端口是否被占用
   - 如果被占用，修改 Nginx 配置或停止占用进程

### 🔍 故障排查

#### 问题: 网站返回 403 错误

**检查步骤**:
```bash
# 1. 检查文件是否存在
ls -la /var/www/tezbarakat.com/html/index.html

# 2. 检查文件权限
stat /var/www/tezbarakat.com/html/index.html

# 3. 检查 Nginx 错误日志
tail -50 /var/log/nginx/tezbarakat.com.error.log

# 4. 重启 Nginx
systemctl restart nginx
```

#### 问题: 加载旧版本文件

**检查步骤**:
```bash
# 1. 检查 index.html 引用的文件
grep 'index-' /var/www/tezbarakat.com/html/index.html

# 2. 检查实际存在的文件
ls -la /var/www/tezbarakat.com/html/assets/js/

# 3. 查找所有旧文件
find /tmp /opt /root -name "index-*.js" 2>/dev/null | grep -v node_modules

# 4. 清理旧文件并重新部署
```

#### 问题: Nginx 启动失败

**检查步骤**:
```bash
# 1. 检查端口占用
netstat -tlnp | grep -E "80|443|9000"

# 2. 检查配置文件
nginx -t

# 3. 查看详细错误
journalctl -xeu nginx.service --no-pager | tail -30

# 4. 解决端口冲突
# 如果 9000 端口被占用：
kill -9 <PID>
# 或修改 Nginx 配置
```

## 环境变量配置

### Supabase 配置

**生产环境**:
```
SUPABASE_URL=https://zvouvjkrexowtujnqtna.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**代码中的使用方式**:
```typescript
// ✅ 正确：在 supabase.ts 中定义并导出
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 
  'https://zvouvjkrexowtujnqtna.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// ✅ 正确：在其他文件中导入
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

// ❌ 错误：直接使用环境变量
const url = import.meta.env.VITE_SUPABASE_URL; // 可能是 undefined
```

## 回滚流程

如果部署后发现问题，可以快速回滚：

```bash
# 1. 查看备份目录
ls -la /root/backups/

# 2. 选择要回滚的版本
BACKUP_DIR="/root/backups/frontend-20260130-223252"

# 3. 回滚
rm -rf /var/www/tezbarakat.com/html/*
cp -r $BACKUP_DIR/* /var/www/tezbarakat.com/html/
chown -R www-data:www-data /var/www/tezbarakat.com/html
chmod -R 755 /var/www/tezbarakat.com/html
systemctl restart nginx

# 4. 验证
curl -s -I https://tezbarakat.com/
```

## 监控和日志

### Nginx 日志位置

- **访问日志**: /var/log/nginx/tezbarakat.com.access.log
- **错误日志**: /var/log/nginx/tezbarakat.com.error.log
- **通用错误日志**: /var/log/nginx/error.log

### 查看实时日志

```bash
# 查看访问日志
tail -f /var/log/nginx/tezbarakat.com.access.log

# 查看错误日志
tail -f /var/log/nginx/tezbarakat.com.error.log

# 查看最近的 403 错误
grep "403" /var/log/nginx/access.log | tail -20
```

## 联系信息

- **GitHub 仓库**: https://github.com/reportyao/luckymart-tj-frontend
- **生产域名**: https://tezbarakat.com
- **管理后台**: https://tezbarakat.com/admin

## 版本历史

| 日期 | 版本 | 修改内容 | 部署人 |
|------|------|----------|--------|
| 2026-01-30 | v1.0.0 | 修复 Supabase 环境变量和 Clipboard API 问题 | AI |
| 2026-01-30 | v1.0.1 | 清理旧构建文件，修复 403 错误 | AI |

---

**最后更新**: 2026-01-30
**文档版本**: 1.0
