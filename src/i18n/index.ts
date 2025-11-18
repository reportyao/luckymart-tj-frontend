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

// 自定义检测器：从 Telegram WebApp 获取语言
const customDetector = {
  name: 'customDetector',
  lookup() {
    // 检查 window.Telegram 是否存在
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
      const tgLang = window.Telegram.WebApp.initDataUnsafe.user.language_code;
      // 映射 Telegram 语言码到我们的语言码
      if (tgLang && tgLang.startsWith('zh')) return 'zh';
      if (tgLang && tgLang.startsWith('ru')) return 'ru';
      if (tgLang && (tgLang.startsWith('tg') || tgLang.startsWith('fa'))) return 'tg'; // 塔吉克语或波斯语
    }
    return null;
  }
};

i18n.use({ type: 'languageDetector', detect: customDetector.lookup });

i18n
  .use(LanguageDetector) // 自动检测语言
  .use(initReactI18next) // 集成 React
  .init({
    resources,
    fallbackLng: 'ru', // 默认语言
    interpolation: {
      escapeValue: false // React 已经处理 XSS
    },
    detection: {
      // 优先从 Telegram WebApp 获取语言，然后是 localStorage, navigator
      order: ['customDetector', 'localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
