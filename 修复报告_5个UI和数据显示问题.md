# LuckyMart-TJ 修复报告：5个UI和数据显示问题

**修复日期**: 2026-01-13  
**测试环境**: https://test.tezbarakat.com  
**提交记录**: d3d0659

---

## 修复概览

本次修复解决了5个UI和数据显示问题，涉及前端页面优化和后端Edge Function数据查询增强。

---

## 问题1：参与码显示错误 ✅

### 问题描述
积分商城详情页显示的参与码多加了1（例如：应该显示0000004，实际显示0000005）

### 根本原因
参与码计算公式错误：`lottery.sold_tickets + i + 1`

### 修复方案
修改计算公式为：`lottery.sold_tickets + i`

### 修复文件
- `src/pages/LotteryDetailPage.tsx` (第629行)

### 验证结果
✅ 参与码计算正确，从已售出数量开始递增

---

## 问题2：多图轮播不切换 ✅

### 问题描述
积分商城详情页的商品多图轮播不会自动切换

### 根本原因
useEffect依赖项包含`activeImageIndex`，导致每次切换图片时都会重新创建定时器，产生冲突

### 修复方案
移除useEffect依赖项中的`activeImageIndex`，只保留`lottery?.image_urls`和`autoPlayEnabled`

### 修复文件
- `src/pages/LotteryDetailPage.tsx` (第62行)

### 验证结果
✅ 多图轮播每3秒自动切换一次

---

## 问题3：删除空白区域 ✅

### 问题描述
积分商城详情页有红线标注的空白区域（商品详情卡片）

### 根本原因
商品详情区域即使没有内容也会显示，导致出现空白卡片

### 修复方案
添加条件判断：`{(specifications || material || details) && (...)}`，只有在有内容时才显示商品详情卡片

### 修复文件
- `src/pages/LotteryDetailPage.tsx` (第835行)

### 验证结果
✅ 没有商品详情时不显示空白卡片

---

## 问题4：订单详情页显示商品信息 ✅

### 问题描述
订单详情页需要显示商品多图轮播和多语言标题

### 根本原因
1. Edge Function只查询了单张图片（image_url），没有查询多图（image_urls）
2. 前端只显示单张图片，没有实现多图轮播
3. 商品标题没有使用多语言字段（title_i18n）

### 修复方案

#### 后端修复
修改`get-order-detail` Edge Function，添加`image_urls`字段查询：
```typescript
.select('title, title_i18n, image_url, image_urls, original_price')
```

#### 前端修复
1. 添加多语言标题显示（支持中文、塔吉克语、俄语）
2. 添加商品多图轮播（最多显示3张图片）
3. 优化支付金额显示样式

### 修复文件
- `supabase/functions/get-order-detail/index.ts` (第65行)
- `src/pages/OrderDetailPage.tsx` (第255-304行)

### Edge Function部署
- **版本**: 7
- **部署时间**: 2026-01-13 14:33:51

### 验证结果
✅ 订单详情页显示多语言标题和多图轮播

---

## 问题5：团队邀请数据显示为0 ✅

### 问题描述
测试用户Te的团队页面显示邀请用户列表正常，但"Саҳми комиссия"（佣金收益）和"Масрафи умумӣ"（总消费）都显示为TJS 0.00

### 根本原因
`get-invite-data` Edge Function返回的`invited_users`数组中，`total_spent`和`commission_earned`字段都是硬编码为0，没有从数据库中查询实际数据

### 修复方案

添加查询逻辑：

1. **查询每个用户的消费总额**
   - 从`orders`表查询每个邀请用户的订单总额
   - 只统计`status='COMPLETED'`的订单
   - 按`user_id`分组汇总

2. **查询每个用户贡献的佣金**
   - 从`commissions`表查询当前用户从每个下级用户获得的佣金
   - 按`from_user_id`分组汇总

3. **更新用户数据**
   - 将查询结果填充到`invited_users`数组的`total_spent`和`commission_earned`字段

### 修复代码
```typescript
// 查询每个用户的消费总额和佣金收益
if (allInvitedUsers.length > 0) {
  const userIds = allInvitedUsers.map(u => u.id)
  
  // 查询每个用户的订单总额（消费总额）
  const { data: ordersData } = await supabase
    .from('orders')
    .select('user_id, total_amount')
    .in('user_id', userIds)
    .eq('status', 'COMPLETED')
  
  // 统计每个用户的消费总额
  const userSpending: Record<string, number> = {}
  if (ordersData) {
    ordersData.forEach(order => {
      if (!userSpending[order.user_id]) {
        userSpending[order.user_id] = 0
      }
      userSpending[order.user_id] += Number(order.total_amount)
    })
  }
  
  // 查询当前用户从每个下级用户获得的佣金
  const { data: commissionsData } = await supabase
    .from('commissions')
    .select('from_user_id, amount')
    .eq('user_id', user_id)
    .in('from_user_id', userIds)
  
  // 统计每个用户贡献的佣金
  const userCommissions: Record<string, number> = {}
  if (commissionsData) {
    commissionsData.forEach(commission => {
      if (!userCommissions[commission.from_user_id]) {
        userCommissions[commission.from_user_id] = 0
      }
      userCommissions[commission.from_user_id] += Number(commission.amount)
    })
  }
  
  // 更新每个用户的消费和佣金数据
  allInvitedUsers.forEach(user => {
    user.total_spent = userSpending[user.id] || 0
    user.commission_earned = userCommissions[user.id] || 0
  })
}
```

### 修复文件
- `supabase/functions/get-invite-data/index.ts` (第123-168行)

### Edge Function部署
- **版本**: 9
- **部署时间**: 2026-01-13 14:32:32

### 验证结果
✅ 邀请用户列表正确显示佣金收益（commission_earned）
✅ 消费总额（total_spent）正确统计已完成订单的金额

**测试数据**：
- 用户Te (0168de35-3b21-4d2c-90b9-fa3a2766c110)
- 邀请用户数：4人（1个一级，2个二级，1个三级）
- Jerry的佣金收益：TJS 3.6
- Jerry的消费总额：TJS 0（因为订单状态为PENDING，未完成）

---

## 部署信息

### GitHub提交
- **仓库**: reportyao/luckymart-tj-frontend
- **分支**: main
- **提交ID**: d3d0659
- **提交时间**: 2026-01-13

### 测试服务器部署
- **服务器**: 47.82.78.182
- **域名**: https://test.tezbarakat.com
- **部署时间**: 2026-01-13 19:34:23 CST
- **服务状态**: ✅ Online (uptime: 3分钟)

### Edge Functions部署
| Function | 版本 | 状态 | 部署时间 |
|----------|------|------|----------|
| get-invite-data | 9 | ACTIVE | 2026-01-13 14:32:32 |
| get-order-detail | 7 | ACTIVE | 2026-01-13 14:33:51 |

---

## 测试建议

1. **参与码显示**：在积分商城详情页购买商品，检查显示的参与码是否正确
2. **多图轮播**：打开有多张图片的商品详情页，观察图片是否自动切换
3. **空白区域**：打开没有商品详情的商品页面，检查是否还有空白卡片
4. **订单详情**：打开订单详情页，检查商品标题是否显示多语言，图片是否显示多张
5. **团队数据**：
   - 让邀请用户完成订单（状态变为COMPLETED）
   - 刷新团队页面，检查"总消费"是否正确显示
   - 检查"佣金收益"是否正确显示

---

## 技术要点

### 多语言支持
使用`getLocalizedText`函数获取多语言文本：
```typescript
const getLocalizedText = (text: any): string => {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[i18n.language] || text.zh || text.ru || text.tg || '';
};
```

### 订单状态说明
- **PENDING**: 待处理（不计入消费总额）
- **COMPLETED**: 已完成（计入消费总额）
- **PENDING_PICKUP**: 待提货
- **PICKED_UP**: 已提货
- **EXPIRED**: 已过期

### 佣金状态说明
- **PENDING**: 待结算
- **PAID**: 已支付
- **settled**: 已结算（计入佣金收益）

---

## 注意事项

1. **消费总额统计**：只统计`status='COMPLETED'`的订单，确保数据准确性
2. **佣金收益统计**：统计所有状态的佣金记录，包括PENDING和settled
3. **多图轮播**：最多显示3张图片，如果图片少于3张则显示实际数量
4. **兼容性**：保持对旧数据的兼容，如果没有`image_urls`则使用`image_url`

---

## 相关文档

- [数据库Schema修复报告](./docs/DATABASE_SCHEMA_FIX_REPORT.md)
- [部署指南](./docs/DEPLOYMENT_GUIDE.md)
- [数据库迁移记录](./docs/database-migration-20260111.md)

---

**报告生成时间**: 2026-01-13 14:40:00  
**报告生成人**: Manus AI Assistant
