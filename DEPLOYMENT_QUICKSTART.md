# 🚀 TezBarakat 部署快速参考

## 一键部署（推荐）

```bash
./deploy.sh
```

## 手动部署（5步）

```bash
# 1. 推送代码
git push origin main

# 2. SSH 到服务器
ssh root@47.82.73.79

# 3. 更新并构建
cd /root/luckymart-tj-frontend
git pull origin main
npm install
npm run build

# 4. 部署
rm -rf /var/www/tezbarakat.com/html/*
cp -rf dist/* /var/www/tezbarakat.com/html/
chown -R www-data:www-data /var/www/tezbarakat.com/html

# 5. 重启 Nginx
systemctl restart nginx
```

## 验证部署

```bash
curl -s https://tezbarakat.com/ | grep "Build:"
```

## 快速回滚

```bash
ssh root@47.82.73.79
rm -rf /var/www/tezbarakat.com/html
mv /var/www/tezbarakat.com/html.backup /var/www/tezbarakat.com/html
systemctl restart nginx
```

## ⚠️ 重要提示

- ✅ **唯一部署路径**: `/var/www/tezbarakat.com/html`
- ❌ **不要使用 PM2**: 已弃用
- ❌ **不要部署到**: `/root/projects/`
- ✅ **部署后必须**: 重启 Nginx

## 🆘 紧急联系

遇到问题？查看完整文档：[DEPLOYMENT.md](./DEPLOYMENT.md)
