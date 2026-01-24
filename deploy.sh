#!/bin/bash

##############################################################################
# TezBarakat 前端一键部署脚本
# 用途：自动化部署前端代码到生产服务器
# 作者：Manus AI
# 日期：2026-01-24
##############################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
PROD_SERVER_IP="47.82.73.79"
PROD_SERVER_USER="root"
PROD_SERVER_PASS="Lingjiu123@"
PROD_DOMAIN="tezbarakat.com"
DEPLOY_PATH="/var/www/${PROD_DOMAIN}/html"
ADMIN_DEPLOY_PATH="/var/www/${PROD_DOMAIN}/admin"
GIT_REPO_PATH="/root/luckymart-tj-frontend"
ADMIN_GIT_REPO_PATH="/root/projects/luckymart-tj-admin"

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    print_info "检查依赖..."
    
    if ! command -v sshpass &> /dev/null; then
        print_error "sshpass 未安装，请先安装: sudo apt-get install sshpass"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        print_error "git 未安装，请先安装: sudo apt-get install git"
        exit 1
    fi
    
    print_success "依赖检查通过"
}

# 推送代码到 GitHub
push_to_github() {
    print_info "推送代码到 GitHub..."
    
    # 检查是否有未提交的更改
    if [[ -n $(git status -s) ]]; then
        print_warning "检测到未提交的更改"
        read -p "是否提交并推送？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git add .
            read -p "请输入提交信息: " commit_message
            git commit -m "$commit_message"
            git push origin main
            print_success "代码已推送到 GitHub"
        else
            print_error "部署已取消"
            exit 1
        fi
    else
        print_info "没有未提交的更改，直接推送"
        git push origin main
        print_success "代码已推送到 GitHub"
    fi
}

# 在生产服务器上部署前端
deploy_frontend() {
    print_info "开始部署前端到生产服务器..."
    
    sshpass -p "${PROD_SERVER_PASS}" ssh -o StrictHostKeyChecking=no ${PROD_SERVER_USER}@${PROD_SERVER_IP} << 'ENDSSH'
        set -e
        
        echo "[INFO] 进入前端仓库目录..."
        cd /root/luckymart-tj-frontend
        
        echo "[INFO] 拉取最新代码..."
        git pull origin main
        
        echo "[INFO] 安装依赖..."
        pnpm install
        
        echo "[INFO] 构建前端..."
        pnpm build
        
        echo "[INFO] 备份旧版本..."
        if [ -d /var/www/tezbarakat.com/html.backup ]; then
            rm -rf /var/www/tezbarakat.com/html.backup
        fi
        if [ -d /var/www/tezbarakat.com/html ]; then
            cp -r /var/www/tezbarakat.com/html /var/www/tezbarakat.com/html.backup
        fi
        
        echo "[INFO] 部署新版本..."
        rm -rf /var/www/tezbarakat.com/html/*
        cp -rf dist/* /var/www/tezbarakat.com/html/
        
        echo "[INFO] 设置文件权限..."
        chown -R www-data:www-data /var/www/tezbarakat.com/html
        chmod -R 755 /var/www/tezbarakat.com/html
        
        echo "[INFO] 重启 Nginx..."
        systemctl restart nginx
        
        echo "[SUCCESS] 前端部署完成！"
ENDSSH
    
    if [ $? -eq 0 ]; then
        print_success "前端部署成功！"
    else
        print_error "前端部署失败！"
        exit 1
    fi
}

# 验证部署
verify_deployment() {
    print_info "验证部署..."
    
    BUILD_TIME=$(curl -s https://${PROD_DOMAIN}/ | grep -oP '(?<=Build: )[^<]+' | head -1)
    
    if [ -n "$BUILD_TIME" ]; then
        print_success "部署验证成功！构建时间: $BUILD_TIME"
    else
        print_warning "无法获取构建时间，请手动验证"
    fi
}

# 主函数
main() {
    echo ""
    echo "=========================================="
    echo "  TezBarakat 前端一键部署脚本"
    echo "=========================================="
    echo ""
    
    check_dependencies
    
    # 询问是否推送到 GitHub
    read -p "是否推送代码到 GitHub？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        push_to_github
    fi
    
    # 部署前端
    deploy_frontend
    
    # 验证部署
    verify_deployment
    
    echo ""
    print_success "🎉 部署完成！请访问 https://${PROD_DOMAIN} 验证"
    echo ""
}

# 执行主函数
main "$@"
