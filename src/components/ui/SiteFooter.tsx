'use client';

import Link from 'next/link';
import { useT } from '@/components/i18n/LangProvider';
import { Logo } from './Logo';

/** Kaki halaman bersama semua tab. */
export default function SiteFooter() {
  const t = useT();
  return (
    <footer className="no-print border-t border-line">
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-10 text-sm text-ink-3 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Logo height={120} />
          <p className="mt-3 max-w-[340px] leading-6">
            {t(
              'Peat fire spread forecasts, citizen reports and aid coordination. Built for IT RUSH 2026.',
              'Prakiraan sebaran api gambut, laporan warga, dan koordinasi bantuan. Karya IT RUSH 2026.',
            )}
          </p>
        </div>
        <nav aria-label={t('Footer', 'Kaki halaman')} className="grid grid-cols-2 gap-2">
          <Link href="/peta" className="hover:text-ink">{t('Map & simulation', 'Peta & simulasi')}</Link>
          <Link href="/bantu" className="hover:text-ink">{t('Give help', 'Bantu')}</Link>
          <Link href="/lapor" className="hover:text-ink">{t('Report a fire', 'Lapor api')}</Link>
          <Link href="/cara-kerja" className="hover:text-ink">{t('How it works', 'Cara kerja')}</Link>
          <Link href="/petugas" className="hover:text-ink">{t('Post officers', 'Petugas posko')}</Link>
        </nav>
        <p className="leading-6">
          {t('Emergency', 'Darurat')}: <b className="text-ink">112</b> · {t('Fire brigade', 'Damkar')}: <b className="text-ink">113</b>
          <br />
          {t('Data', 'Data')}: NASA FIRMS, Open-Meteo, OpenStreetMap, CARTO, Esri.
        </p>
      </div>
    </footer>
  );
}
