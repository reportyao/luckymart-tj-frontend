#!/bin/bash

# Comprehensive translation script for remaining hardcoded Chinese strings

echo "=== Translating remaining hardcoded strings ==="

# HomePage.tsx - Line 110
sed -i "s/user\.telegram_username || '用户'/user.telegram_username || t('common.user')/g" src/pages/HomePage.tsx

# ExchangePage.tsx - Line 57
sed -i "s/console\.error('兑换失败:', error)/console.error('Exchange failed:', error)/g" src/pages/ExchangePage.tsx

# LotteryDetailPage.tsx
sed -i "s/幸运币余额不足，需要 \${totalCost} 幸运币，当前余额 \${luckyCoinsBalance} 幸运币/t('lottery.insufficientBalance', { required: totalCost, current: luckyCoinsBalance })/g" src/pages/LotteryDetailPage.tsx
sed -i "s/console\.log('开始开奖:', lotteryId)/console.log('Starting draw:', lotteryId)/g" src/pages/LotteryDetailPage.tsx
sed -i "s/console\.log('开奖成功')/console.log('Draw successful')/g" src/pages/LotteryDetailPage.tsx
sed -i "s/console\.error('开奖失败:', error)/console.error('Draw failed:', error)/g" src/pages/LotteryDetailPage.tsx

# LotteryResultPage.tsx
sed -i "s/console\.log('开始开奖:', lotteryId)/console.log('Starting draw:', lotteryId)/g" src/pages/LotteryResultPage.tsx
sed -i "s/console\.log('开奖成功')/console.log('Draw successful')/g" src/pages/LotteryResultPage.tsx
sed -i "s/console\.error('开奖失败:', error)/console.error('Draw failed:', error)/g" src/pages/LotteryResultPage.tsx

# MarketCreatePage.tsx
sed -i "s/toast\.error('获取奖品列表失败')/toast.error(t('error.loadFailed'))/g" src/pages/MarketCreatePage.tsx
sed -i "s/'未知商品'/t('market.unknownItem')/g" src/pages/MarketCreatePage.tsx
sed -i "s/console\.error('获取奖品列表失败:', error)/console.error('Failed to load prizes:', error)/g" src/pages/MarketCreatePage.tsx
sed -i "s/toast\.error('发布转售失败')/toast.error(t('market.createFailed'))/g" src/pages/MarketCreatePage.tsx

# MarketPage.tsx  
sed -i "s/console\.error('获取转售列表失败:', error)/console.error('Failed to load resale list:', error)/g" src/pages/MarketPage.tsx

# MyTicketsPage.tsx
sed -i "s/toast\.error('加载失败')/toast.error(t('error.loadFailed'))/g" src/pages/MyTicketsPage.tsx
sed -i "s/toast\.success('中奖码已复制')/toast.success(t('lottery.winningCodeCopied'))/g" src/pages/MyTicketsPage.tsx

# ProfileEditPage.tsx
sed -i "s/console\.error('保存失败:', error)/console.error('Save failed:', error)/g" src/pages/ProfileEditPage.tsx

# ShowoffCreatePage.tsx
sed -i "s/toast\.error('未找到选中的中奖记录')/toast.error(t('showoff.prizeNotFound'))/g" src/pages/ShowoffCreatePage.tsx

# ShowoffPage.tsx
sed -i "s/'一位用户'/t('common.aUser')/g" src/pages/ShowoffPage.tsx
sed -i "s/console\.error('分享失败:', error)/console.error('Share failed:', error)/g" src/pages/ShowoffPage.tsx

# BotManagement.tsx - console errors (keep in English)
sed -i "s/console\.error('加载Bot数据失败', error)/console.error('Failed to load bot data', error)/g" src/components/BotManagement.tsx

# DevTools.tsx
sed -i "s/window\.confirm('确定要清除当前测试用户吗?')/window.confirm(t('dev.confirmClearUser'))/g" src/components/DevTools.tsx

# LanguageSwitcher.tsx
sed -i "s/'中文'/'简体中文'/g" src/components/LanguageSwitcher.tsx

# MonitoringDashboard.tsx
sed -i "s/console\.error('获取监控数据失败:', error)/console.error('Failed to load monitoring data:', error)/g" src/components/monitoring/MonitoringDashboard.tsx

echo "Translation complete!"
