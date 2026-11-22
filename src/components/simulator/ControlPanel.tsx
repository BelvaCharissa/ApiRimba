'use client';

import Link from 'next/link';
import { IconChevronLeft, IconFlame, IconUndo } from '@/components/ui/icons';
import { Button, Segmented } from '@/components/ui/primitives';
import { nf } from '@/lib/format';
import { fmtCoord, ignitionPoint } from '@/lib/geo';
import { SCENARIOS, scenarioDescription } from '@/lib/scenario';
import type { ScenarioSlug } from '@/lib/schemas';
import { useSim } from '@/stores/simStore';
import WindControl from './WindControl';
import { t } from '@/lib/i18n';

export function PanelHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold text-text-secondary">{children}</h2>;
}

const SHORT: Record<string, string> = { riau: 'Riau', kalteng: 'Kalteng', sumsel: 'Sumsel' };

interface Props {
  onScenario: (slug: ScenarioSlug) => void;
  onWind: (p: { windMs?: number; windFromDeg?: number; dryness?: number }) => void;
  onResetIgnition: () => void;
}

/** Kondisi masukan. Simulasi berjalan otomatis setiap kali nilai berubah. */
export default function ControlPanel({ onScenario, onWind, onResetIgnition }: Props) {
  const s = useSim();
  const live = s.weather && !s.weather.stale ? s.weather : null;
  const usingLive =
    live !== null && Math.abs(live.windMs - s.windMs) < 0.01 && Math.round(live.windFromDeg) === Math.round(s.windFromDeg);
  const ign = s.scenario ? ignitionPoint(s.scenario.grid, s.ignitions ?? s.scenario.ignitions) : null;

  return (
    <div className="space-y-6">
      {/* Cuaca sekarang di paling atas: satu klik tanpa menggulir */}
      <section className="rounded-[12px] bg-bg-base p-3 text-sm leading-6 text-text-secondary">
        {live ? (
          <>
            <p className="font-semibold text-text-primary">{t('Weather now in', 'Cuaca sekarang di')} {s.slug === 'live' ? (s.scenario?.name ?? t('this location', 'lokasi')) : SHORT[s.slug]}</p>
            <p>
              {t('Wind', 'Angin')} <span className="num text-text-primary">{nf(live.windMs)} m/s</span>, {t('humidity', 'kelembapan')}{' '}
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
          </>
        ) : (
          <p>{t('Using the scenario’s dry-season conditions. Live weather is not available yet.', 'Memakai kondisi kemarau skenario. Data cuaca langsung belum tersedia.')}</p>
        )}
      </section>

      <section>
        <PanelHeading>{s.slug === 'live' ? t('Hotspot location', 'Lokasi titik panas') : t('Sample area', 'Wilayah contoh')}</PanelHeading>
        {s.slug === 'live' ? (
          <div className="space-y-2">
            <p className="text-[15px] font-semibold text-text-primary">
              {s.scenario ? `${s.scenario.name}, ${s.scenario.province}` : t('Building the area...', 'Membangun area...')}
            </p>
            {s.scenario?.live && (
              <p className="rounded-[8px] bg-bg-base px-3 py-2 text-xs leading-5 text-text-secondary">
                {t('Real data: land cover', 'Data nyata: tutupan lahan')}{' '}
                {s.scenario.live.landcover === 'sentinel2' ? t('Sentinel-2 10 m imagery', 'citra Sentinel-2 10 m') : t('not available (treated as shrub)', 'tidak tersedia (dianggap semak)')}, {t('DEM elevation', 'elevasi DEM')},{' '}
                {s.scenario.live.villages === 'osm' ? t('villages from OpenStreetMap', 'desa dari OpenStreetMap') : t('settlements from imagery (village names unavailable)', 'permukiman dari citra (nama desa tidak tersedia)')}
                {s.scenario.live.peatEstimated ? t(', peat estimated from lowland', ', gambut diperkirakan dari dataran rendah') : ''}.
              </p>
            )}
            <Link href="/peta" className="inline-flex items-center gap-1 text-sm font-semibold text-wind underline-offset-4 hover:underline">
              <IconChevronLeft size={16} /> {t('Pick another hotspot on the map', 'Pilih titik panas lain di peta')}
            </Link>
          </div>
        ) : (
          <Segmented
            label={t('Choose a sample area', 'Pilih wilayah contoh')}
            value={s.slug as ScenarioSlug}
            onChange={(v) => v !== s.slug && onScenario(v)}
            options={SCENARIOS.map((sc) => ({ value: sc.slug as ScenarioSlug, label: SHORT[sc.slug] }))}
          />
        )}
        {s.scenario ? (
          <p className="mt-3 text-sm leading-6 text-text-secondary">{scenarioDescription(s.scenario)}</p>
        ) : (
          <div className="mt-3 space-y-2" aria-hidden="true">
            <div className="skeleton h-3.5 w-full rounded" />
            <div className="skeleton h-3.5 w-2/3 rounded" />
          </div>
        )}
      </section>

      <section className="border-t border-line-dark pt-5">
        <PanelHeading>{t('Ignition point', 'Titik awal api')}</PanelHeading>
        {ign && (
          <p className="flex items-start gap-2 text-sm leading-6">
            <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2 border-[#f08c00] text-[#f08c00]">
              <IconFlame size={11} />
            </span>
            <span>
              <span className="block font-semibold">{s.ignitions ? t('Picked on the map', 'Dipilih di peta') : s.slug === 'live' ? t('NASA satellite hotspot', 'Titik panas satelit NASA') : t('Scenario hotspot', 'Titik panas skenario')}</span>
              <span className="num block text-text-secondary">{fmtCoord(ign[0], ign[1])}</span>
            </span>
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            tone="dark"
            variant={s.pickIgnition ? 'primary' : 'secondary'}
            size="sm"
            className="flex-1"
            onClick={() => s.set({ pickIgnition: !s.pickIgnition })}
            aria-pressed={s.pickIgnition}
          >
            {s.pickIgnition ? t('Click a spot on the map...', 'Klik lokasi di peta...') : t('Pick a point on the map', 'Pilih titik di peta')}
          </Button>
          {s.ignitions && (
            <Button tone="dark" variant="ghost" size="sm" onClick={onResetIgnition} aria-label={t('Restore the default ignition point', 'Kembalikan titik api bawaan')}>
              <IconUndo size={16} /> {t('Default', 'Bawaan')}
            </Button>
          )}
        </div>
      </section>

      <section className="border-t border-line-dark pt-5">
        <PanelHeading>{t('Wind', 'Angin')}</PanelHeading>
        <WindControl windMs={s.windMs} windFromDeg={s.windFromDeg} onChange={onWind} />
      </section>

      <section className="border-t border-line-dark pt-5">
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="dryness" className="text-sm font-semibold text-text-secondary">
            {t('Land dryness', 'Kekeringan lahan')}
          </label>
          <output htmlFor="dryness" className="num text-base font-semibold">
            {nf(s.dryness, 2)}
          </output>
        </div>
        <input
          id="dryness"
          type="range"
          className="range w-full"
          min={0}
          max={1}
          step={0.05}
          value={s.dryness}
          onChange={(e) => onWind({ dryness: Number(e.target.value) })}
          aria-valuetext={t(`Dryness index ${nf(s.dryness, 2)}`, `Indeks kekeringan ${nf(s.dryness, 2)}`)}
          style={{
            ['--track' as string]: `linear-gradient(90deg,#c4874a ${s.dryness * 100}%,rgba(255,255,255,0.2) 0)`,
            ['--thumb' as string]: '#c4874a',
          }}
        />
        <div className="flex justify-between text-[11px] text-text-muted" aria-hidden="true">
          <span>{t('Wet', 'Basah')}</span>
          <span>{t('Long dry season', 'Kemarau panjang')}</span>
        </div>
      </section>
    </div>
  );
}
