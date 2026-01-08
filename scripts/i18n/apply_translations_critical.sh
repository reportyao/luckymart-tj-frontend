#!/bin/bash

# 关键文件的硬编码字符串替换

echo "Applying translations to critical files..."

# UserContext.tsx - 6 strings
sed -i "s/toast.error('获取钱包信息失败')/toast.error(t('errors.failedToLoadWallet'))/g" src/contexts/UserContext.tsx
sed -i "s/'无法连接到 Telegram，请确保在 Telegram 中打开'/t('errors.telegramConnectionFailed')/g" src/contexts/UserContext.tsx  
sed -i "s/'登录成功！'/t('auth.loginSuccess')/g" src/contexts/UserContext.tsx
sed -i "s/'登录失败，请重试'/t('auth.loginFailed')/g" src/contexts/UserContext.tsx
sed -i "s/'已退出登录'/t('auth.loggedOut')/g" src/contexts/UserContext.tsx

# DepositPage.tsx
sed -i "s/'获取支付配置失败:'/t('deposit.failedToLoadConfig')/g" src/pages/DepositPage.tsx
sed -i "s/'图片上传成功'/t('deposit.imageUploadSuccess')/g" src/pages/DepositPage.tsx
sed -i "s/'图片上传失败，请重试'/t('deposit.imageUploadFailed')/g" src/pages/DepositPage.tsx
sed -i "s/'请上传充值凭证'/t('deposit.pleaseUploadProof')/g" src/pages/DepositPage.tsx
sed -i "s/'提交充值申请失败:'/t('deposit.submitFailed')/g" src/pages/DepositPage.tsx
sed -i "s/'上传中...'/t('deposit.uploading')/g" src/pages/DepositPage.tsx

# MyPrizesPage.tsx
sed -i "s/'奖品'/t('myPrizes.title')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'待处理'/t('myPrizes.statusPending')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'配送中'/t('myPrizes.statusShipping')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'已送达'/t('myPrizes.statusDelivered')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'已转售'/t('myPrizes.statusResold')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'发货申请已提交'/t('myPrizes.shippingRequestSuccess')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'提交失败,请重试'/t('myPrizes.shippingRequestFailed')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'请输入收货人姓名'/t('myPrizes.pleaseEnterRecipientName')/g" src/pages/MyPrizesPage.tsx
sed -i "s/'请输入详细地址'/t('myPrizes.pleaseEnterAddress')/g" src/pages/MyPrizesPage.tsx

# LotteryDetailPage.tsx
sed -i "s/'请先登录'/t('errors.pleaseLogin')/g" src/pages/LotteryDetailPage.tsx
sed -i "s/'余额不足'/t('errors.insufficientBalance')/g" src/pages/LotteryDetailPage.tsx
sed -i "s/'已售罄'/t('lottery.soldOut')/g" src/pages/LotteryDetailPage.tsx
sed -i "s/'超过限购'/t('errors.exceedsLimit')/g" src/pages/LotteryDetailPage.tsx
sed -i "s/'匿名用户'/t('errors.anonymousUser')/g" src/pages/LotteryDetailPage.tsx

echo "✅ Translations applied to critical files"
