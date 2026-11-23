'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useViewer } from '@/components/auth/useViewer';
import { useT } from '@/components/i18n/LangProvider';
import { flushQueue, listQueued, QUEUE_EVENT } from '@/lib/offline/queue';
import { useOnline } from './useOnline';

/** Halaman utama yang disimpan setelah masuk, agar tetap bisa dibuka offline walau belum dikunjungi. */
const WARM = ['/', '/peta', '/lapor', '/cara-kerja', '/bantu', '/offline'];

/**
 * Mode offline untuk seluruh aplikasi: daftar service worker, simpan halaman utama, kirim antrean
 * laporan saat online, dan tampilkan status koneksi.
 */
export default function OfflineManager() {
  const t = useT();
  const online = useOnline();
  const viewer = useViewer();
  const path = usePathname();
  const [pending, setPending] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Service worker hanya di build produksi (di dev, HMR Next.js bentrok dengan cache).
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    try {
      // Catatan sumber daya dipakai untuk menyimpan data kunjungan pertama; perbesar batas bawaan (250).
      performance.setResourceTimingBufferSize(3000);
    } catch {
      // abaikan
    }
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);

  /**
   * Simpan halaman yang sedang dibuka beserta semua data yang sudah dimuatnya. Perlu karena:
   * (1) pada kunjungan pertama service worker baru aktif setelah halaman dimuat, dan
   * (2) pindah halaman lewat menu (navigasi klien) tidak mengambil HTML halaman.
   * Dikirim beberapa kali karena simulasi terus memuat data (citra, elevasi, desa, cuaca).
   */
  const signedIn = !!viewer?.user;
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !online || !('serviceWorker' in navigator)) return;
    let mainSent = false;
    try {
      mainSent = sessionStorage.getItem(`apirimba:warm:${signedIn ? 'in' : 'out'}`) === '1';
    } catch {
      // abaikan
    }
    const send = (withMain: boolean) =>
      void navigator.serviceWorker.ready
        .then((reg) => {
          const assets = [...new Set(performance.getEntriesByType('resource').map((e) => e.name))].filter((u) => u.startsWith('http'));
          reg.active?.postMessage({ type: 'warm', pages: [window.location.pathname + window.location.search, ...(withMain ? WARM : [])], assets });
          if (withMain) {
            try {
              sessionStorage.setItem(`apirimba:warm:${signedIn ? 'in' : 'out'}`, '1');
            } catch {
              // abaikan
            }
          }
        })
        .catch(() => undefined);
    const timers = [2500, 15000, 45000].map((ms, k) => setTimeout(() => send(k === 0 && !mainSent), ms));
    return () => timers.forEach(clearTimeout);
  }, [path, online, signedIn]);

  // Tanda "siap offline": muncul sekali per sesi begitu halaman yang dibuka benar-benar tersimpan.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; saved?: boolean; path?: string | null };
      if (d?.type !== 'warm-done' || !d.saved || d.path !== window.location.pathname) return;
      try {
        if (sessionStorage.getItem('apirimba:offline-ready') === '1') return;
        sessionStorage.setItem('apirimba:offline-ready', '1');
      } catch {
        // abaikan
      }
      setToast(
        t(
          '✓ Saved for offline: pages you open on this device now work without signal.',
          '✓ Tersimpan untuk offline: halaman yang Anda buka di perangkat ini kini bisa dipakai tanpa sinyal.',
        ),
      );
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 6000);
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, [t]);

  // Antrean laporan offline: hitung yang menunggu, kirim saat online.
  useEffect(() => {
    let alive = true;
    const count = () => void listQueued().then((q) => alive && setPending(q.filter((x) => x.status === 'pending' || x.status === 'sending').length));
    count();
    window.addEventListener(QUEUE_EVENT, count);
    return () => {
      alive = false;
      window.removeEventListener(QUEUE_EVENT, count);
    };
  }, []);

  useEffect(() => {
    if (!online) return;
    let alive = true;
    void flushQueue().then(({ sent, rejected }) => {
      if (!alive || (!sent && !rejected)) return;
      const msg =
        sent && rejected
          ? t(`${sent} saved report(s) sent, ${rejected} rejected. See the Report page.`, `${sent} laporan tersimpan terkirim, ${rejected} ditolak. Lihat halaman Lapor.`)
          : sent
            ? t(`Back online: ${sent} saved report(s) sent.`, `Kembali online: ${sent} laporan tersimpan sudah terkirim.`)
            : t(`${rejected} saved report(s) were rejected. See the Report page.`, `${rejected} laporan tersimpan ditolak. Lihat halaman Lapor.`);
      setToast(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 7000);
    });
    return () => {
      alive = false;
    };
  }, [online, t]);

  // Server sedang error (bukan offline): coba kirim lagi tiap 2 menit selama masih ada antrean.
  useEffect(() => {
    if (!online || pending === 0) return;
    const id = setInterval(() => void flushQueue(), 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [online, pending]);

  // Halaman peta punya penanda offline sendiri (banner simulator / lencana data peta).
  const showBar = !online && !path.startsWith('/peta');

  return (
    <>
      {showBar && (
        <div role="status" className="no-print relative z-[65] bg-[#3a2f12] px-4 py-2 text-center text-sm leading-5 text-[#ffe8a3]">
          <b>{t('Offline.', 'Offline.')}</b>{' '}
          {t(
            'Saved pages and data still work; fire reports are kept on this device and sent when the signal returns.',
            'Halaman dan data yang tersimpan tetap bisa dipakai; laporan api disimpan di perangkat dan dikirim saat sinyal kembali.',
          )}
          {pending > 0 && <> {t(`${pending} report(s) waiting.`, `${pending} laporan menunggu.`)}</>}
        </div>
      )}
      {toast && (
        <div role="status" className="no-print glass fixed bottom-5 left-1/2 z-[85] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 rounded-[16px] px-4 py-3 text-sm text-ink shadow-float">
          {toast}
        </div>
      )}
    </>
  );
}
