#!/usr/bin/env node
/**
 * i18n-validate.mjs
 *
 * 翻译文件一致性验证脚本
 *
 * 功能：
 *   1. 检查三个语言文件（ru.json / tg.json / zh.json）的键是否完全一致
 *   2. 检查是否存在值为空字符串的键（表示翻译未完成）
 *   3. 检查是否存在值为 '__MISSING__' 的键（由 i18next-parser 标记的缺失键）
 *
 * 用法：
 *   node scripts/i18n-validate.mjs           # 验证 src/i18n/locales/
 *   node scripts/i18n-validate.mjs --strict  # 严格模式：空值也报错（CI 使用）
 *
 * 退出码：
 *   0 = 全部通过
 *   1 = 发现问题（pre-commit hook 会拦截提交）
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOCALES_DIR = resolve(ROOT, 'src/i18n/locales');
const LANGUAGES = ['ru', 'tg', 'zh'];
const STRICT = process.argv.includes('--strict');

// ── 颜色输出 ──────────────────────────────────────────────────────────────
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

function log(color, ...args) {
  console.log(color + args.join(' ') + RESET);
}

// ── 工具函数 ──────────────────────────────────────────────────────────────

/**
 * 将嵌套 JSON 对象展平为点分隔的键值对
 * 例如：{ "a": { "b": "c" } } → { "a.b": "c" }
 */
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

// ── 主逻辑 ────────────────────────────────────────────────────────────────

let hasError = false;
let hasWarning = false;

// 1. 加载所有语言文件
const locales = {};
for (const lang of LANGUAGES) {
  const filePath = resolve(LOCALES_DIR, `${lang}.json`);
  if (!existsSync(filePath)) {
    log(RED, `❌ 语言文件不存在: ${filePath}`);
    hasError = true;
    continue;
  }
  try {
    locales[lang] = flattenKeys(JSON.parse(readFileSync(filePath, 'utf-8')));
  } catch (e) {
    log(RED, `❌ JSON 解析失败 [${lang}.json]: ${e.message}`);
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
}

const allKeys = new Set([
  ...Object.keys(locales.ru || {}),
  ...Object.keys(locales.tg || {}),
  ...Object.keys(locales.zh || {}),
]);

console.log();
log(BOLD + CYAN, '═══════════════════════════════════════════════════════');
log(BOLD + CYAN, '  TezBarakat i18n 翻译文件一致性检查');
log(BOLD + CYAN, '═══════════════════════════════════════════════════════');
console.log();
log(CYAN, `  总键数: ${allKeys.size}`);
for (const lang of LANGUAGES) {
  log(CYAN, `  ${lang}.json: ${Object.keys(locales[lang] || {}).length} 个键`);
}
console.log();

// 2. 检查各语言缺失的键
let missingCount = 0;
for (const lang of LANGUAGES) {
  const missing = [];
  for (const key of allKeys) {
    if (!(key in locales[lang])) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    log(RED, `❌ [${lang}.json] 缺失 ${missing.length} 个键:`);
    for (const key of missing.sort()) {
      log(RED, `     - ${key}`);
    }
    missingCount += missing.length;
    hasError = true;
  }
}

if (missingCount === 0) {
  log(GREEN, '✅ 所有语言文件的键完全一致');
}
console.log();

// 3. 检查空值（翻译未完成）
let emptyCount = 0;
for (const lang of LANGUAGES) {
  const emptyKeys = Object.entries(locales[lang] || {})
    .filter(([, v]) => v === '' || v === '__MISSING__')
    .map(([k]) => k);

  if (emptyKeys.length > 0) {
    const marker = STRICT ? RED + '❌' : YELLOW + '⚠️ ';
    log(marker, `[${lang}.json] ${emptyKeys.length} 个键的翻译为空（需要补充）:` + RESET);
    for (const key of emptyKeys.sort()) {
      log(STRICT ? RED : YELLOW, `     - ${key}`);
    }
    emptyCount += emptyKeys.length;
    if (STRICT) {
      hasError = true;
    } else {
      hasWarning = true;
    }
  }
}

if (emptyCount === 0) {
  log(GREEN, '✅ 所有翻译值均已填写');
}
console.log();

// 4. 输出总结
log(BOLD + CYAN, '═══════════════════════════════════════════════════════');
if (hasError) {
  log(BOLD + RED, '  ✗ 检查未通过，请修复以上问题后再提交');
  log(RED, '  提示：在所有语言文件中补充缺失的键，确保 ru/tg/zh 三个文件键完全一致');
  console.log();
  process.exit(1);
} else if (hasWarning) {
  log(BOLD + YELLOW, '  ⚠  检查通过（有警告），存在空值翻译，建议尽快补充');
  log(YELLOW, '  提示：使用 --strict 模式可将空值警告升级为错误');
  console.log();
  process.exit(0);
} else {
  log(BOLD + GREEN, '  ✓ 所有检查通过！翻译文件完整且一致');
  console.log();
  process.exit(0);
}
