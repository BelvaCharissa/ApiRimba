'use client';

import { createContext, type ReactNode, useCallback, useContext } from 'react';
import { LANG_COOKIE, type Lang, setCurrentLang } from '@/lib/i18n';

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (en: string, id: string) => string;
}

const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => undefined, t: (en) => en });

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  // fungsi di lib/ (format, label level, dll.) membaca bahasa aktif dari sini
  setCurrentLang(lang);
  const setLang = useCallback((l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }, []);
  const t = useCallback((en: string, id: string) => (lang === 'id' ? id : en), [lang]);
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}

/** Penerjemah untuk komponen klien: const t = useT(); t('English', 'Indonesia'). */
export function useT() {
  return useContext(LangCtx).t;
}
