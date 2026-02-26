import type { UserConfig } from 'i18next-parser';

/**
 * i18next-parser 配置文件
 *
 * ⚠️  重要说明：本项目使用此工具仅作为【只读检查工具】。
 *
 * 由于项目中存在动态键（如 t(`groupBuy.status.${status}`)）和
 * 通过变量引用的键，i18next-parser 无法完整识别所有实际使用的键。
 * 因此，禁止使用 i18next-parser 直接覆盖翻译文件。
 *
 * 正确的翻译文件维护方式：
 *   1. 运行 `pnpm i18n:check` 查看缺失键报告（不修改文件）
 *   2. 手动在所有语言文件中补充缺失的键
 *   3. 使用 `pnpm i18n:validate` 验证三个语言文件的键是否完全一致
 *
 * 文档：https://github.com/i18next/i18next-parser
 */
const config: UserConfig = {
  // ── 输入 ──────────────────────────────────────────────────────────────────
  input: ['src/**/*.{ts,tsx}'],

  // ── 输出（仅用于生成报告，不应直接覆盖翻译文件）────────────────────────────
  // 输出到临时目录，由 i18n:check 脚本进行对比分析
  output: '.i18n-check/$LOCALE.json',

  // ── 语言与命名空间 ────────────────────────────────────────────────────────
  locales: ['ru', 'tg', 'zh'],
  defaultNamespace: 'translation',
  namespaceSeparator: false,

  // ── 键分隔符 ──────────────────────────────────────────────────────────────
  keySeparator: '.',

  // ── 缺失键默认值 ──────────────────────────────────────────────────────────
  defaultValue: '__MISSING__',

  // ── 保留现有翻译文件中的所有键（不删除废弃键）────────────────────────────
  keepRemoved: true,

  // ── 词法分析器 ────────────────────────────────────────────────────────────
  lexers: {
    ts: ['JavascriptLexer'],
    tsx: ['JsxLexer'],
    default: ['JavascriptLexer'],
  },

  // ── 函数名 ────────────────────────────────────────────────────────────────
  functions: ['t', 'i18next.t', 'i18n.t'],

  // ── 输出格式 ──────────────────────────────────────────────────────────────
  indentation: 2,
};

export default config;
