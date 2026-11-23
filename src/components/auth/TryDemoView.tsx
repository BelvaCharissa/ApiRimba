'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { notifyAuthChanged } from '@/components/auth/useViewer';
import { useT } from '@/components/i18n/LangProvider';
import { Logo } from '@/components/ui/Logo';
import { ButtonLink, Spinner } from '@/components/ui/primitives';
import { safeNext } from '@/lib/safe-next';

/**
 * Tombol "Coba peta" di beranda mengarah ke sini. Pengguna yang sudah masuk langsung diteruskan;
 * yang belum, otomatis masuk dengan akun demo (tanpa daftar) lalu diteruskan ke peta.
 * Bila akun demo tidak tersedia, tampilkan jalan keluar ke halaman masuk.
 */
export default function TryDemoView() {
  const t = useT();
  const params = useSearchParams();
  const next = safeNext(params.get('next'), '/peta');
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const me = (await fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json())) as { user: unknown };
        if (!me.user) {
          const res = await fetch('/api/auth/demo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'verifier' }),
          });
          if (!res.ok) throw new Error('demo');
          notifyAuthChanged();
        }
        window.location.replace(next);
      } catch {
        setFailed(true);
      }
    })();
  }, [next]);

  return (
    <main className="grad-canopy grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-[440px]">
        <Logo height={120} className="mx-auto" />
        {failed ? (
          <>
            <h1 className="mt-6 text-2xl font-bold text-ink">{t('The demo could not open', 'Demo belum bisa dibuka')}</h1>
            <p className="mt-2 text-sm leading-6 text-ink-2">
              {t('Check your connection, or sign in with your own account.', 'Periksa koneksi, atau masuk dengan akun Anda sendiri.')}
            </p>
            <ButtonLink href={`/masuk?next=${encodeURIComponent(next)}`} className="mt-5">
              {t('Go to sign in', 'Ke halaman masuk')}
            </ButtonLink>
            <p className="mt-4 text-sm">
              <Link href="/" className="font-semibold text-sun underline-offset-4 hover:underline">
                {t('Back to home', 'Kembali ke beranda')}
              </Link>
            </p>
          </>
        ) : (
          <div role="status" className="mt-6 flex flex-col items-center gap-3">
            <Spinner size={22} />
            <p className="text-lg font-semibold text-ink">{t('Opening the map with the demo account...', 'Membuka peta dengan akun demo...')}</p>
            <p className="text-sm text-ink-3">{t('No registration needed.', 'Tanpa perlu daftar.')}</p>
          </div>
        )}
      </div>
    </main>
  );
}
