import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'

// 仅内联 ru 翻译作为 fallback（塔吉克斯坦用户的默认语言）
// 其他语言（zh、tg）将通过 HTTP 按需加载
import ruTranslation from './locales/ru.json'

// 自定义语言检测器：从 Telegram WebApp 获取语言
const TelegramLanguageDetector = {
  type: 'languageDetector' as const,
  async: false,
  init: () => {},
  detect: (): string | undefined => {
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

i18n
  .use(HttpBackend) // HTTP 后端按需加载翻译文件
  .use(TelegramLanguageDetector) // 自定义 Telegram 语言检测器
  .use(LanguageDetector) // 浏览器语言检测器
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
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    },
    saveMissing: false,
    missingKeyHandler: (_lng, _ns, key) => {
      console.warn(`Missing translation key: ${key}`)
    }
  })

export default i18n
