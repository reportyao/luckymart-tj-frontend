#!/usr/bin/env node
/**
 * i18n-check.mjs
 *
 * 翻译键覆盖率检查脚本（只读，不修改任何文件）
 *
 * 功能：
 *   运行 i18next-parser 扫描源码中所有静态 t('key') 调用，
 *   与现有翻译文件对比，报告：
 *     - 代码中使用但翻译文件中缺失的键（需要新增）
 *     - 翻译文件中存在但代码中未使用的键（可能是废弃键）
 *
 * ⚠️  注意：由于项目中存在动态键（如 t(`status.${var}`)），
 *   此脚本的"未使用键"报告仅供参考，不应直接删除这些键。
 *   只有"缺失键"报告是可靠的，需要人工处理。
 *
 * 用法：
 *   node scripts/i18n-check.mjs           # 完整报告
 *   node scripts/i18n-check.mjs --missing-only  # 只显示缺失键
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOCALES_DIR = resolve(ROOT, 'src/i18n/locales');
const CHECK_DIR = resolve(ROOT, '.i18n-check');
const LANGUAGES = ['ru', 'tg', 'zh'];
const MISSING_ONLY = process.argv.includes('--missing-only');

// ── 颜色输出 ──────────────────────────────────────────────────────────────
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const RESET  = '\x1b[0m';

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

// ── 步骤 1：运行 i18next-parser 扫描源码 ──────────────────────────────────
console.log();
console.log(BOLD + CYAN + '═══════════════════════════════════════════════════════' + RESET);
console.log(BOLD + CYAN + '  TezBarakat i18n 翻译键覆盖率检查' + RESET);
console.log(BOLD + CYAN + '═══════════════════════════════════════════════════════' + RESET);
console.log();
console.log(DIM + '  正在扫描源码中的翻译键调用...' + RESET);

// 清理并重建临时目录
if (existsSync(CHECK_DIR)) {
  rmSync(CHECK_DIR, { recursive: true });
}
mkdirSync(CHECK_DIR, { recursive: true });

try {
  execSync('npx i18next --config i18next-parser.config.ts', {
    cwd: ROOT,
    stdio: 'pipe',
  });
} catch (e) {
  console.error(RED + '❌ i18next-parser 运行失败:' + RESET, e.message);
  process.exit(1);
}

// ── 步骤 2：加载并对比 ────────────────────────────────────────────────────
const results = {};

for (const lang of LANGUAGES) {
  const currentPath = resolve(LOCALES_DIR, `${lang}.json`);
  const scannedPath = resolve(CHECK_DIR, `${lang}.json`);

  if (!existsSync(scannedPath)) {
    console.error(RED + `❌ 扫描结果文件不存在: ${scannedPath}` + RESET);
    continue;
  }

  const current = flattenKeys(JSON.parse(readFileSync(currentPath, 'utf-8')));
  const scanned = flattenKeys(JSON.parse(readFileSync(scannedPath, 'utf-8')));

  // 代码中使用但翻译文件中缺失的键（scanned 中值为 '__MISSING__' 且 current 中不存在）
  const missing = Object.entries(scanned)
    .filter(([key, val]) => val === '__MISSING__' && !(key in current))
    .map(([key]) => key);

  // 翻译文件中存在但 parser 未扫描到的键（可能是动态键或废弃键）
  const notScanned = Object.keys(current).filter(key => !(key in scanned));

  results[lang] = { missing, notScanned, currentCount: Object.keys(current).length };
}

// ── 步骤 3：输出报告 ──────────────────────────────────────────────────────

// 汇总所有语言的缺失键（取并集，因为三个文件应该一致）
const allMissing = new Set();
for (const lang of LANGUAGES) {
  (results[lang]?.missing || []).forEach(k => allMissing.add(k));
}

console.log(CYAN + `  扫描完成，当前翻译键数量:` + RESET);
for (const lang of LANGUAGES) {
  console.log(CYAN + `    ${lang}.json: ${results[lang]?.currentCount || 0} 个键` + RESET);
}
console.log();

if (allMissing.size > 0) {
  console.log(RED + BOLD + `❌ 发现 ${allMissing.size} 个代码中使用但翻译文件缺失的键:` + RESET);
  console.log(RED + '   （这些键在代码中通过静态字符串调用，但未在任何语言文件中定义）' + RESET);
  console.log();
  for (const key of [...allMissing].sort()) {
    console.log(RED + `     + ${key}` + RESET);
  }
  console.log();
  console.log(RED + '  ➡  请在 src/i18n/locales/ru.json、tg.json、zh.json 中补充以上键' + RESET);
  console.log();
} else {
  console.log(GREEN + '✅ 所有静态翻译键均已在翻译文件中定义' + RESET);
  console.log();
}

if (!MISSING_ONLY) {
  // 显示可能废弃的键（仅供参考）
  const allNotScanned = new Set();
  for (const lang of LANGUAGES) {
    (results[lang]?.notScanned || []).forEach(k => allNotScanned.add(k));
  }

  if (allNotScanned.size > 0) {
    console.log(YELLOW + BOLD + `⚠️  ${allNotScanned.size} 个键未被静态扫描到（动态键或废弃键，仅供参考）:` + RESET);
    console.log(YELLOW + '   （这些键可能通过动态方式调用，如 t(`section.${var}`)，不应直接删除）' + RESET);
    console.log();
    for (const key of [...allNotScanned].sort().slice(0, 30)) {
      console.log(DIM + `     ~ ${key}` + RESET);
    }
    if (allNotScanned.size > 30) {
      console.log(DIM + `     ... 以及另外 ${allNotScanned.size - 30} 个键（运行完整报告查看）` + RESET);
    }
    console.log();
  }
}

// ── 步骤 4：清理临时文件 ──────────────────────────────────────────────────
rmSync(CHECK_DIR, { recursive: true });

console.log(BOLD + CYAN + '═══════════════════════════════════════════════════════' + RESET);
if (allMissing.size > 0) {
  console.log(BOLD + RED + '  ✗ 检查未通过，请补充缺失的翻译键' + RESET);
  console.log();
  process.exit(1);
} else {
  console.log(BOLD + GREEN + '  ✓ 翻译键覆盖率检查通过' + RESET);
  console.log();
  process.exit(0);
}
