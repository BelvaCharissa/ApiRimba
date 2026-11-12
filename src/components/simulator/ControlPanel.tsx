'use client';

import { Flame, Loader2 } from 'lucide-react';
import { fmtTimeWIB, nf } from '@/lib/format';
import { SCENARIOS } from '@/lib/scenario';
import type { ScenarioSlug } from '@/lib/schemas';
import { type Layers, useSim } from '@/stores/simStore';
import WindControl from './WindControl';

const LAYER_LABELS: { key: keyof Layers; label: string; swatch: string }[] = [
  { key: 'particles', label: 'Partikel angin', swatch: '#4fc3f7' },
  { key: 'hotspots', label: 'Titik panas', swatch: '#ffd24a' },
  { key: 'probability', label: 'Peluang terbakar', swatch: '#ff9f1c' },
  { key: 'peat', label: 'Zona gambut', swatch: '#b8793e' },
  { key: 'villages', label: 'Desa', swatch: '#e8edf4' },
  { key: 'firebreaks', label: 'Sekat bakar', swatch: '#3ddc97' },
];

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">{children}</h2>;
}

interface Props {
  onScenario: (slug: ScenarioSlug) => void;
  onWind: (p: { windMs?: number; windFromDeg?: number; dryness?: number }) => void;
  onRun: () => void;
}

export default function ControlPanel({ onScenario, onWind, onRun }: Props) {
  const s = useSim();
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>Skenario</SectionTitle>
        <div className="grid gap-2" role="radiogroup" aria-label="Pilih skenario wilayah">
          {SCENARIOS.map((sc) => {
            const active = s.slug === sc.slug;
            return (
              <button
                key={sc.slug}
                role="radio"
                aria-checked={active}
                onClick={() => !active && onScenario(sc.slug as ScenarioSlug)}
                className={`rounded-card border px-3 py-2 text-left transition ${
                  active
                    ? 'border-wind/60 bg-bg-elevated'
                    : 'border-border-dark hover:border-text-muted hover:bg-bg-elevated/60'
                }`}
              >
                <span className="block text-sm font-medium">{sc.province}</span>
                <span className="block text-xs text-text-secondary">{sc.name.split(' - ')[1]}</span>
              </button>
            );
          })}
        </div>
        {s.scenario && <p className="mt-2 text-xs leading-5 text-text-secondary">{s.scenario.description}</p>}
      </section>

      <section>
        <SectionTitle>Angin</SectionTitle>
        <WindControl windMs={s.windMs} windFromDeg={s.windFromDeg} source={s.windSource} onChange={onWind} />
        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="dryness" className="text-sm text-text-secondary">
              Kekeringan lahan
            </label>
            <span className="font-mono text-sm tabular">{nf(s.dryness, 2)}</span>
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
              ['--track' as string]: `linear-gradient(90deg,#b8793e ${s.dryness * 100}%,#263041 0)`,
              ['--thumb' as string]: '#b8793e',
            }}
          />
          <div className="mt-1 flex justify-between text-[10px] text-text-muted" aria-hidden="true">
            <span>Basah</span>
            <span>Kemarau panjang</span>
          </div>
        </div>
      </section>

      <button
        onClick={onRun}
        disabled={s.loading || !s.scenario}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-card bg-cta font-semibold text-bg-base transition hover:brightness-110 disabled:opacity-40"
      >
        {s.running ? <Loader2 size={18} className="animate-spin" /> : <Flame size={18} />}
        {s.running ? 'Menghitung sebaran api 12 jam...' : s.hasRun ? 'Jalankan ulang' : 'Jalankan simulasi'}
      </button>

      <section>
        <SectionTitle>Lapisan</SectionTitle>
        <ul className="space-y-1">
          {LAYER_LABELS.map((l) => (
            <li key={l.key}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 text-sm hover:bg-bg-elevated/60">
                <input
                  type="checkbox"
                  checked={s.layers[l.key]}
                  onChange={() => s.toggleLayer(l.key)}
                  className="size-4 accent-[#4fc3f7]"
                />
                <span className="size-2.5 rounded-full" style={{ background: l.swatch, opacity: s.layers[l.key] ? 1 : 0.3 }} />
                <span className={s.layers[l.key] ? '' : 'text-text-muted'}>{l.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-1 text-xs leading-5 text-text-secondary">
        <SectionTitle>Kesegaran data</SectionTitle>
        {s.weather && (
          <p>
            Cuaca: {s.weather.stale ? 'data cadangan' : 'Open-Meteo'}, diperbarui {fmtTimeWIB(s.weather.fetchedAt)}.
            <br />
            Suhu {nf(s.weather.tempC)}°C, kelembapan {nf(s.weather.rhPct, 0)}%, hujan 7 hari {nf(s.weather.rain7dMm)} mm.
            <br />
            Indeks kekeringan cuaca terkini <span className="font-mono text-text-primary">{nf(s.weather.dryness, 2)}</span>.
            Skenario memakai kondisi kemarau sebagai bawaan.
          </p>
        )}
        {s.weather && !s.weather.stale && (
          <button
            onClick={() =>
              onWind({ windMs: s.weather!.windMs, windFromDeg: s.weather!.windFromDeg, dryness: s.weather!.dryness })
            }
            className="mt-1 rounded-md border border-border-dark px-2.5 py-1.5 text-text-primary hover:bg-bg-elevated"
          >
            Pakai cuaca terkini ({nf(s.weather.windMs)} m/s, kekeringan {nf(s.weather.dryness, 2)})
          </button>
        )}
        {s.hotspots && (
          <p>
            Titik panas: {s.hotspots.stale ? 'data cadangan' : 'NASA FIRMS'}, {s.hotspots.items.length} titik.
            {s.hotspots.note ? ` ${s.hotspots.note}` : ''}
          </p>
        )}
      </section>
    </div>
  );
}
