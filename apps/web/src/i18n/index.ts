import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import cs from "./locales/cs/common.json";
import en from "./locales/en/common.json";
import pl from "./locales/pl/common.json";
import { detectInitialLanguage, languageStorageKey } from "./config";

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: en },
    pl: { common: pl },
    cs: { common: cs }
  },
  lng: detectInitialLanguage(),
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: {
    escapeValue: false
  },
  returnNull: false
});

i18n.on("languageChanged", (language) => {
  window.localStorage.setItem(languageStorageKey, language);
  document.documentElement.lang = language;
});

document.documentElement.lang = i18n.language;

export { i18n };
