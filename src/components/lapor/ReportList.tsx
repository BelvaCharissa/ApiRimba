'use client';

import { useT } from '@/components/i18n/LangProvider';
import { locale } from '@/lib/i18n';

export type AiLabel = 'fire' | 'smoke' | 'burnt' | 'none' | 'unclear';

export interface PublicReport {
  id: string;
  created_at: string;
  lat: number;
  lon: number;
  category: 'fire' | 'smoke' | 'burnt';
  description: string;
  photo_url: string;
  status: 'matched' | 'pending' | 'verified';
  satellite_km: number | null;
  exif_km: number | null;
  reporter: string | null;
  ai_label: AiLabel | null;
  ai_confidence: number | null;
  photo_source: 'camera' | 'gallery' | null;
  place: string | null;
  photo_taken_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export function useCategoryLabel() {
  const t = useT();
  return (c: PublicReport['category']) =>
    c === 'fire' ? t('Open fire', 'Api terlihat') : c === 'smoke' ? t('Smoke only', 'Asap saja') : t('Burnt area', 'Lahan bekas terbakar');
}

export function useAiLabel() {
  const t = useT();
  return (l: AiLabel) =>
    ({
      fire: t('AI sees flames', 'AI melihat api'),
      smoke: t('AI sees smoke', 'AI melihat asap'),
      burnt: t('AI sees burnt land', 'AI melihat lahan terbakar'),
      none: t('AI sees no fire', 'AI tidak melihat api'),
      unclear: t('AI: photo unclear', 'AI: foto kurang jelas'),
    })[l];
}

export function StatusPill({ status }: { status: PublicReport['status'] }) {
  const t = useT();
  const map = {
    verified: { cls: 'grad-sun', text: t('Verified by officer', 'Diverifikasi petugas') },
    matched: { cls: 'bg-[#2fb67c]/20 text-[#6fdca8]', text: t('Matched with satellite', 'Cocok dengan satelit') },
    pending: { cls: 'bg-white/10 text-ink-2', text: t('Waiting for officer', 'Menunggu petugas') },
  } as const;
  const m = map[status];
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${m.cls}`}>{m.text}</span>;
}

/** Kartu laporan warga dengan foto ber-watermark dan hasil pemeriksaan. */
export default function ReportList({ reports, compact = false }: { reports: PublicReport[]; compact?: boolean }) {
  const t = useT();
  const cat = useCategoryLabel();
  const ai = useAiLabel();
  if (reports.length === 0)
    return (
      <p className="glass rounded-[16px] p-5 text-sm text-ink-2">
        {t('No citizen reports yet. Be the first to report what you see.', 'Belum ada laporan warga. Jadilah yang pertama melaporkan apa yang Anda lihat.')}
      </p>
    );
  return (
    <ul className={`grid gap-3 ${compact ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {reports.map((r) => (
        <li key={r.id} className="glass overflow-hidden rounded-[20px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.photo_url} alt={`${cat(r.category)}: ${r.description.slice(0, 80)}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          <div className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{cat(r.category)}</p>
              <StatusPill status={r.status} />
            </div>
            <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-ink-2">{r.description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
              {r.ai_label && (
                <span className={`rounded-full px-2 py-0.5 ${['fire', 'smoke', 'burnt'].includes(r.ai_label) ? 'bg-[#ff7a2f]/15 text-[#ffab70]' : 'bg-white/10 text-ink-3'}`}>
                  {ai(r.ai_label)}
                </span>
              )}
              {r.photo_source && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-ink-2">
                  {r.photo_source === 'camera' ? t('Live camera', 'Kamera langsung') : t('From gallery', 'Dari galeri')}
                </span>
              )}
            </div>
            <p className="num mt-2 text-xs text-ink-3">
              {new Date(r.created_at).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {' · '}
              {r.place ?? `${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}`}
              {r.reporter ? ` · ${r.reporter}` : ''}
            </p>
            <p className="num mt-1 text-xs text-ink-3">
              {r.satellite_km !== null
                ? t(`Nearest satellite hotspot: ${r.satellite_km.toLocaleString(locale())} km`, `Titik panas satelit terdekat: ${r.satellite_km.toLocaleString(locale())} km`)
                : t('No satellite hotspot within 50 km in 48 h', 'Tidak ada titik panas satelit dalam 50 km selama 48 jam')}
            </p>
            {r.review_note && (
              <p className="mt-2 rounded-[10px] bg-black/25 px-2.5 py-1.5 text-xs leading-5 text-ink-2">
                <b className="text-ink">{t('Officer', 'Petugas')}:</b> {r.review_note}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
