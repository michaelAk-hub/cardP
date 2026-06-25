import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import el from './locales/el.json';

// Bilingual (el/en) per spec §8; user-selectable + device default.
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    el: { translation: el },
  },
  lng: 'el',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
