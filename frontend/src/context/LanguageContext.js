import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { translations, LANGUAGES } from '../i18n/translations';

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext) || { lang: 'en', setLang: () => {}, t: (k) => k, languages: LANGUAGES };

/** Convenience hook: const t = useT(); t('Dashboard'). */
export const useT = () => useLanguage().t;

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => localStorage.getItem('vm_lang') || 'en');

  const setLang = useCallback((code) => {
    setLangState(code);
    localStorage.setItem('vm_lang', code);
    document.documentElement.setAttribute('lang', code);
  }, []);

  // t(key, fallback?) → localized string, falling back to the key (English).
  const t = useCallback((key, fallback) => {
    if (key == null) return key;
    const dict = translations[lang] || {};
    return dict[key] || fallback || key;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export default LanguageContext;
