'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/components/i18n/LangProvider';
import { IconAlert } from './icons';
import { Logo, LogoMark } from './Logo';

/**
 * Navigasi yang sama di semua tab: logo, pil kaca di tengah (tab aktif bergradasi daun-matahari),
 * pilihan bahasa, dan tombol lapor api. `dark` dan `cta` dipertahankan agar pemanggil lama tetap jalan.
 */
export default function SiteHeader({ cta = true }: { dark?: boolean; cta?: boolean }) {
  const path = usePathname();
  const { lang, setLang, t } = useLang();
  const links = [
    { href: '/', label: t('Home', 'Beranda') },
    { href: '/peta', label: t('Map & simulation', 'Peta & simulasi') },
    { href: '/bantu', label: t('Give help', 'Bantu') },
    { href: '/lapor', label: t('Report', 'Lapor') },
    { href: '/cara-kerja', label: t('How it works', 'Cara kerja') },
  ];
  return (
    <header className="no-print relative z-30 flex h-16 shrink-0 items-center gap-3 px-4 text-ink sm:px-6">
      <Link href="/" aria-label={t('ApiRimba, home', 'ApiRimba, beranda')} className="shrink-0 rounded-full">
        <span className="sm:hidden">
          <LogoMark size={30} />
        </span>
        <span className="max-sm:hidden">
          <Logo size={32} />
        </span>
      </Link>
      <nav aria-label={t('Main navigation', 'Navigasi utama')} className="glass mx-auto flex min-w-0 items-center gap-1 overflow-x-auto rounded-full p-1 max-md:ml-auto max-md:mr-0">
        {links.map((l) => {
          const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                active ? 'grad-sun' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <div role="radiogroup" aria-label={t('Language', 'Bahasa')} className="glass flex rounded-full p-1 text-xs font-bold">
          {(['en', 'id'] as const).map((l) => (
            <button
              key={l}
              role="radio"
              aria-checked={lang === l}
              onClick={() => lang !== l && setLang(l)}
              className={`rounded-full px-2.5 py-1.5 uppercase transition-colors ${lang === l ? 'bg-white text-[#0b1d15]' : 'text-white/70 hover:text-white'}`}
            >
              {l}
            </button>
          ))}
        </div>
        {cta && (
          <Link
            href="/lapor"
            className="grad-fire hidden shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white transition-[filter] hover:brightness-110 lg:inline-flex"
          >
            <IconAlert size={16} /> {t('Report a fire', 'Lapor api')}
          </Link>
        )}
      </div>
    </header>
  );
}
