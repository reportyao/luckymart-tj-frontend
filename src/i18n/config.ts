import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhTranslation from './locales/zh.json';
import ruTranslation from './locales/ru.json';
import tgTranslation from './locales/tg.json';

const resources = {
  zh: {
    translation: zhTranslation
  },
  ru: {
    translation: ruTranslation
  },
  tg: {
    translation: tgTranslation
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh',
    debug: false,
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
