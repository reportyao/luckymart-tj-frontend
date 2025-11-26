#!/bin/bash

# LuckyMart 前端自动部署脚本
# 用途：构建前端并自动部署到 Nginx 目录

set -e  # 遇到错误立即退出

echo "=========================================="
echo "LuckyMart 前端自动部署"
echo "=========================================="

# 项目目录
PROJECT_DIR="/home/root/webapp/luckymart-tj-frontend"
NGINX_DIR="/var/www/luckymart-frontend"

# 切换到项目目录
cd "$PROJECT_DIR"

echo ""
echo "1. 清理临时文件..."
rm -rf node_modules/.vite-temp

echo ""
echo "2. TypeScript 类型检查..."
tsc -b

echo ""
echo "3. 构建前端..."
pnpm run build

echo ""
echo "4. 部署到 Nginx 目录..."
rm -rf "$NGINX_DIR"/*
cp -r dist/* "$NGINX_DIR"/

echo ""
echo "5. 设置文件权限..."
chown -R www-data:www-data "$NGINX_DIR"
chmod -R 755 "$NGINX_DIR"

echo ""
echo "6. 重新加载 Nginx..."
nginx -t && systemctl reload nginx

echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo "构建时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Nginx 目录: $NGINX_DIR"
echo ""
echo "请在 Telegram Mini App 中刷新页面测试"
