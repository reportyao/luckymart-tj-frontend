# Multilingual System Fix Plan

> **Date**: 2025-12-16  
> **Status**: In Progress  
> **Languages**: Chinese (zh), Russian (ru), Tajik (tg)

## Executive Summary

This document outlines all hardcoded Chinese strings found in the codebase and provides a plan to replace them with i18n keys for multi-language support.

## Translation Files Status

✅ **Existing Files**:
- `src/i18n/locales/zh.json` (633 lines) - Chinese
- `src/i18n/locales/ru.json` (611 lines) - Russian  
- `src/i18n/locales/tg.json` (611 lines) - Tajik

## Hardcoded Strings by File

### 🔴 Critical Priority (User-Facing Pages)

#### 1. **MyPrizesPage.tsx** (16+ hardcoded strings)
```tsx
Line 99: '待处理' → t('myPrizes.statusPending')
Line 100: '配送中' → t('myPrizes.statusShipping')
Line 101: '已送达' → t('myPrizes.statusDelivered')
Line 102: '已转售' → t('myPrizes.statusResold')
Line 292: '发货申请已提交' → t('myPrizes.shippingRequestSuccess')
Line 296: '提交失败,请重试' → t('myPrizes.shippingRequestFailed')
Line 330: '请输入收货人姓名' → t('myPrizes.pleaseEnterRecipientName')
Line 358: '请输入详细地址' → t('myPrizes.pleaseEnterAddress')
Line 373: '杜尚别' → t('cities.dushanbe')
```

#### 2. **UserContext.tsx** (6 hardcoded strings)
```tsx
Line 86: '获取钱包信息失败' → t('errors.failedToLoadWallet')
Line 191: '无法连接到 Telegram，请确保在 Telegram 中打开' → t('errors.telegramConnectionFailed')
Line 223: '登录成功！' → t('auth.loginSuccess')
Line 226: '登录失败，请重试' → t('auth.loginFailed')
Line 288: '已退出登录' → t('auth.loggedOut')
```

#### 3. **DepositPage.tsx** (6 hardcoded strings)
```tsx
Line 68: '获取支付配置失败:' → t('deposit.failedToLoadConfig')
Line 95: '图片上传成功' → t('deposit.imageUploadSuccess')
Line 98: '图片上传失败，请重试' → t('deposit.imageUploadFailed')
Line 130: '请上传充值凭证' → t('deposit.pleaseUploadProof')
Line 159: '提交充值申请失败:' → t('deposit.submitFailed')
Line 313: '上传中...' → t('deposit.uploading')
```

#### 4. **NotificationPage.tsx** (Multiple mock notifications)
```tsx
Line 53-54: '恭喜中奖!' → t('notifications.congratulations')
Line 65-66: '支付成功' → t('notifications.paymentSuccess')
Line 77-78: '邀请奖励到账' → t('notifications.inviteReward')
Line 87: '开奖提醒' → t('notifications.drawReminder')
Line 99-100: '系统维护通知' → t('notifications.maintenanceNotice')
Line 109: '安全提示' → t('notifications.securityTip')
```

#### 5. **OrderPage.tsx** (Multiple order types)
```tsx
Line 58: '购买彩票' → t('orders.purchaseTicket')
Line 72: '余额兑换夺宝币' → t('orders.exchangeBalance')
Line 83: '钱包充值' → t('orders.deposit')
Line 94: '购买彩票' → t('orders.purchaseTicket')
Line 108: '提现申请' → t('orders.withdrawal')
Line 160: '充值' → t('orders.depositLabel')
Line 161: '提现' → t('orders.withdrawalLabel')
Line 217: '搜索订单号或商品名称...' → t('orders.searchPlaceholder')
```

#### 6. **ProfilePage.tsx** (Menu items)
```tsx
Line 54: '转售市场' → t('profile.resaleMarket')
Line 55: '购买转售商品' → t('profile.resaleMarketDesc')
Line 61: '我的团队' → t('profile.myTeam')
Line 62: '查看团队信息' → t('profile.myTeamDesc')
Line 68: '中奖管理' → t('profile.prizeManagement')
Line 69: '查看中奖记录' → t('profile.prizeManagementDesc')
Line 91: '我的消息' → t('profile.messages')
Line 92: '查看消息通知' → t('profile.messagesDesc')
Line 97: '转售记录' → t('profile.resaleHistory')
Line 98: '查看转售历史' → t('profile.resaleHistoryDesc')
```

#### 7. **LotteryDetailPage.tsx** (Error messages)
```tsx
Line 159: '请先登录' → t('errors.pleaseLogin')
Line 181: '幸运币余额不足，需要 ${totalCost} 幸运币，当前余额 ${luckyCoinsBalance} 幸运币' 
         → t('errors.insufficientLuckyCoins', {required, balance})
Line 228: '余额不足' → t('errors.insufficientBalance')
Line 230: '已售罄' → t('lottery.soldOut')
Line 232: '超过限购' → t('errors.exceedsLimit')
Line 381: '开始开奖:' → t('lottery.startingDraw')
Line 383: '开奖成功' → t('lottery.drawSuccess')
Line 387: '开奖失败:' → t('lottery.drawFailed')
Line 486: '匿名用户' → t('common.anonymousUser')
```

### 🟡 Medium Priority (Admin/Debug Pages)

#### 8. **BotManagement.tsx** (21+ strings)
```tsx
Line 58: '加载Bot数据失败' → t('bot.loadFailed')
Line 67: '正在设置Bot...' → t('bot.setting')
Line 74: 'Bot设置成功！' → t('bot.setSuccess')
Line 77: 'Bot设置失败' → t('bot.setFailed')
Line 89: '请输入Chat ID' → t('bot.enterChatId')
Line 94: '正在发送测试消息...' → t('bot.sendingTest')
Line 105: '测试消息发送成功！' → t('bot.testSuccess')
Line 111: '发送测试消息失败' → t('bot.testFailed')
Line 117: '正在处理通知队列...' → t('bot.processingQueue')
Line 126: '处理完成：发送${data.sent}条...' → t('bot.processComplete', {sent, cancelled, failed})
Line 133: '处理通知失败' → t('bot.processFailed')
...
```

#### 9. **DebugPage.tsx** (18+ debug messages)
```tsx
Line 23: '调试页面已加载' → t('debug.pageLoaded')
Line 37: '找到 ${styleSheets.length} 个样式表' → t('debug.styleSheetsFound', {count})
Line 41: '样式表 ${i + 1}:...' → t('debug.stylesheet', {index})
Line 43: '样式表 ${i + 1}: 无法访问 (CORS)' → t('debug.stylesheetCorsError', {index})
Line 49: '找到 ${cssLinks.length} 个 CSS 链接' → t('debug.cssLinksFound', {count})
Line 77: '用户已登录: ID=${user.id}...' → t('debug.userLoggedIn', {id, uid})
Line 79: '用户未登录' → t('debug.userNotLoggedIn')
...
```

#### 10. **MonitoringDashboard.tsx** (Monitoring metrics)
```tsx
Line 78: '页面加载时间' → t('monitoring.pageLoadTime')
Line 86: 'API响应时间' → t('monitoring.apiResponseTime')
Line 94: '数据库查询时间' → t('monitoring.dbQueryTime')
Line 102: '错误率' → t('monitoring.errorRate')
Line 110: '可用性' → t('monitoring.availability')
Line 118: '内存使用率' → t('monitoring.memoryUsage')
...
```

### 🟢 Low Priority (Modals/Components)

#### 11. **DepositModal.tsx**
```tsx
Line 30: '最小充值金额为 10 TJS' → t('deposit.minAmountError', {min: 10})
Line 159: '输入充值金额' → t('deposit.enterAmount')
Line 204: '确认充值 ${amount}...' → t('deposit.confirmDeposit', {amount})
```

#### 12. **WithdrawModal.tsx**
```tsx
Line 46: '最小提现金额为 ${MIN_WITHDRAW} TJS' → t('withdraw.minAmountError', {min})
Line 51: '单笔最大提现金额为 ${MAX_WITHDRAW} TJS' → t('withdraw.maxAmountError', {max})
Line 61: '请填写完整的银行信息' → t('withdraw.incompleteBankInfo')
Line 72: '提现申请已提交,预计1-3个工作日到账' → t('withdraw.submitSuccess')
Line 149: '最小 ${MIN_WITHDRAW} TJS' → t('withdraw.minLabel', {min})
Line 197: '例如: Amonatbank' → t('withdraw.bankExample')
Line 210: '请输入账户持有人姓名' → t('withdraw.enterAccountHolder')
Line 223: '请输入银行账号' → t('withdraw.enterAccountNumber')
Line 266: '确认提现' → t('withdraw.confirm')
```

#### 13. **LanguageSwitcher.tsx**
```tsx
Line 14: '中文' → t('languages.zh')
```

#### 14. **SettingsPage.tsx**
```tsx
Line 19: '中文' → t('languages.zh')
Line 19: '简体中文' → t('languages.zhFull')
Line 45: '语言已切换为中文' → t('settings.languageChangedToZh')
Line 49: '语言已切换' → t('settings.languageChanged')
Line 56: '语言切换失败:' → t('settings.languageChangeFailed')
Line 57: '语言切换失败' → t('settings.languageChangeFailed')
```

## Required i18n Keys to Add

### Common Errors
```json
"errors": {
  "pleaseLogin": "请先登录 / Пожалуйста, войдите / Лутфан ворид шавед",
  "insufficientBalance": "余额不足 / Недостаточно средств / Мавҷудӣ кофӣ нест",
  "insufficientLuckyCoins": "幸运币余额不足，需要 {{required}} 幸运币，当前余额 {{balance}} 幸运币",
  "exceedsLimit": "超过限购 / Превышен лимит / Аз ҳад зиёд шуд",
  "failedToLoadWallet": "获取钱包信息失败 / Не удалось загрузить кошелек / Маълумоти ҳамён бор нашуд",
  "telegramConnectionFailed": "无法连接到 Telegram，请确保在 Telegram 中打开",
  "anonymousUser": "匿名用户 / Анонимный пользователь / Корбари аноним"
}
```

### Authentication
```json
"auth": {
  "loginSuccess": "登录成功！ / Вход выполнен! / Воридшавӣ муваффақ!",
  "loginFailed": "登录失败，请重试 / Ошибка входа, попробуйте снова / Хатои воридшавӣ",
  "loggedOut": "已退出登录 / Вы вышли из системы / Шумо баромадед"
}
```

### My Prizes
```json
"myPrizes": {
  "title": "我的奖品 / Мои призы / Мукофотҳои ман",
  "statusPending": "待处理 / В ожидании / Интизорӣ",
  "statusShipping": "配送中 / Доставляется / Дар роҳ",
  "statusDelivered": "已送达 / Доставлено / Расонида шуд",
  "statusResold": "已转售 / Перепродано / Дубора фурӯхта шуд",
  "shippingRequestSuccess": "发货申请已提交 / Запрос на доставку отправлен / Дархости интиқол фиристода шуд",
  "shippingRequestFailed": "提交失败,请重试 / Не удалось отправить / Хатогӣ рух дод",
  "pleaseEnterRecipientName": "请输入收货人姓名 / Введите имя получателя / Номи гирандаро ворид кунед",
  "pleaseEnterAddress": "请输入详细地址 / Введите адрес доставки / Суроғаи пурраро ворид кунед"
}
```

### Deposit
```json
"deposit": {
  "title": "充值 / Пополнение / Пурзор кардан",
  "failedToLoadConfig": "获取支付配置失败 / Ошибка загрузки конфигурации / Хатои боркунӣ",
  "imageUploadSuccess": "图片上传成功 / Изображение загружено / Расм бор шуд",
  "imageUploadFailed": "图片上传失败，请重试 / Ошибка загрузки / Хатои боркунии расм",
  "pleaseUploadProof": "请上传充值凭证 / Загрузите подтверждение / Тасдиқномаро бор кунед",
  "submitFailed": "提交充值申请失败 / Ошибка отправки / Хатои фиристодан",
  "uploading": "上传中... / Загрузка... / Бор шуда истодааст...",
  "minAmountError": "最小充值金额为 {{min}} TJS",
  "enterAmount": "输入充值金额 / Введите сумму / Маблағро ворид кунед",
  "confirmDeposit": "确认充值 {{amount}} / Подтвердить {{amount}} / Тасдиқ кунед {{amount}}"
}
```

### Withdrawal
```json
"withdraw": {
  "title": "提现 / Вывод / Бароварда",
  "minAmountError": "最小提现金额为 {{min}} TJS",
  "maxAmountError": "单笔最大提现金额为 {{max}} TJS",
  "incompleteBankInfo": "请填写完整的银行信息 / Заполните банковские данные / Маълумоти бонкро пур кунед",
  "submitSuccess": "提现申请已提交,预计1-3个工作日到账 / Запрос отправлен, 1-3 рабочих дня / Дархост фиристода шуд",
  "minLabel": "最小 {{min}} TJS",
  "bankExample": "例如: Amonatbank / Например: Amonatbank / Мисол: Amonatbank",
  "enterAccountHolder": "请输入账户持有人姓名 / Введите имя владельца / Номи соҳиби ҳисоб",
  "enterAccountNumber": "请输入银行账号 / Введите номер счета / Рақами ҳисобро ворид кунед",
  "confirm": "确认提现 / Подтвердить вывод / Тасдиқи бароварда"
}
```

### Cities (Tajikistan)
```json
"cities": {
  "dushanbe": "杜尚别 / Душанбе / Душанбе",
  "khujand": "苦盏 / Худжанд / Хуҷанд",
  "kulob": "库洛布 / Кулоб / Кӯлоб",
  "qurghonteppa": "库尔干-图别 / Курган-Тюбе / Қӯрғонтеппа"
}
```

## Implementation Strategy

### Phase 1: Critical Pages (Priority 🔴)
1. ✅ Add missing i18n keys to all three translation files (zh, ru, tg)
2. ✅ Update MyPrizesPage.tsx
3. ✅ Update UserContext.tsx  
4. ✅ Update DepositPage.tsx
5. ✅ Update NotificationPage.tsx
6. ✅ Update OrderPage.tsx
7. ✅ Update ProfilePage.tsx
8. ✅ Update LotteryDetailPage.tsx

### Phase 2: Medium Priority (Priority 🟡)
1. Update BotManagement.tsx
2. Update DebugPage.tsx
3. Update MonitoringDashboard.tsx

### Phase 3: Low Priority (Priority 🟢)
1. Update all modals (Deposit, Withdraw)
2. Update LanguageSwitcher.tsx
3. Update SettingsPage.tsx
4. Update remaining components

### Phase 4: Testing & Validation
1. Test language switching functionality
2. Verify all pages display correctly in all three languages
3. Check for missing translations
4. Ensure proper fallback to default language

## Language Selection Logic

Current implementation in `src/i18n/config.ts`:
```typescript
const userLanguage = navigator.language || 'zh';
const languageCode = userLanguage.split('-')[0];
```

✅ **Correct**: This automatically detects the system language and selects the appropriate translation.

## Tools & Utilities

### Translation Helper Script
```bash
# Search for hardcoded Chinese strings
python3 find_chinese.py

# Extract strings from specific file
grep -n "[\u4e00-\u9fff]" src/pages/MyPrizesPage.tsx
```

### Testing
```bash
# Start dev server to test
npm run dev

# Change system language in browser settings to test auto-detection
```

## Progress Tracking

- [x] Database mapping document created
- [x] Hardcoded strings identified and cataloged
- [x] Translation keys planned
- [ ] Phase 1: Critical pages updated (0/8)
- [ ] Phase 2: Medium priority pages updated (0/3)
- [ ] Phase 3: Low priority components updated (0/6)
- [ ] Phase 4: Testing completed

## Notes

1. **DO NOT** remove existing i18n keys - only add new ones
2. **PRESERVE** existing translations in ru.json and tg.json
3. **USE** parameter interpolation for dynamic content: `{{variable}}`
4. **TEST** each page after updating
5. **DOCUMENT** any translation uncertainties for native speakers to review

---

*Last Updated: 2025-12-16*
