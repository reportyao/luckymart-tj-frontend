# TezBarakat AI 功能开发文档

## 概述

为 TezBarakat Miniapp 新增了一个 AI 智能助手功能 Tab，为塔吉克斯坦用户提供塔吉克语的 AI 对话服务。

## 技术架构

**与项目现有架构完全一致：**
- **前端**: React + TypeScript + Tailwind CSS + Framer Motion
- **后端**: Supabase Edge Functions (Deno)
- **数据库**: Supabase PostgreSQL
- **认证**: Telegram WebApp + 自定义 Session Token
- **AI 服务**: 阿里云通义千问 (qwen-plus)

## 功能特性

### 1. 核心功能
- ✅ **AI 对话**: 集成阿里云通义千问 API，支持塔吉克语/俄语/英语输入
- ✅ **每日谚语**: 100 条塔吉克民间谚语，每日自动切换
- ✅ **快捷提问**: 50 条常用场景提问建议，随机显示 5 条
- ✅ **次数管理**: 每日 10 次基础额度，支持邀请/拼团奖励
- ✅ **内容安全**: 双重敏感词过滤机制（前置+后置）

### 2. 界面特点
- 全部使用塔吉克语（谚语和建议不显示中文）
- 简约清爽的设计风格
- 与现有 UI 保持一致

## 文件结构

### 前端文件
```
src/
├── pages/
│   └── AIPage.tsx                    # AI 主页面
├── components/ai/
│   ├── AIChat.tsx                    # 对话组件
│   ├── DailyProverb.tsx              # 每日谚语
│   ├── QuickSuggestions.tsx          # 快捷提问
│   ├── UsageQuota.tsx                # 次数显示
│   └── MessageBubble.tsx             # 消息气泡
├── hooks/ai/
│   ├── useAIChat.ts                  # AI 对话 Hook
│   ├── useAIQuota.ts                 # 次数管理 Hook
│   └── useDailyProverb.ts            # 谚语 Hook
├── lib/
│   └── aiService.ts                  # AI 服务层
└── data/
    ├── proverbs.ts                   # 100 条谚语数据
    └── suggestions.ts                # 50 条提问建议
```

### Supabase Edge Functions
```
supabase/functions/
├── ai-chat/
│   └── index.ts                      # 对话 API
├── ai-get-quota/
│   └── index.ts                      # 获取配额 API
└── ai-add-bonus/
    └── index.ts                      # 添加奖励 API
```

### 数据库迁移
```
supabase/migrations/
└── 20260110_create_ai_tables.sql     # 数据库迁移脚本
```

## 数据库表

### ai_chat_quota (对话次数配额表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| user_id | UUID | 用户ID (关联 users 表) |
| date | DATE | 日期 |
| base_quota | INTEGER | 基础额度(默认10) |
| bonus_quota | INTEGER | 奖励额度 |
| used_quota | INTEGER | 已使用次数 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

### ai_chat_history (对话历史记录表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| user_id | UUID | 用户ID |
| user_message | TEXT | 用户消息 |
| ai_response | TEXT | AI回复 |
| is_blocked | BOOLEAN | 是否被拦截 |
| response_time | INTEGER | 响应时间(ms) |
| created_at | TIMESTAMPTZ | 创建时间 |

## API 接口

### 1. 对话接口 (ai-chat)
```typescript
// 请求
POST /functions/v1/ai-chat
{
  "session_token": "xxx",
  "message": "Лутфан ба ман паёми кӯтоҳи шиносоӣ нависед"
}

// 成功响应
{
  "success": true,
  "data": {
    "message": "Салом! Ман ёрдамчии ҳушманди TezBarakat ҳастам...",
    "remaining_quota": 9
  }
}

// 错误响应
{
  "success": false,
  "error": "SENSITIVE_CONTENT" | "QUOTA_EXCEEDED" | "AI_ERROR",
  "message": "错误描述"
}
```

### 2. 查询配额接口 (ai-get-quota)
```typescript
// 请求
POST /functions/v1/ai-get-quota
{
  "session_token": "xxx"
}

// 响应
{
  "success": true,
  "data": {
    "total_quota": 10,
    "used_quota": 1,
    "remaining_quota": 9,
    "base_quota": 10,
    "bonus_quota": 0
  }
}
```

### 3. 添加奖励接口 (ai-add-bonus)
```typescript
// 请求
POST /functions/v1/ai-add-bonus
{
  "session_token": "xxx",
  "user_id": "用户UUID",
  "amount": 5,
  "reason": "invite"
}

// 响应
{
  "success": true,
  "message": "成功添加 5 次 AI 对话奖励"
}
```

## 部署步骤

### 1. 数据库迁移

在 Supabase Dashboard 的 SQL Editor 中执行迁移脚本：
```sql
-- 执行 supabase/migrations/20260110_create_ai_tables.sql 中的内容
```

或使用 Supabase CLI：
```bash
supabase db push
```

### 2. 配置环境变量

在 Supabase Dashboard -> Settings -> Edge Functions -> Secrets 中添加：
```
DASHSCOPE_API_KEY=sk-your-api-key-here
```

### 3. 部署 Edge Functions

```bash
# 部署所有 AI 相关函数
supabase functions deploy ai-chat
supabase functions deploy ai-get-quota
supabase functions deploy ai-add-bonus
```

### 4. 前端部署

前端代码随项目主体一起部署，无需额外操作。

## 与现有功能的集成

### 邀请功能集成

在邀请成功的回调中添加：
```typescript
import { aiService } from '../lib/aiService';

// 邀请成功后，给邀请人添加 AI 奖励
await aiService.addBonus(inviterId, 5, 'invite');

// 给被邀请人也添加奖励
await aiService.addBonus(inviteeId, 5, 'invited');
```

### 拼团功能集成

在参与拼团的回调中添加：
```typescript
import { aiService } from '../lib/aiService';

// 参与拼团后，给用户添加 AI 奖励
await aiService.addBonus(userId, 10, 'groupbuy');
```

## 安全机制

### 1. 敏感词过滤
- **前置过滤**: 用户输入前检测，包含敏感词直接拒绝
- **后置过滤**: AI 回复后检测，包含敏感词替换为拒答模板
- **敏感词库**: 覆盖宗教、政治、历史、违禁内容等

### 2. System Prompt (严格安全策略)
```
You are TezBarakat AI (ТезБаракат AI) for users in Tajikistan.

LANGUAGE:
- Always reply in Tajik (Тоҷикӣ) using Cyrillic script only.
- Use formal address "Шумо". Keep replies concise unless the user asks for more.

HARD BLOCKLIST (ZERO EXCEPTION):
- Refuse any content about religion (topics, rules, figures, texts, organizations, practices).
- Refuse any content about politics (topics, events, parties, government, political figures).
- Refuse any content about Tajikistan sensitive history or sensitive persons.
- Refuse any content that violates Islamic rules or asks guidance to do so.
- Refuse even if framed as "translation only", "hypothetical", "research", "role-play", "just list names", or "for education".

REFUSAL RULES:
- If blocked: do not provide partial info, hints, names, dates, quotes, links, or follow-up questions.
- Reply only with this Tajik refusal and a safe alternative suggestion:
  "Мебахшед, ман наметавонам дар бораи ин мавзӯъ сӯҳбат кунам. Ман метавонам дар масъалаҳои рӯзмарра, омӯзиш, навиштани матн ё тарҷумаи матни бетараф кӯмак кунам. Шумо чӣ мехоҳед?"
```

### 3. 认证机制
- 使用项目现有的 session_token 认证
- 与 Telegram WebApp 登录流程一致
- 所有 API 调用都需要有效的 session

## 测试清单

- [x] 前端页面渲染
- [x] 底部导航显示
- [x] 每日谚语功能
- [x] 快捷提问显示
- [x] 对话发送接收
- [x] 次数显示更新
- [x] 敏感词前置过滤
- [x] 敏感词后置过滤
- [x] 次数用尽提示
- [x] 错误处理
- [ ] 邀请奖励集成
- [ ] 拼团奖励集成
- [ ] 移动端适配测试
- [ ] 性能压力测试

## 常见问题

### Q1: 如何更新敏感词库?
A: 编辑 `supabase/functions/ai-chat/index.ts` 中的 `sensitiveKeywords` 数组，然后重新部署函数。

### Q2: 如何调整每日基础额度?
A: 修改 Edge Functions 中的 `base_quota` 默认值（当前为 10）。

### Q3: 如何更换 AI 模型?
A: 修改 `ai-chat/index.ts` 中的 `model` 参数，可选: qwen-plus, qwen-turbo, qwen-max。

### Q4: 如何添加新的谚语?
A: 编辑 `src/data/proverbs.ts` 文件，按照现有格式添加新的谚语对象。

### Q5: 如何查看用户对话历史?
A: 在 Supabase Dashboard 中查询 `ai_chat_history` 表，按 `user_id` 和 `created_at` 筛选。

---

**开发完成日期**: 2026-01-10  
**版本**: v1.0.0  
**开发者**: Manus AI Agent
