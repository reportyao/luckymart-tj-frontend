#!/usr/bin/env node
/**
 * pre-build-check.mjs
 *
 * 构建前自动检查脚本 — 拦截已知的常见错误模式
 *
 * 检查项：
 *   1. 代码中是否使用了已废弃的 getOptimizedImageUrl
 *   2. 代码中是否使用了已废弃的 OptimizedImage 组件
 *   3. LazyImage 是否被传了 width/height 属性
 *   4. i18n 两套文件是否一致
 *   5. 翻译文件三语 key 是否一致
 *
 * 用法：
 *   node scripts/pre-build-check.mjs
 *
 * 退出码：
 *   0 = 全部通过
 *   1 = 发现问题
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, dirname, extname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC_DIR = resolve(ROOT, 'src');

// ── 颜色输出 ──────────────────────────────────────────────────────────────
const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const CYAN   = '\x1b[36m';
const YELLOW = '\x1b[33m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

function log(color, ...args) {
  console.log(color + args.join(' ') + RESET);
}

// ── 工具函数 ──────────────────────────────────────────────────────────────
function walkDir(dir, extensions) {
  const results = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = resolve(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
        results.push(...walkDir(fullPath, extensions));
      } else if (stat.isFile() && extensions.includes(extname(entry))) {
        results.push(fullPath);
      }
    }
  } catch (e) {
    // ignore
  }
  return results;
}

// ── 主逻辑 ────────────────────────────────────────────────────────────────
console.log();
log(BOLD + CYAN, '═══════════════════════════════════════════════════════');
log(BOLD + CYAN, '  TezBarakat 构建前安全检查');
log(BOLD + CYAN, '═══════════════════════════════════════════════════════');
console.log();

let totalErrors = 0;
let totalWarnings = 0;

// ── 检查 1：getOptimizedImageUrl 使用 ─────────────────────────────────────
log(CYAN, '🔍 检查 1: 扫描已废弃的 getOptimizedImageUrl 调用...');
const tsFiles = walkDir(SRC_DIR, ['.ts', '.tsx']);
const optimizedImageUrlUsages = [];

for (const file of tsFiles) {
  // 跳过 utils.ts 中的定义本身
  if (file.endsWith('lib/utils.ts')) continue;
  
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // 跳过注释行
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (trimmed.includes('getOptimizedImageUrl')) {
      optimizedImageUrlUsages.push({
        file: relative(ROOT, file),
        line: i + 1,
        content: trimmed
      });
    }
  }
}

if (optimizedImageUrlUsages.length > 0) {
  log(RED, `  ❌ 发现 ${optimizedImageUrlUsages.length} 处使用已废弃的 getOptimizedImageUrl:`);
  for (const u of optimizedImageUrlUsages) {
    log(RED, `     ${u.file}:${u.line} → ${u.content.substring(0, 80)}`);
  }
  totalErrors += optimizedImageUrlUsages.length;
} else {
  log(GREEN, '  ✅ 未发现 getOptimizedImageUrl 调用');
}

// ── 检查 2：OptimizedImage 组件使用 ───────────────────────────────────────
log(CYAN, '🔍 检查 2: 扫描已废弃的 OptimizedImage 组件...');
const optimizedImageUsages = [];

for (const file of tsFiles) {
  // 跳过组件定义本身和工具函数定义
  if (file.endsWith('OptimizedImage.tsx')) continue;
  if (file.endsWith('lib/utils.ts')) continue;
  
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // 跳过注释行
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (trimmed.includes('OptimizedImage')) {
      optimizedImageUsages.push({
        file: relative(ROOT, file),
        line: i + 1,
        content: trimmed
      });
    }
  }
}

if (optimizedImageUsages.length > 0) {
  log(RED, `  ❌ 发现 ${optimizedImageUsages.length} 处使用已废弃的 OptimizedImage:`);
  for (const u of optimizedImageUsages) {
    log(RED, `     ${u.file}:${u.line} → ${u.content.substring(0, 80)}`);
  }
  totalErrors += optimizedImageUsages.length;
} else {
  log(GREEN, '  ✅ 未发现 OptimizedImage 组件调用');
}

// ── 检查 3：LazyImage width/height 属性 ──────────────────────────────────
log(CYAN, '🔍 检查 3: 扫描 LazyImage 的 width/height 属性...');
const lazyImageWidthUsages = [];

for (const file of tsFiles) {
  // 跳过 LazyImage 组件定义本身
  if (file.endsWith('LazyImage.tsx')) continue;
  
  const content = readFileSync(file, 'utf-8');
  
  // 简单的正则匹配 <LazyImage ... width= 或 height=
  const regex = /<LazyImage[^>]*\b(width|height)\s*=/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    // 找到所在行号
    const beforeMatch = content.substring(0, match.index);
    const lineNum = beforeMatch.split('\n').length;
    const line = content.split('\n')[lineNum - 1].trim();
    
    lazyImageWidthUsages.push({
      file: relative(ROOT, file),
      line: lineNum,
      prop: match[1],
      content: line.substring(0, 80)
    });
  }
}

if (lazyImageWidthUsages.length > 0) {
  log(YELLOW, `  ⚠️  发现 ${lazyImageWidthUsages.length} 处 LazyImage 使用了 width/height 属性:`);
  for (const u of lazyImageWidthUsages) {
    log(YELLOW, `     ${u.file}:${u.line} [${u.prop}] → ${u.content}`);
  }
  totalWarnings += lazyImageWidthUsages.length;
} else {
  log(GREEN, '  ✅ LazyImage 未使用 width/height 属性');
}

// ── 检查 4：i18n 两套文件一致性 ──────────────────────────────────────────
log(CYAN, '🔍 检查 4: 验证 i18n 两套文件一致性...');
const LANGUAGES = ['ru', 'tg', 'zh'];
let i18nSyncErrors = 0;

for (const lang of LANGUAGES) {
  const srcPath = resolve(ROOT, `src/i18n/locales/${lang}.json`);
  const pubPath = resolve(ROOT, `public/locales/${lang}.json`);
  
  if (!existsSync(srcPath) || !existsSync(pubPath)) {
    log(RED, `  ❌ ${lang}.json 文件缺失`);
    i18nSyncErrors++;
    continue;
  }
  
  const srcContent = readFileSync(srcPath, 'utf-8');
  const pubContent = readFileSync(pubPath, 'utf-8');
  
  if (srcContent !== pubContent) {
    log(RED, `  ❌ ${lang}.json — src 与 public 不一致`);
    i18nSyncErrors++;
  }
}

if (i18nSyncErrors > 0) {
  log(RED, `     运行 pnpm i18n:sync 修复`);
  totalWarnings += i18nSyncErrors; // 降级为警告，因为构建时会自动同步
} else {
  log(GREEN, '  ✅ i18n 两套文件完全一致');
}

// ── 检查 5：三语 key 一致性 ──────────────────────────────────────────────
log(CYAN, '🔍 检查 5: 验证三语翻译 key 一致性...');

function flattenKeys(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenKeys(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

const locales = {};
for (const lang of LANGUAGES) {
  const srcPath = resolve(ROOT, `src/i18n/locales/${lang}.json`);
  if (existsSync(srcPath)) {
    locales[lang] = flattenKeys(JSON.parse(readFileSync(srcPath, 'utf-8')));
  }
}

const allKeys = new Set([
  ...Object.keys(locales.ru || {}),
  ...Object.keys(locales.tg || {}),
  ...Object.keys(locales.zh || {}),
]);

let missingKeys = 0;
for (const lang of LANGUAGES) {
  for (const key of allKeys) {
    if (!(key in (locales[lang] || {}))) {
      if (missingKeys === 0) log(RED, '  ❌ 发现缺失的翻译 key:');
      log(RED, `     [${lang}] 缺少: ${key}`);
      missingKeys++;
    }
  }
}

if (missingKeys > 0) {
  totalErrors += missingKeys;
} else {
  log(GREEN, `  ✅ 三语 ${allKeys.size} 个 key 完全一致`);
}

// ── 总结 ──────────────────────────────────────────────────────────────────
console.log();
log(BOLD + CYAN, '═══════════════════════════════════════════════════════');

if (totalErrors > 0) {
  log(BOLD + RED, `  ✗ 发现 ${totalErrors} 个错误，${totalWarnings} 个警告`);
  log(RED, '  请修复以上错误后再构建');
  console.log();
  process.exit(1);
} else if (totalWarnings > 0) {
  log(BOLD + YELLOW, `  ⚠  通过（${totalWarnings} 个警告）`);
  log(YELLOW, '  警告项会在构建时自动修复，但建议手动确认');
  console.log();
  process.exit(0);
} else {
  log(BOLD + GREEN, '  ✓ 所有检查通过！可以安全构建');
  console.log();
  process.exit(0);
}
