'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { useOnline } from '@/components/offline/useOnline';
import { Spinner } from '@/components/ui/primitives';
import { locale } from '@/lib/i18n';
import { flushQueue, listQueued, QUEUE_EVENT, type QueuedReport, REJECT_MESSAGES, removeQueued } from '@/lib/offline/queue';

/** Laporan yang disimpan di perangkat saat offline, beserta statusnya. */
export default function QueuedReports() {
  const t = useT();
  const online = useOnline();
  const [items, setItems] = useState<QueuedReport[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => void listQueued().then((q) => alive && setItems(q));
    load();
    window.addEventListener(QUEUE_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(QUEUE_EVENT, load);
    };
  }, []);

  if (!items.length) return null;
  const waiting = items.filter((x) => x.status === 'pending' || x.status === 'sending').length;
  const needLogin = items.some((x) => x.status === 'pending' && x.message === 'auth_required');
  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale(), { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' WIB';

  return (
    <section className="glass rounded-[20px] p-5" aria-labelledby="antrean-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="antrean-h" className="font-semibold text-ink">
          {t('Reports saved on this device', 'Laporan tersimpan di perangkat ini')}
        </h2>
        {waiting > 0 && online && (
          <button onClick={() => void flushQueue()} className="text-sm font-semibold text-wind underline-offset-4 hover:underline">
            {t('Send now', 'Kirim sekarang')}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs leading-5 text-ink-3">
        {waiting > 0
          ? needLogin
            ? t('Sign in to send the saved reports; they are kept until then.', 'Masuk akun untuk mengirim laporan tersimpan; laporan tetap disimpan sampai saat itu.')
            : online
            ? t('Sending automatically...', 'Sedang dikirim otomatis...')
            : t('No signal. They are sent automatically when the device is back online; you can close the app.', 'Belum ada sinyal. Laporan dikirim otomatis saat perangkat online lagi; aplikasi boleh ditutup.')
          : t('All saved reports have been processed.', 'Semua laporan tersimpan sudah diproses.')}
      </p>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[12px] bg-black/20">
        {items.map((q) => (
          <li key={q.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{q.fields.description ?? t('Fire report', 'Laporan api')}</span>
              <span className="num block text-xs text-ink-3">
                {when(q.createdAt)} · {Number(q.fields.lat).toFixed(4)}, {Number(q.fields.lon).toFixed(4)}
              </span>
              {q.message && REJECT_MESSAGES[q.message] && (
                <span className={`block text-xs ${q.status === 'rejected' ? 'text-danger-ink' : 'text-sun'}`}>{t(...REJECT_MESSAGES[q.message])}</span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  q.status === 'sent' ? 'bg-[#2fb67c]/20 text-[#6fdca8]' : q.status === 'rejected' ? 'bg-danger/20 text-danger-ink' : 'bg-sun/15 text-sun'
                }`}
              >
                {q.status === 'sending' && <Spinner size={12} />}
                {q.status === 'sent' ? t('Sent', 'Terkirim') : q.status === 'rejected' ? t('Rejected', 'Ditolak') : q.status === 'sending'
                    ? t('Sending', 'Mengirim')
                    : q.message === 'auth_required'
                      ? t('Needs sign-in', 'Perlu masuk')
                      : t('Waiting for signal', 'Menunggu sinyal')}
              </span>
              {q.status !== 'sending' && (
                <button
                  onClick={() => void removeQueued(q.id)}
                  className="text-xs text-ink-3 hover:text-ink"
                  aria-label={q.status === 'pending' ? t('Cancel this report', 'Batalkan laporan ini') : t('Remove from list', 'Hapus dari daftar')}
                >
                  {q.status === 'pending' ? t('Cancel', 'Batal') : t('Remove', 'Hapus')}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
