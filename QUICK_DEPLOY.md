# 快速部署指南

## 一键部署

在服务器上运行以下命令：

```bash
cd /home/root/webapp/tezbarakat-tj-frontend
./deploy.sh
```

## 部署脚本说明

`deploy.sh` 脚本会自动完成以下步骤：

1. ✅ 清理临时文件
2. ✅ TypeScript 类型检查
3. ✅ 构建前端
4. ✅ 部署到 Nginx 目录 (`/var/www/tezbarakat-frontend`)
5. ✅ 设置文件权限
6. ✅ 重新加载 Nginx

## 使用 npm 脚本

### 构建并部署
```bash
pnpm run build:deploy
```

### 仅构建
```bash
pnpm run build
```

### 仅部署（需要先构建）
```bash
pnpm run deploy
```

## 目录结构

```
源代码目录：/home/root/webapp/tezbarakat-tj-frontend/
Nginx 目录：/var/www/tezbarakat-frontend/
```

## 验证部署

```bash
# 检查文件是否存在
ls -lh /var/www/tezbarakat-frontend/

# 查看 index.html
head -20 /var/www/tezbarakat-frontend/index.html

# 检查 Nginx 状态
systemctl status nginx
```

## 故障排查

### 样式未加载

**原因**：构建文件未部署到 Nginx 目录

**解决**：
```bash
cd /home/root/webapp/tezbarakat-tj-frontend
./deploy.sh
```

### 权限问题

```bash
chown -R www-data:www-data /var/www/tezbarakat-frontend
chmod -R 755 /var/www/tezbarakat-frontend
```

### Nginx 错误

```bash
# 检查配置
nginx -t

# 重新加载
systemctl reload nginx

# 查看日志
tail -f /var/log/nginx/error.log
```

## 注意事项

⚠️ **重要**：每次修改代码后，必须运行 `./deploy.sh` 才能在生产环境中生效。

✅ **建议**：部署前先在本地测试 `pnpm run build`，确保构建成功。
