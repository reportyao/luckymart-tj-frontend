import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入翻译文件
import zh from './locales/zh.json';
import ru from './locales/ru.json';
import tg from './locales/tg.json';

const resources = {
  zh: { translation: zh },
  ru: { translation: ru },
  tg: { translation: tg }
};

// 自定义语言检测器：从 Telegram WebApp 获取语言
const TelegramLanguageDetector = {
  type: 'languageDetector' as const,
  async: false,
  init: () => {},
  detect: (): string | undefined => {
    try {
      // 使用可选链安全访问 Telegram WebApp
      const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
      
      if (tgLang) {
        // 映射 Telegram 语言码到我们的语言码
        if (tgLang.startsWith('zh')) return 'zh';
        if (tgLang.startsWith('ru')) return 'ru';
        if (tgLang.startsWith('tg') || tgLang.startsWith('fa')) return 'tg'; // 塔吉克语或波斯语
      }
      
      return undefined;
    } catch (error) {
      console.error('Error detecting Telegram language:', error);
      return undefined;
    }
  },
  cacheUserLanguage: () => {}
};

i18n
  .use(TelegramLanguageDetector) // 使用自定义 Telegram 语言检测器
  .use(LanguageDetector) // 使用浏览器语言检测器
  .use(initReactI18next) // 集成 React
  .init({
    resources,
    fallbackLng: 'ru', // 默认语言
    lng: undefined, // 让检测器自动检测
    interpolation: {
      escapeValue: false // React 已经处理 XSS
    },
    detection: {
      // 检测顺序：localStorage > Telegram > 浏览器
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    },
    // 添加错误处理
    saveMissing: false,
    missingKeyHandler: (lng, ns, key) => {
      console.warn(`Missing translation key: ${key} for language: ${lng}`);
    }
  });

export default i18n;
