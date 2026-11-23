'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from '@/components/ui/icons';
import { Button } from '@/components/ui/primitives';
import { useNow } from '@/components/ui/useNow';
import { alertMessage, type AlertLevel, type VillageAlert, villageAlerts, zoneOf } from '@/lib/alerts';
import { nf } from '@/lib/format';
import { locale, t } from '@/lib/i18n';
import { STEP_MINUTES } from '@/lib/sim/params';
import { useSim } from '@/stores/simStore';
import WhatsAppPreview from './WhatsAppPreview';

const LEVEL_STYLE: Record<AlertLevel, { bg: string; fg: string; en: string; id: string }> = {
  awas: { bg: 'var(--color-danger)', fg: '#fff', en: 'Danger', id: 'Awas' },
  siaga: { bg: 'var(--color-alert, #f08c00)', fg: '#1a1300', en: 'Alert', id: 'Siaga' },
  waspada: { bg: 'var(--color-warn)', fg: '#1a1300', en: 'Watch', id: 'Waspada' },
};

function hours(h: number) {
  return h < 0.75 ? t('<1 h', '<1 jam') : t(`±${nf(Math.round(h * 2) / 2)} h`, `±${nf(Math.round(h * 2) / 2)} jam`);
}

/** Desa yang perlu diperingatkan dari hasil simulasi (api + asap) yang sedang ditampilkan. */
export function useVillageAlerts(): VillageAlert[] {
  const s = useSim();
  const main = s.withBreak ?? s.baseline;
  return useMemo(() => {
    if (!s.scenario || !main) return [];
    const smoke = new Map((s.smokeModel?.targets ?? []).filter((x) => x.kind === 'village').map((x) => [x.name, x]));
    const risks = new Map(main.villageRisks.map((r) => [r.villageName, r]));
    const stepH = STEP_MINUTES / 60;
    return villageAlerts(
      s.scenario.villages.map((v) => {
        const r = risks.get(v.name);
        const sm = smoke.get(v.name);
        return {
          name: v.name,
          lat: v.lat,
          lon: v.lon,
          population: v.population,
          fireEtaHours: r?.etaHours ?? null,
          fireProb: r?.burnProbability ?? null,
          smokeUnhealthyHours: sm && sm.unhealthyStep !== null ? (sm.unhealthyStep + 1) * stepH : null,
          smokePeak: sm ? sm.peak : null,
        };
      }),
    );
  }, [s.scenario, main, s.smokeModel]);
}

/**
 * Peringatan ke warga desa (MOCKUP): aplikasi menyusun pesan WhatsApp untuk tiap desa yang terancam api
 * atau asap, lalu menampilkan contoh pesan di layar HP warga. Tidak ada pesan yang benar-benar dikirim.
 */
export default function VillageAlerts() {
  const s = useSim();
  const now = useNow();
  const alerts = useVillageAlerts();
  const [preview, setPreview] = useState<VillageAlert | null>(null);
  /** Jam "terkirim" (simulasi) per desa. */
  const [sent, setSent] = useState<Record<string, number>>({});

  const province = s.scenario?.province ?? null;
  const zone = zoneOf(province);
  const clock = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { timeZone: zone.tz, hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');

  if (!alerts.length) {
    return (
      <section className="rounded-[8px] border border-line bg-black/20 px-3 py-3 text-sm">
        <h3 className="font-semibold">{t('WhatsApp alerts to villagers', 'Peringatan WhatsApp ke warga desa')}</h3>
        <p className="mt-1 text-text-secondary">
          {t('No village is threatened by fire or unhealthy smoke within 12 h, so no alert is needed.', 'Tidak ada desa yang terancam api atau asap tidak sehat dalam 12 jam, jadi belum perlu peringatan.')}
        </p>
      </section>
    );
  }

  const mapUrl = (a: VillageAlert) => `${typeof window !== 'undefined' ? window.location.origin : 'https://apirimba-ai.vercel.app'}/peta?lokasi=${a.lat.toFixed(5)},${a.lon.toFixed(5)}`;
  const previewMsg = preview ? alertMessage(preview, { province, nowMs: sent[preview.village] ?? now, mapUrl: mapUrl(preview) }) : null;
  const allSent = alerts.every((a) => sent[a.village]);

  const simulateSend = () => {
    const at = Date.now();
    setSent(Object.fromEntries(alerts.map((a) => [a.village, at])));
    setPreview(alerts[0]);
  };

  return (
    <section aria-labelledby="peringatan-h" className="rounded-[8px] border border-line bg-black/20 px-3 py-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="peringatan-h" className="font-semibold">
          {t('WhatsApp alerts to villagers', 'Peringatan WhatsApp ke warga desa')}
        </h3>
        <span className="shrink-0 rounded-full bg-sun/15 px-2 py-0.5 text-[11px] font-bold text-sun">{t('Mockup', 'Mockup')}</span>
      </div>
      <p className="mt-1 leading-6 text-text-secondary">
        {t(
          `${alerts.length} village(s) need an early warning. The message for each village is written automatically from this simulation.`,
          `${alerts.length} desa perlu peringatan dini. Pesan untuk tiap desa disusun otomatis dari simulasi ini.`,
        )}
      </p>

      <ul className="mt-2 divide-y divide-line-dark overflow-hidden rounded-[8px] bg-black/20">
        {alerts.map((a) => {
          const st = LEVEL_STYLE[a.level];
          const at = sent[a.village];
          return (
            <li key={a.village} className="flex items-start gap-2.5 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{a.village}</span>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: st.bg, color: st.fg }}>
                    {t(st.en, st.id)}
                  </span>
                </span>
                <span className="num block text-xs leading-5 text-text-secondary">
                  {[
                    a.fireEtaHours !== null && t(`Fire ${hours(a.fireEtaHours)}`, `Api ${hours(a.fireEtaHours)}`),
                    a.smokeHours !== null && t(`unhealthy smoke ${hours(a.smokeHours)}`, `asap tidak sehat ${hours(a.smokeHours)}`),
                    a.population ? t(`±${a.population.toLocaleString(locale())} people`, `±${a.population.toLocaleString(locale())} jiwa`) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {at && (
                  <span className="num flex items-center gap-1 text-xs text-[#53bdeb]">
                    <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m1 6 3 3 6-7M6 9l1 1 6-8" />
                    </svg>
                    {t(`Delivered (simulated) at ${clock(at)} ${zone.label}`, `Terkirim (simulasi) pukul ${clock(at)} ${zone.label}`)}
                  </span>
                )}
              </span>
              <button onClick={() => setPreview(a)} className="shrink-0 text-xs font-semibold text-wind underline-offset-4 hover:underline">
                {t('View message', 'Lihat pesan')}
              </button>
            </li>
          );
        })}
      </ul>

      <Button tone="dark" size="sm" className="mt-3 w-full" onClick={simulateSend}>
        {allSent
          ? t('Simulate sending again', 'Simulasikan kirim lagi')
          : t(`Simulate sending to ${alerts.length} village(s)`, `Simulasikan kirim ke ${alerts.length} desa`)}
      </Button>
      <p className="mt-2 text-xs leading-5 text-text-muted">
        {t(
          'Mockup: no WhatsApp message is actually sent. In a real rollout, BPBD would send this as an official WhatsApp Business template to residents who registered near each village.',
          'Mockup: tidak ada pesan WhatsApp yang benar-benar dikirim. Bila diterapkan nyata, BPBD mengirimnya sebagai template resmi WhatsApp Business ke warga yang terdaftar di sekitar tiap desa.',
        )}
      </p>

      {preview &&
        previewMsg &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-black/70 p-3" onMouseDown={(e) => e.target === e.currentTarget && setPreview(null)}>
            <div role="dialog" aria-modal="true" aria-label={t('WhatsApp message preview', 'Pratinjau pesan WhatsApp')} className="glass relative w-full max-w-[760px] rounded-[24px] p-4 sm:p-6">
              <button onClick={() => setPreview(null)} aria-label={t('Close', 'Tutup')} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60">
                <IconClose size={16} />
              </button>
              <div className="grid items-start gap-5 sm:grid-cols-[340px_1fr]">
                <WhatsAppPreview text={previewMsg.text} time={clock(sent[preview.village] ?? now)} />
                <div className="text-sm leading-6 text-ink-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-sun">{t('Mockup: what residents would receive', 'Mockup: yang akan diterima warga')}</p>
                  <h2 className="mt-1 text-xl font-bold text-ink">{t(`${preview.village} village`, `Desa ${preview.village}`)}</h2>
                  <ul className="mt-3 space-y-2">
                    <li>
                      <b className="text-ink">{t('Level', 'Level')}:</b> {t(LEVEL_STYLE[preview.level].en, LEVEL_STYLE[preview.level].id)}.{' '}
                      {t('Fire < 4 h = Awas, 4-8 h = Siaga, 8-12 h = Waspada; unhealthy smoke can raise the level.', 'Api < 4 jam = Awas, 4-8 jam = Siaga, 8-12 jam = Waspada; asap tidak sehat bisa menaikkan level.')}
                    </li>
                    <li>
                      <b className="text-ink">{t('Content', 'Isi')}:</b>{' '}
                      {t('expected arrival time of fire and smoke in local time, what to do now, emergency numbers and a map link.', 'perkiraan jam tiba api dan asap dalam waktu setempat, langkah yang perlu dilakukan, nomor darurat, dan tautan peta.')}
                    </li>
                    <li>
                      <b className="text-ink">{t('Status', 'Status')}:</b>{' '}
                      {sent[preview.village]
                        ? t('delivered in this simulation (not really sent).', 'terkirim dalam simulasi ini (tidak benar-benar dikirim).')
                        : t('not sent yet. Press "Simulate sending" to see it delivered.', 'belum dikirim. Tekan "Simulasikan kirim" untuk melihatnya terkirim.')}
                    </li>
                  </ul>
                  {alerts.length > 1 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {alerts.map((a) => (
                        <button
                          key={a.village}
                          onClick={() => setPreview(a)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${a.village === preview.village ? 'bg-white text-[#111a15]' : 'border border-line-strong text-ink hover:bg-white/10'}`}
                        >
                          {a.village}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-xs leading-5 text-ink-3">
                    {t('Times are in the local time zone', 'Jam ditulis dalam zona waktu setempat')} ({zone.label}).
                  </p>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
