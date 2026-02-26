import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'

// 仅内联 ru 翻译作为 fallback（塔吉克斯坦用户的默认语言）
// 其他语言（zh、tg）将通过 HTTP 按需加载
import ruTranslation from './locales/ru.json'

// 自定义 Telegram 语言检测器
// 注册为 i18next-browser-languagedetector 的自定义检测器插件
// 通过 addDetector() 注册后，在 detection.order 中通过 name 引用
const telegramDetector = {
  name: 'telegram',
  lookup: (): string | undefined => {
    try {
      const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code

      if (tgLang) {
        if (tgLang.startsWith('zh')) return 'zh'
        if (tgLang.startsWith('ru')) return 'ru'
        if (tgLang.startsWith('tg') || tgLang.startsWith('fa')) return 'tg'
      }

      return undefined
    } catch (error) {
      console.error('Error detecting Telegram language:', error)
      return undefined
    }
  },
  cacheUserLanguage: () => {}
}

// 创建 LanguageDetector 实例并注册自定义 Telegram 检测器
const languageDetector = new LanguageDetector()
languageDetector.addDetector(telegramDetector)

i18n
  .use(HttpBackend) // HTTP 后端按需加载翻译文件
  .use(languageDetector) // 浏览器语言检测器（已包含自定义 Telegram 检测器）
  .use(initReactI18next) // 集成 React
  .init({
    // 内联 ru 翻译，确保 fallback 语言立即可用，不会闪烁
    resources: {
      ru: { translation: ruTranslation }
    },
    // 对于非 ru 语言，通过 HTTP 后端加载
    partialBundledLanguages: true,
    backend: {
      loadPath: '/locales/{{lng}}.json'
    },
    fallbackLng: 'ru',
    lng: undefined, // 让检测器自动检测
    supportedLngs: ['zh', 'ru', 'tg'],
    interpolation: {
      escapeValue: false
    },
    detection: {
      // Telegram 检测器优先级最高，其次是 localStorage（用户手动切换的语言），最后是浏览器语言
      order: ['telegram', 'localStorage', 'navigator'],
      caches: ['localStorage']
    },
    saveMissing: false,
    missingKeyHandler: (_lng, _ns, key) => {
      console.warn(`Missing translation key: ${key}`)
    }
  })

export default i18n
