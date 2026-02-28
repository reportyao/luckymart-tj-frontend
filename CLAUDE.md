# TezBarakat 前端项目 — AI 开发指令

> **本文件是 AI 辅助开发的强制规范。任何 AI 在修改本项目代码前，必须完整阅读本文件。**
> 本文件同时兼容 Cursor（.cursorrules）、Claude（CLAUDE.md）、Cline（.clinerules）等 AI 开发工具。

---

## 项目概述

TezBarakat 是一个面向塔吉克斯坦市场的 Telegram Mini App 电商平台，包含抽奖、拼团、积分商城等功能。技术栈：React + TypeScript + Vite + TailwindCSS v4 + Supabase + i18next。

---

## 关键规则（违反任何一条都会导致线上 Bug）

### 规则 1：i18n 翻译文件 — 只改 src，禁改 public

项目有两套 i18n 文件，**只能编辑 `src/i18n/locales/` 下的文件**：

```
src/i18n/locales/zh.json   ← ✅ 唯一编辑入口
src/i18n/locales/ru.json   ← ✅ 唯一编辑入口
src/i18n/locales/tg.json   ← ✅ 唯一编辑入口

public/locales/zh.json     ← ❌ 禁止直接编辑（构建时自动同步）
public/locales/ru.json     ← ❌ 禁止直接编辑（构建时自动同步）
public/locales/tg.json     ← ❌ 禁止直接编辑（构建时自动同步）
```

**原因**：`src/i18n/locales/tg.json` 通过 `import` 内联打包进 JS bundle（供 tg 用户零延迟加载），`public/locales/` 是供 zh/ru 用户 HTTP 动态加载的副本。构建时 `vite-plugin-timestamp.js` 会自动将 src 同步到 public。

**操作要求**：
- 新增/修改/删除翻译 key 时，**三个语言文件必须同时修改**
- 修改后运行 `pnpm i18n:validate` 确认三语 key 一致
- 如果修改了 zh 或 ru 的翻译内容，**必须**在 `vite.config.ts` 中将 `appVersion` 小版本号 +1（如 `2.5.1` → `2.5.2`），否则 Telegram 用户会因缓存看到旧翻译

### 规则 2：图片组件 — 使用 LazyImage，禁用 getOptimizedImageUrl

所有图片展示统一使用 `LazyImage` 组件，采用以下标准模式：

```tsx
// ✅ 正确用法：外层固定容器 + LazyImage 填充
<div style={{ position: 'relative', width: 80, height: 80, overflow: 'hidden', borderRadius: 8 }}>
  <LazyImage
    src={imageUrl}
    alt="描述"
    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
  />
</div>

// ❌ 错误用法：传 width/height 属性
<LazyImage src={url} width={80} height={80} />

// ❌ 错误用法：使用 getOptimizedImageUrl
<img src={getOptimizedImageUrl(url, { width: 160 })} />
```

**禁止事项**：
- 禁止给 `LazyImage` 传 `width` / `height` 属性
- 禁止使用 `getOptimizedImageUrl` 函数（已废弃，会导致缩略图放大）
- 禁止使用 `OptimizedImage` 组件（已废弃）
- 禁止自行实现 IntersectionObserver 懒加载（浏览器原生 `loading="lazy"` 已足够）

### 规则 3：CSS 样式 — 图片必须用内联 style

由于 Telegram WebApp 环境与 TailwindCSS v4 的 preflight 存在兼容性问题，**所有 `<img>` 和 `LazyImage` 的尺寸样式必须使用内联 `style`，不能使用 Tailwind className**：

```tsx
// ✅ 正确：内联 style
<img style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

// ❌ 错误：Tailwind className（在 Telegram WebView 中可能不生效）
<img className="w-full h-full object-cover" />
```

### 规则 4：版本管理 — 每次部署必须更新版本号

`vite.config.ts` 中的 `appVersion` 控制两件事：
1. i18n 翻译文件的缓存破坏（`/locales/zh.json?v=2.5.1`）
2. 整体版本标识

**每次涉及翻译文件修改的部署，都必须将 `appVersion` +1。**

### 规则 5：Git 分支 — main 和 production 必须同步

```bash
# 开发在 main 分支
git checkout main
# ... 修改代码 ...
git add . && git commit -m "fix: xxx"
git push origin main

# 同步到 production
git checkout production
git merge main --no-edit
git push origin production
git checkout main
```

---

## 项目架构速查

### 目录结构

```
src/
├── i18n/
│   ├── config.ts          # i18n 配置（语言检测、加载策略）
│   └── locales/           # ✅ 翻译文件主文件（唯一编辑入口）
│       ├── zh.json
│       ├── ru.json
│       └── tg.json
├── components/
│   ├── LazyImage.tsx      # 统一图片组件（v5，使用原生 loading="lazy"）
│   └── OptimizedImage.tsx # ❌ 已废弃，勿使用
├── lib/
│   └── utils.ts           # 工具函数（getOptimizedImageUrl 已废弃）
├── pages/                 # 页面组件
└── hooks/                 # 自定义 Hook

public/
├── locales/               # ❌ 翻译文件副本（自动同步，禁止手动编辑）
└── version.json           # 版本信息（构建时自动更新）

scripts/
├── i18n-sync.mjs          # 翻译文件同步脚本
└── i18n-validate.mjs      # 翻译文件校验脚本
```

### 可用命令

```bash
pnpm build              # 生产构建（自动同步 i18n）
pnpm i18n:sync          # 手动同步翻译文件
pnpm i18n:sync:check    # 检查两套文件是否一致
pnpm i18n:validate      # 校验三语 key 一致性
pnpm i18n:validate --strict  # 严格模式（空值报错）
```

---

## 常见任务操作指南

### 添加新翻译

1. 在 `src/i18n/locales/zh.json`、`ru.json`、`tg.json` 中添加相同的 key
2. 运行 `pnpm i18n:validate` 确认一致
3. 在 `vite.config.ts` 中 `appVersion` +1
4. 提交代码（pre-commit 会自动同步 public/locales/）

### 添加新页面

1. 在 `src/pages/` 创建页面组件
2. 图片使用 `LazyImage` + 外层固定容器模式
3. 文案使用 `t('namespace.key')` 国际化
4. 在路由配置中注册

### 修改现有页面

1. 修改前先理解组件的完整上下文
2. 不要引入 `getOptimizedImageUrl` 或 `OptimizedImage`
3. 图片样式用内联 style，不用 Tailwind className
4. 涉及翻译修改时遵循规则 1

### 部署到生产环境

```bash
# 1. 确保在 main 分支
git checkout main

# 2. 构建（自动同步 i18n + 更新 buildTime）
pnpm build

# 3. 打包上传
tar -czf dist.tar.gz dist/
scp dist.tar.gz root@47.82.73.79:/root/

# 4. 服务器部署
ssh root@47.82.73.79
cd /var/www/tezbarakat.com/html
rm -rf assets/*
tar -xzf /root/dist.tar.gz -C /tmp
cp -r /tmp/dist/* .
rm -rf /tmp/dist
chown -R www-data:www-data .
chmod -R 755 .

# 5. 同步 production 分支
git checkout production && git merge main --no-edit && git push origin production && git checkout main
```

---

## 自动化防护清单

以下机制会自动拦截常见错误，无需人工干预：

| 防护点 | 触发时机 | 拦截的错误 |
|--------|----------|-----------|
| `vite-plugin-timestamp.js` | `pnpm build` | i18n 两套文件不一致 |
| `.husky/pre-commit` 步骤 2 | `git commit` | 忘记同步 public/locales/ |
| `.husky/pre-commit` 步骤 3 | `git commit` | 三语 key 不一致 |
| `i18n-validate.mjs` | 手动 / CI | 翻译缺失或为空 |
| Vite content hash | `pnpm build` | JS/CSS 缓存问题 |
| `loadPath?v=appVersion` | 运行时 | 翻译文件 HTTP 缓存问题 |

---

## 绝对禁止事项

1. **禁止**直接编辑 `public/locales/*.json`
2. **禁止**使用 `getOptimizedImageUrl()` 函数
3. **禁止**使用 `OptimizedImage` 组件
4. **禁止**给 `LazyImage` 传 `width` / `height` 属性
5. **禁止**用 Tailwind className 设置 `<img>` 尺寸
6. **禁止**自行实现 IntersectionObserver 图片懒加载
7. **禁止**只修改一个语言文件而不同步其他两个
8. **禁止**修改翻译后不更新 `appVersion`
9. **禁止**只推送 main 不同步 production
