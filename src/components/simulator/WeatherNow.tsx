'use client';

import { Button, Spinner } from '@/components/ui/primitives';
import { useNow } from '@/components/ui/useNow';
import { compass, nf } from '@/lib/format';
import { t } from '@/lib/i18n';
import { weatherAlerts } from '@/lib/weather';
import { useSim } from '@/stores/simStore';

const SHORT: Record<string, string> = { riau: 'Riau', kalteng: 'Kalteng', sumsel: 'Sumsel' };

function clockWIB(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).replace('.', ':');
}

/** Panah arah TIUP angin (ke mana api dan asap terdorong). */
function WindArrow({ fromDeg, size = 16 }: { fromDeg: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${fromDeg + 180}deg)` }}>
      <path d="M12 3 18 15h-4.5v6h-3v-6H6z" fill="currentColor" />
    </svg>
  );
}

interface Props {
  onWind: (p: { windMs?: number; windFromDeg?: number; dryness?: number }) => void;
}

/** Cuaca langsung di lokasi simulasi + prakiraan 12 jam dan peringatan perubahan angin/hujan. */
export default function WeatherNow({ onWind }: Props) {
  const s = useSim();
  const now = useNow();
  const live = s.weather && !s.weather.stale ? s.weather : null;
  const usingLive =
    live !== null && Math.abs(live.windMs - s.windMs) < 0.01 && Math.round(live.windFromDeg) === Math.round(s.windFromDeg);
  const place = s.slug === 'live' ? (s.scenario?.name ?? t('this location', 'lokasi ini')) : SHORT[s.slug];

  if (!live) {
    return (
      <section className="rounded-[12px] bg-bg-base p-3 text-sm leading-6 text-text-secondary" aria-live="polite">
        {s.weatherState === 'loading' ? (
          <p className="flex items-center gap-2">
            <Spinner size={14} /> {t('Fetching live weather at this location...', 'Mengambil cuaca langsung di lokasi ini...')}
          </p>
        ) : (
          <p>
            {s.demoMode
              ? t('Offline: using the scenario’s dry-season conditions stored in the app.', 'Offline: memakai kondisi kemarau skenario yang tersimpan di aplikasi.')
              : t('Live weather could not be loaded right now, so the scenario’s dry-season conditions are used. It retries automatically.', 'Cuaca langsung belum bisa dimuat, jadi dipakai kondisi kemarau skenario. Aplikasi mencoba lagi otomatis.')}
          </p>
        )}
      </section>
    );
  }

  const hours = (live.forecast ?? []).filter((h) => Date.parse(h.time) + 3600_000 > now);
  const strip = hours.filter((_, k) => k % 2 === 0).slice(0, 7);
  // Dibanding angin sekarang yang sebenarnya (bukan angin skenario), agar peringatan berarti perubahan nyata.
  const alerts = weatherAlerts(hours, live.windMs, live.windFromDeg, now);

  return (
    <section className="rounded-[12px] bg-bg-base p-3 text-sm leading-6 text-text-secondary">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold text-text-primary">
          {t('Weather now in', 'Cuaca sekarang di')} {place}
        </p>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-text-muted">
          <span className="size-1.5 rounded-full bg-[#4ade80]" aria-hidden="true" /> {t('Live', 'Langsung')} {clockWIB(live.fetchedAt)}
        </span>
      </div>
      <p>
        <span className="inline-flex items-center gap-1 align-middle text-wind">
          <WindArrow fromDeg={live.windFromDeg} size={14} />
        </span>{' '}
        {t('Wind', 'Angin')} <span className="num text-text-primary">{nf(live.windMs)} m/s</span> {t('from', 'dari')} {compass(live.windFromDeg)},{' '}
        <span className="num text-text-primary">{nf(live.tempC)}°C</span>, {t('humidity', 'kelembapan')}{' '}
        <span className="num text-text-primary">{nf(live.rhPct, 0)}%</span>, {t('7-day rain', 'hujan 7 hari')}{' '}
        <span className="num text-text-primary">{nf(live.rain7dMm)} mm</span>.
      </p>
      <Button
        tone="dark"
        variant={usingLive ? 'secondary' : 'primary'}
        size="sm"
        className="mt-2 w-full"
        disabled={usingLive}
        onClick={() => onWind({ windMs: live.windMs, windFromDeg: live.windFromDeg, dryness: live.dryness })}
      >
        {usingLive ? t('Using current weather', 'Sedang memakai cuaca sekarang') : t('Use current weather', 'Pakai cuaca sekarang')}
      </Button>

      {strip.length > 1 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-text-secondary">{t('Next 12 hours', '12 jam ke depan')}</p>
          <ol className="grid grid-cols-7 gap-1 text-center" aria-label={t('Hourly forecast', 'Prakiraan per jam')}>
            {strip.map((h, k) => (
              <li
                key={h.time}
                className="rounded-[8px] bg-black/20 px-0.5 py-1.5"
                title={`${clockWIB(h.time)} WIB: ${t('wind', 'angin')} ${nf(h.windMs)} m/s ${t('from', 'dari')} ${compass(h.windFromDeg)}${h.rainProb !== null ? `, ${t('rain', 'hujan')} ${h.rainProb}%` : ''}`}
              >
                <span className="num block text-[10px] leading-4 text-text-muted">{k === 0 ? t('Now', 'Kini') : clockWIB(h.time).slice(0, 2)}</span>
                <span className="mx-auto my-0.5 block w-fit text-wind">
                  <WindArrow fromDeg={h.windFromDeg} size={14} />
                </span>
                <span className="num block text-[11px] font-semibold leading-4 text-text-primary">{nf(h.windMs, 0)}</span>
                <span className={`num block text-[10px] leading-4 ${(h.rainProb ?? 0) >= 50 ? 'text-wind' : 'text-text-muted'}`}>
                  {h.rainProb !== null ? `${h.rainProb}%` : '-'}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-1 text-[11px] leading-4 text-text-muted">
            {t('Arrow = where the wind blows to · m/s · chance of rain. Times in WIB.', 'Panah = arah tiup angin · m/s · peluang hujan. Waktu WIB.')}
          </p>
        </div>
      )}

      {alerts.length > 0 && (
        <ul className="mt-3 space-y-2">
          {alerts.map((a) => (
            <li key={a.kind} className={`rounded-[10px] border px-3 py-2 text-xs leading-5 ${a.kind === 'rain' ? 'border-wind/40 bg-wind/10' : 'border-warn/50 bg-warn/10'}`}>
              {a.kind === 'shift' && (
                <>
                  <b className="text-text-primary">{t('Wind shift ahead.', 'Angin akan berbelok.')}</b>{' '}
                  {t(
                    `Around ${clockWIB(a.hour.time)} WIB (+${a.inHours} h) the wind comes from the ${compass(a.hour.windFromDeg)} at ${nf(a.hour.windMs)} m/s. The fire and smoke may turn.`,
                    `Sekitar pukul ${clockWIB(a.hour.time)} WIB (+${a.inHours} jam) angin dari ${compass(a.hour.windFromDeg)} ${nf(a.hour.windMs)} m/s. Arah api dan asap bisa berubah.`,
                  )}
                  <Button
                    tone="dark"
                    variant="secondary"
                    size="sm"
                    className="mt-1.5 w-full"
                    onClick={() => onWind({ windMs: a.hour.windMs, windFromDeg: a.hour.windFromDeg })}
                  >
                    {t(`Simulate the +${a.inHours} h wind`, `Simulasikan angin +${a.inHours} jam`)}
                  </Button>
                </>
              )}
              {a.kind === 'stronger' && (
                <>
                  <b className="text-text-primary">{t('Wind getting stronger.', 'Angin menguat.')}</b>{' '}
                  {t(
                    `Up to ${nf(a.hour.windMs)} m/s around ${clockWIB(a.hour.time)} WIB. Fire spreads faster in strong wind.`,
                    `Hingga ${nf(a.hour.windMs)} m/s sekitar pukul ${clockWIB(a.hour.time)} WIB. Api menjalar lebih cepat saat angin kencang.`,
                  )}
                </>
              )}
              {a.kind === 'rain' && (
                <>
                  <b className="text-text-primary">{t('Rain expected.', 'Hujan diperkirakan.')}</b>{' '}
                  {t(
                    `Around ${clockWIB(a.hour.time)} WIB (${nf(a.hour.rainMm)} mm${a.hour.rainProb !== null ? `, ${a.hour.rainProb}% chance` : ''}). Rain slows surface fire, but peat can keep smouldering underground.`,
                    `Sekitar pukul ${clockWIB(a.hour.time)} WIB (${nf(a.hour.rainMm)} mm${a.hour.rainProb !== null ? `, peluang ${a.hour.rainProb}%` : ''}). Hujan memperlambat api permukaan, tetapi gambut bisa tetap membara di bawah tanah.`,
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
