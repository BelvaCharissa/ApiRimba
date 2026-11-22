/**
 * Dua bahasa: Inggris (bawaan) dan Indonesia. Teks ditulis berpasangan di tempat dipakai: t('English', 'Indonesia').
 * Bahasa disimpan di cookie `lang`; mengganti bahasa memuat ulang halaman agar seluruh teks ikut berganti.
 */
export type Lang = 'en' | 'id';
export const LANG_COOKIE = 'lang';
export const DEFAULT_LANG: Lang = 'en';

let current: Lang = DEFAULT_LANG;

export function parseLang(v: string | undefined | null): Lang {
  return v === 'id' ? 'id' : 'en';
}

/** Dipanggil oleh LangProvider saat render agar fungsi di lib/ ikut bahasa aktif. */
export function setCurrentLang(l: Lang) {
  current = l;
}

export function currentLang(): Lang {
  return current;
}

/** Pilih teks sesuai bahasa aktif. */
export function t(en: string, id: string): string {
  return current === 'id' ? id : en;
}

/** Locale angka dan tanggal sesuai bahasa aktif. */
export function locale(): string {
  return current === 'id' ? 'id-ID' : 'en-GB';
}
