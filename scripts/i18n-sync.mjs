#!/usr/bin/env node
/**
 * i18n-sync.mjs
 *
 * 翻译文件自动同步脚本
 *
 * 功能：
 *   将 src/i18n/locales/ 下的翻译文件自动同步到 public/locales/
 *   确保两套 i18n 文件始终保持一致，消除手动同步遗漏的风险。
 *
 * 背景：
 *   项目存在两套 i18n 文件：
 *   - src/i18n/locales/  → 主文件（tg.json 会被 import 内联打包进 JS bundle）
 *   - public/locales/    → 副本（zh.json、ru.json 通过 HTTP 动态加载）
 *   两套文件内容必须完全一致。src/i18n/locales/ 是唯一的编辑入口（Single Source of Truth）。
 *
 * 用法：
 *   node scripts/i18n-sync.mjs           # 同步文件
 *   node scripts/i18n-sync.mjs --check   # 仅检查是否一致（不修改文件，CI 使用）
 *
 * 集成点：
 *   - vite-plugin-timestamp.js 的 buildStart 钩子中自动调用
 *   - pre-commit hook 中自动调用
 *   - 也可手动运行：pnpm i18n:sync
 *
 * 退出码：
 *   0 = 同步成功 / 检查通过
 *   1 = 检查模式下发现不一致
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC_DIR = resolve(ROOT, 'src/i18n/locales');
const PUBLIC_DIR = resolve(ROOT, 'public/locales');
const LANGUAGES = ['ru', 'tg', 'zh'];
const CHECK_ONLY = process.argv.includes('--check');

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

// ── 主逻辑 ────────────────────────────────────────────────────────────────
console.log();
log(BOLD + CYAN, '═══════════════════════════════════════════════════════');
log(BOLD + CYAN, '  TezBarakat i18n 翻译文件同步');
log(BOLD + CYAN, `  模式: ${CHECK_ONLY ? '检查（--check）' : '同步'}`);
log(BOLD + CYAN, '═══════════════════════════════════════════════════════');
console.log();
log(CYAN, `  源目录: src/i18n/locales/`);
log(CYAN, `  目标目录: public/locales/`);
console.log();

// 确保目标目录存在
if (!CHECK_ONLY && !existsSync(PUBLIC_DIR)) {
  mkdirSync(PUBLIC_DIR, { recursive: true });
}

let hasError = false;
let syncedCount = 0;
let identicalCount = 0;

for (const lang of LANGUAGES) {
  const srcPath = resolve(SRC_DIR, `${lang}.json`);
  const pubPath = resolve(PUBLIC_DIR, `${lang}.json`);

  if (!existsSync(srcPath)) {
    log(RED, `  ❌ 源文件不存在: src/i18n/locales/${lang}.json`);
    hasError = true;
    continue;
  }

  const srcContent = readFileSync(srcPath, 'utf-8');

  if (existsSync(pubPath)) {
    const pubContent = readFileSync(pubPath, 'utf-8');
    if (srcContent === pubContent) {
      log(GREEN, `  ✅ ${lang}.json — 已一致`);
      identicalCount++;
      continue;
    }
  }

  // 文件不一致
  if (CHECK_ONLY) {
    log(RED, `  ❌ ${lang}.json — 不一致！`);
    if (existsSync(pubPath)) {
      // 显示差异摘要
      try {
        const srcData = JSON.parse(srcContent);
        const pubData = JSON.parse(readFileSync(pubPath, 'utf-8'));
        const srcKeys = Object.keys(flattenKeys(srcData));
        const pubKeys = Object.keys(flattenKeys(pubData));
        const onlySrc = srcKeys.filter(k => !pubKeys.includes(k));
        const onlyPub = pubKeys.filter(k => !srcKeys.includes(k));
        if (onlySrc.length > 0) {
          log(YELLOW, `       src 独有: ${onlySrc.slice(0, 5).join(', ')}${onlySrc.length > 5 ? ` ...等 ${onlySrc.length} 个` : ''}`);
        }
        if (onlyPub.length > 0) {
          log(YELLOW, `       public 独有: ${onlyPub.slice(0, 5).join(', ')}${onlyPub.length > 5 ? ` ...等 ${onlyPub.length} 个` : ''}`);
        }
        if (onlySrc.length === 0 && onlyPub.length === 0) {
          log(YELLOW, `       键相同但值不同`);
        }
      } catch (e) {
        // ignore parse error
      }
    } else {
      log(YELLOW, `       public/locales/${lang}.json 不存在`);
    }
    hasError = true;
  } else {
    writeFileSync(pubPath, srcContent, 'utf-8');
    log(GREEN, `  🔄 ${lang}.json — 已同步`);
    syncedCount++;
  }
}

console.log();
log(BOLD + CYAN, '═══════════════════════════════════════════════════════');

if (CHECK_ONLY) {
  if (hasError) {
    log(BOLD + RED, '  ✗ 检查未通过！两套 i18n 文件不一致');
    log(RED, '  请运行 pnpm i18n:sync 同步文件');
    console.log();
    process.exit(1);
  } else {
    log(BOLD + GREEN, '  ✓ 检查通过！两套 i18n 文件完全一致');
    console.log();
    process.exit(0);
  }
} else {
  if (syncedCount > 0) {
    log(BOLD + GREEN, `  ✓ 同步完成！已更新 ${syncedCount} 个文件，${identicalCount} 个无需更新`);
  } else {
    log(BOLD + GREEN, `  ✓ 所有文件已一致，无需同步`);
  }
  console.log();
  process.exit(0);
}

// ── 工具函数 ──────────────────────────────────────────────────────────────
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
