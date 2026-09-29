import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { en } from "./en";
import { fr } from "./fr";

declare module "i18next" {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    // English by default; French when the browser prefers it (fr, fr-FR, fr-CA…)
    fallbackLng: "en",
    supportedLngs: ["en", "fr"],
    load: "languageOnly",
    detection: { order: ["navigator"], caches: [] },
    interpolation: { escapeValue: false }, // React already escapes
  });

// Keep <html lang> in sync (screen readers, hyphenation, browser translation)
const syncLang = (lng: string) => (document.documentElement.lang = lng);
syncLang(i18n.resolvedLanguage ?? "en");
i18n.on("languageChanged", syncLang);

export default i18n;
