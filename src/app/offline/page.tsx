import type { Metadata } from 'next';
import { Logo } from '@/components/ui/Logo';
import SavedPages from '@/components/offline/SavedPages';

export const metadata: Metadata = { title: 'Offline', robots: { index: false } };

/**
 * Ditampilkan service worker bila halaman yang dibuka belum pernah tersimpan dan perangkat offline.
 * Halaman statis dua bahasa (disimpan saat aplikasi dipasang, jadi bahasa pengguna belum diketahui).
 */
export default function OfflinePage() {
  return (
    <main className="grad-canopy grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-[520px]">
        <Logo height={140} className="mx-auto" />
        <h1 className="mt-6 text-3xl font-bold text-ink">Anda sedang offline</h1>
        <p className="mt-1 text-lg text-ink-2">You are offline</p>
        <p className="mt-4 text-sm leading-6 text-ink-2">
          Halaman ini belum tersimpan di perangkat. Halaman yang pernah dibuka tetap bisa dipakai, simulasi berjalan dengan data cadangan, dan
          laporan api disimpan lalu dikirim otomatis saat sinyal kembali.
        </p>
        <p className="mt-2 text-xs leading-5 text-ink-3">
          This page is not saved on this device yet. Pages you opened before still work, the simulation runs on backup data, and fire reports are
          kept and sent automatically when the signal returns.
        </p>
        <SavedPages />
        <p className="mt-6 text-sm text-ink-2">
          Darurat / Emergency: <b className="num text-sun">112</b> · <b className="num text-sun">113</b>
        </p>
      </div>
    </main>
  );
}
