import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'

// 内联 tg（塔吉克语）翻译作为默认语言
// 塔吉克斯坦是主要运营市场，塔吉克语用户占多数
// 其他语言（ru、zh）将通过 HTTP 按需加载
import tgTranslation from './locales/tg.json'

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
    // 内联 tg 翻译，确保塔吉克语用户首次加载时不会看到其他语言闪烁
    resources: {
      tg: { translation: tgTranslation }
    },
    // 对于非 tg 语言，通过 HTTP 后端加载
    partialBundledLanguages: true,
    backend: {
      loadPath: '/locales/{{lng}}.json'
    },
    fallbackLng: 'tg',
    lng: undefined, // 让检测器自动检测
    supportedLngs: ['zh', 'ru', 'tg'],
    interpolation: {
      escapeValue: false
    },
    detection: {
      // localStorage 优先（用户手动切换的语言应被尊重），
      // 其次是 Telegram 检测器（首次使用时从 Telegram 获取语言偏好），
      // 最后是浏览器语言
      order: ['localStorage', 'telegram', 'navigator'],
      caches: ['localStorage']
    },
    saveMissing: false,
    missingKeyHandler: (_lng, _ns, key) => {
      console.warn(`Missing translation key: ${key}`)
    }
  })

export default i18n
