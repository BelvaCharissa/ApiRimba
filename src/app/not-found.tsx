import Link from 'next/link';
import { getT } from '@/lib/i18n-server';
import { LogoEmblem, Wordmark } from '@/components/ui/Logo';

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="grad-canopy grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <LogoEmblem width={260} className="mx-auto" />
        <Wordmark className="mt-2 block text-2xl" />
        <h1 className="mt-8 text-3xl font-bold">{t('Page not found', 'Halaman tidak ditemukan')}</h1>
        <p className="mt-2 text-ink-2">{t('The address you opened does not exist.', 'Alamat yang Anda buka tidak tersedia.')}</p>
        <Link href="/" className="mt-6 inline-block rounded-full grad-sun px-5 py-2.5 font-semibold">
          {t('Back to home', 'Kembali ke beranda')}
        </Link>
      </div>
    </main>
  );
}
