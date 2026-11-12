'use client';

import { Segmented } from '@/components/ui/primitives';
import { nf } from '@/lib/format';
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
}

/** Kondisi masukan: wilayah, angin, kekeringan. Simulasi berjalan otomatis setiap kali nilai berubah. */
export default function ControlPanel({ onScenario, onWind }: Props) {
  const s = useSim();
  const live = s.weather && !s.weather.stale ? s.weather : null;
  return (
    <div className="space-y-6">
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

      <section className="rounded-[8px] bg-bg-base p-3 text-sm leading-6 text-text-secondary">
        {live ? (
          <>
            <p>
              Cuaca sekarang: angin <span className="num text-text-primary">{nf(live.windMs)} m/s</span>, kelembapan{' '}
              <span className="num text-text-primary">{nf(live.rhPct, 0)}%</span>, hujan 7 hari{' '}
              <span className="num text-text-primary">{nf(live.rain7dMm)} mm</span>.
            </p>
            <button
              onClick={() => onWind({ windMs: live.windMs, windFromDeg: live.windFromDeg, dryness: live.dryness })}
              className="mt-2 font-semibold text-wind underline-offset-4 hover:underline"
            >
              Pakai cuaca sekarang
            </button>
          </>
        ) : (
          <p>Skenario memakai kondisi kemarau. Cuaca langsung tidak tersedia.</p>
        )}
      </section>
    </div>
  );
}
