'use client';

import { IconFlame, IconUndo } from '@/components/ui/icons';
import { Button, Segmented } from '@/components/ui/primitives';
import { nf } from '@/lib/format';
import { fmtCoord, ignitionPoint } from '@/lib/geo';
import { SCENARIOS } from '@/lib/scenario';
import type { ScenarioSlug } from '@/lib/schemas';
import { useSim } from '@/stores/simStore';
import WindControl from './WindControl';

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
            <p className="font-semibold text-text-primary">Cuaca sekarang di {SHORT[s.slug]}</p>
            <p>
              Angin <span className="num text-text-primary">{nf(live.windMs)} m/s</span>, kelembapan{' '}
              <span className="num text-text-primary">{nf(live.rhPct, 0)}%</span>, hujan 7 hari{' '}
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
              {usingLive ? 'Sedang memakai cuaca sekarang' : 'Pakai cuaca sekarang'}
            </Button>
          </>
        ) : (
          <p>Memakai kondisi kemarau skenario. Data cuaca langsung belum tersedia.</p>
        )}
      </section>

      <section>
        <PanelHeading>Wilayah</PanelHeading>
        <Segmented
          label="Pilih wilayah"
          value={s.slug}
          onChange={(v) => v !== s.slug && onScenario(v)}
          options={SCENARIOS.map((sc) => ({ value: sc.slug as ScenarioSlug, label: SHORT[sc.slug] }))}
        />
        {s.scenario ? (
          <p className="mt-3 text-sm leading-6 text-text-secondary">{s.scenario.description}</p>
        ) : (
          <div className="mt-3 space-y-2" aria-hidden="true">
            <div className="skeleton h-3.5 w-full rounded" />
            <div className="skeleton h-3.5 w-2/3 rounded" />
          </div>
        )}
      </section>

      <section className="border-t border-line-dark pt-5">
        <PanelHeading>Titik awal api</PanelHeading>
        {ign && (
          <p className="flex items-start gap-2 text-sm leading-6">
            <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2 border-[#ffd43b] text-[#ffd43b]">
              <IconFlame size={11} />
            </span>
            <span>
              <span className="block font-semibold">{s.ignitions ? 'Dipilih di peta' : 'Titik panas skenario'}</span>
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
            {s.pickIgnition ? 'Klik lokasi di peta...' : 'Pilih titik di peta'}
          </Button>
          {s.ignitions && (
            <Button tone="dark" variant="ghost" size="sm" onClick={onResetIgnition} aria-label="Kembalikan titik api bawaan">
              <IconUndo size={16} /> Bawaan
            </Button>
          )}
        </div>
      </section>

      <section className="border-t border-line-dark pt-5">
        <PanelHeading>Angin</PanelHeading>
        <WindControl windMs={s.windMs} windFromDeg={s.windFromDeg} onChange={onWind} />
      </section>

      <section className="border-t border-line-dark pt-5">
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="dryness" className="text-sm font-semibold text-text-secondary">
            Kekeringan lahan
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
          aria-valuetext={`Indeks kekeringan ${nf(s.dryness, 2)}`}
          style={{
            ['--track' as string]: `linear-gradient(90deg,#c4874a ${s.dryness * 100}%,#2b3645 0)`,
            ['--thumb' as string]: '#c4874a',
          }}
        />
        <div className="flex justify-between text-[11px] text-text-muted" aria-hidden="true">
          <span>Basah</span>
          <span>Kemarau panjang</span>
        </div>
      </section>
    </div>
  );
}
