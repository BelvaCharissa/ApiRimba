import { cookies } from 'next/headers';
import { LANG_COOKIE, type Lang, parseLang, setCurrentLang, t } from './i18n';

/** Bahasa permintaan saat ini (server component / route handler). */
export async function getLang(): Promise<Lang> {
  const c = await cookies();
  return parseLang(c.get(LANG_COOKIE)?.value);
}

/** Penerjemah untuk server component: const t = await getT(); t('English', 'Indonesia'). */
export async function getT(): Promise<(en: string, id: string) => string> {
  const lang = await getLang();
  setCurrentLang(lang);
  return (en: string, id: string) => (lang === 'id' ? id : en);
}

export { t };
