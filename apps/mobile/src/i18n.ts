import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';
import el from './locales/el.json';

// Bilingual (el/en) per spec §8: default to the device language, fall back to en.
const deviceLang = getLocales()[0]?.languageCode === 'el' ? 'el' : 'en';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    el: { translation: el },
  },
  lng: deviceLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
