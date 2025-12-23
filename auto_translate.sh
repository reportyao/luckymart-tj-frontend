#!/bin/bash

echo "🔄 Starting automatic translation replacement..."

# DepositPage.tsx
sed -i "s/'获取支付配置失败:'/t('deposit.failedToLoadConfig') + ':'/g" src/pages/DepositPage.tsx
sed -i "s/'图片上传成功'/t('deposit.imageUploadSuccess')/g" src/pages/DepositPage.tsx  
sed -i "s/'图片上传失败，请重试'/t('deposit.imageUploadFailed')/g" src/pages/DepositPage.tsx
sed -i "s/'请上传充值凭证'/t('deposit.pleaseUploadProof')/g" src/pages/DepositPage.tsx
sed -i "s/'提交充值申请失败:'/t('deposit.submitFailed') + ':'/g" src/pages/DepositPage.tsx
sed -i "s/'上传中...'/t('deposit.uploading')/g" src/pages/DepositPage.tsx
echo "✅ DepositPage translated"

# MyPrizesPage.tsx  
sed -i "s/'待处理'/t('myPrizes.statusPending')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'配送中'/t('myPrizes.statusShipping')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'已送达'/t('myPrizes.statusDelivered')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'已转售'/t('myPrizes.statusResold')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'发货申请已提交'/t('myPrizes.shippingRequestSuccess')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'提交失败,请重试'/t('myPrizes.shippingRequestFailed')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'请输入收货人姓名'/t('myPrizes.pleaseEnterRecipientName')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'请输入详细地址'/t('myPrizes.pleaseEnterAddress')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'申请发货'/t('myPrizes.applyShipping')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'转售'/t('myPrizes.resell')/g" src/pages/MyPrizesPage.tsx
echo "✅ MyPrizesPage translated"

# LotteryDetailPage.tsx
sed -i "s/'请先登录'/t('errors.pleaseLogin')/g" src/pages/LotteryDetailPage.tsx
sed -i "s/'余额不足'/t('errors.insufficientBalance')/g" src/pages/LotteryDetailPage.tsx
sed -i "s/'已售罄'/t('lottery.soldOut')/g" src/pages/LotteryDetailPage.tsx
sed -i "s/'超过限购'/t('errors.exceedsLimit')/g" src/pages/LotteryDetailPage.tsx
sed -i "s/'匿名用户'/t('errors.anonymousUser')/g" src/pages/LotteryDetailPage.tsx
echo "✅ LotteryDetailPage translated"

# ExchangePage.tsx
sed -i "s/'兑换失败:'/t('withdraw.submitFailed') + ':'/g" src/pages/ExchangePage.tsx
echo "✅ ExchangePage translated"

# InvitePage.tsx
sed -i "s/'邀请链接已复制到剪贴板'/t('invite.linkCopied')/g" src/pages/InvitePage.tsx
sed -i "s/'邀请码已复制到剪贴板'/t('invite.codeCopied')/g" src/pages/InvitePage.tsx
sed -i "s/'分享失败:'/t('common.error') + ':'/g" src/pages/InvitePage.tsx
echo "✅ InvitePage translated"

# MarketPage.tsx
sed -i "s/'获取转售列表失败'/t('errors.failedToLoad')/g" src/pages/MarketPage.tsx
sed -i "s/'未知商品'/t('common.unknown')/g" src/pages/MarketPage.tsx
echo "✅ MarketPage translated"

# WithdrawPage.tsx
sed -i "s/'提交提现申请失败:'/t('withdraw.submitFailed') + ':'/g" src/pages/WithdrawPage.tsx
echo "✅ WithdrawPage translated"

# ProfilePage.tsx - already using t() mostly
# SettingsPage.tsx
sed -i "s/'语言已切换为中文'/t('settings.languageChangedToZh')/g" src/pages/SettingsPage.tsx
sed -i "s/'语言已切换'/t('settings.languageChanged')/g" src/pages/SettingsPage.tsx
sed -i "s/'语言切换失败:'/t('settings.languageChangeFailed') + ':'/g" src/pages/SettingsPage.tsx
sed -i "s/'语言切换失败'/t('settings.languageChangeFailed')/g" src/pages/SettingsPage.tsx
echo "✅ SettingsPage translated"

echo ""
echo "🎉 All critical files translated!"
