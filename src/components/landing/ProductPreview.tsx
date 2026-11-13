'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconPause, IconPlay } from '@/components/ui/icons';
import { Segmented, StatusBadge } from '@/components/ui/primitives';
import { nf, stepToClock } from '@/lib/format';
import { ignitionPoint } from '@/lib/geo';
import type { ScenarioData } from '@/lib/scenario';
import { burnedByStep, cellsToKm2, runMonteCarlo } from '@/lib/sim/engine';
import { buildSimInput } from '@/lib/sim/input';
import { DEFAULT_SEED, STEP_MINUTES, STEPS_12H } from '@/lib/sim/params';
import { villageRisks } from '@/lib/sim/risk';
import { Fuel } from '@/lib/sim/types';

const WINDS = [
  { value: 225, label: 'Barat daya' },
  { value: 315, label: 'Barat laut' },
  { value: 180, label: 'Selatan' },
] as const;

const LAND: Record<number, [number, number, number]> = {
  [Fuel.WATER]: [122, 176, 214],
  [Fuel.SHRUB]: [204, 216, 170],
  [Fuel.PEAT]: [220, 192, 150],
  [Fuel.SECONDARY_FOREST]: [160, 200, 152],
  [Fuel.PLANTATION]: [196, 212, 138],
  [Fuel.PRIMARY_FOREST]: [118, 168, 124],
  [Fuel.OPEN]: [232, 226, 204],
  [Fuel.SETTLEMENT]: [200, 202, 208],
};

/**
 * Pratinjau produk sungguhan: mesin simulasi yang sama dengan simulator, dijalankan di browser
 * untuk skenario Riau. Pengunjung bisa mengganti arah angin dan melihat api berbelok.
 */
export default function ProductPreview() {
  const [data, setData] = useState<ScenarioData | null>(null);
  const [wind, setWind] = useState<number>(225);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch('/data/scenarios/riau.json')
      .then((r) => r.json())
      .then((d: ScenarioData) => setData(d))
      .catch(() => undefined);
  }, []);

  const result = useMemo(() => {
    if (!data) return null;
    const mc = runMonteCarlo(buildSimInput(data, { windMs: 7, windFromDeg: wind }), DEFAULT_SEED, 12);
    return {
      mc,
      byStep: burnedByStep(mc.representative.arrival, STEPS_12H).map((c) => cellsToKm2(c, data.grid.cellSizeM)),
      risks: villageRisks(data.grid, data.villages, mc.prob, mc.meanArrival, STEP_MINUTES),
    };
  }, [data, wind]);

  useEffect(() => {
    if (!playing) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = setInterval(() => {
      setT((v) => {
        if (reduce) {
          setPlaying(false);
          return STEPS_12H;
        }
        if (v >= STEPS_12H) {
          setPlaying(false);
          return v;
        }
        return v + 1;
      });
    }, 110);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !data || !result) return;
    const { w, h } = data.grid;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const arr = result.mc.representative.arrival;
    const until = result.mc.representative.burnUntil;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      let [r, g, b] = LAND[data.fuelClass[i]] ?? LAND[Fuel.OPEN];
      const a = arr[i];
      if (a >= 0 && a <= t) {
        if (t < until[i]) [r, g, b] = t - a > 3 ? [201, 42, 42] : [255, 212, 59];
        else [r, g, b] = [150, 130, 124];
      } else if (result.mc.prob[i] >= 0.3) {
        const p = result.mc.prob[i] * 0.45;
        r = Math.round(r + (151 - r) * p);
        g = Math.round(g + (117 - g) * p);
        b = Math.round(b + (250 - b) * p);
      }
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    tmp.getContext('2d')!.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmp, 0, 0, c.width, c.height);
  }, [data, result, t]);

  const ign = data ? ignitionPoint(data.grid, data.ignitions) : null;
  const risks = result ? [...result.risks].sort((a, b) => (a.etaHours ?? 99) - (b.etaHours ?? 99)) : [];
  const km2 = result ? result.byStep[t] : 0;
  const hours = (t * STEP_MINUTES) / 60;
  const scale = (v: number, axis: 'x' | 'y') =>
    data ? (axis === 'x' ? ((v - data.grid.originLon) / data.grid.cellDegLon / data.grid.w) * 100 : ((data.grid.originLat - v) / data.grid.cellDegLat / data.grid.h) * 100) : 0;

  return (
    <div className="theme-sim overflow-hidden rounded-[28px] bg-card p-2 shadow-card">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,600px)_1fr]">
        {/* peta */}
        <div className="relative aspect-square overflow-hidden rounded-[20px] bg-bg-surface">
          <canvas ref={canvasRef} width={640} height={640} className="absolute inset-0 h-full w-full" aria-hidden="true" />
          {data &&
            data.villages.map((v) => {
              const r = risks.find((x) => x.villageName === v.name);
              const reached = r?.etaHours !== null && r?.etaHours !== undefined && r.etaHours <= hours;
              const right = scale(v.lon, 'x') > 70;
              return (
                <span
                  key={v.name}
                  className={`absolute flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap ${right ? '-translate-x-full flex-row-reverse' : '-translate-x-[11px]'}`}
                  style={{ left: `${scale(v.lon, 'x')}%`, top: `${scale(v.lat, 'y')}%` }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style={{ filter: 'drop-shadow(0 1px 2px rgba(17,26,21,.35))' }}>
                    <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill={reached ? '#ee4b4b' : '#ffffff'} stroke={reached ? '#fff' : '#111a15'} strokeWidth="2" />
                  </svg>
                  <span className={`rounded-[8px] px-2 py-1 text-xs font-semibold ${reached ? 'bg-[#c92a2a] text-white' : 'bg-card/95 shadow-card'}`}>
                    {v.name}
                    <span className={`num block font-medium ${reached ? 'text-white/85' : 'text-text-secondary'}`}>
                      {r?.etaHours === null || r?.etaHours === undefined
                        ? 'Aman 12 jam'
                        : reached
                          ? 'Api sudah tiba'
                          : `±${nf(r.etaHours - hours)} jam lagi`}
                    </span>
                  </span>
                </span>
              );
            })}
          {ign && (
            <span
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center"
              style={{ left: `${scale(ign[0], 'x')}%`, top: `${scale(ign[1], 'y')}%` }}
            >
              <span className="grid size-6 place-items-center rounded-full border-2 border-[#f08c00] bg-white">
                <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M10 2c1 3 4 4.5 4 8.5A4 4 0 0 1 6 10.5c0-1.6.8-2.6 1.6-3.4.2 1.2.9 2 1.7 2.2C9 7 9.2 4.6 10 2z" fill="#f08c00" />
                </svg>
              </span>
              <span className="absolute left-8 whitespace-nowrap rounded-[6px] bg-[#ffd43b] px-1.5 py-0.5 text-[11px] font-bold text-[#1a1300]">
                Titik awal api
              </span>
            </span>
          )}
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-bg-base/90 px-3 py-1.5 text-sm">
            <svg width="14" height="14" viewBox="0 0 16 16" style={{ transform: `rotate(${(wind + 180) % 360}deg)` }} aria-hidden="true">
              <path d="M8 1 13 12 8 9.5 3 12z" fill="#0a6994" />
            </svg>
            <span className="font-semibold">7 m/s</span>
          </div>
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-[12px] bg-bg-base/90 p-2">
            <button
              onClick={() => (t >= STEPS_12H ? (setT(0), setPlaying(true)) : setPlaying(!playing))}
              aria-label={playing ? 'Jeda' : 'Putar'}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-forest-950 text-white hover:bg-forest-800"
            >
              {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
            </button>
            <input
              type="range"
              className="range min-w-0 flex-1"
              min={0}
              max={STEPS_12H}
              value={t}
              onChange={(e) => {
                setPlaying(false);
                setT(Number(e.target.value));
              }}
              aria-label="Waktu simulasi"
              aria-valuetext={`${stepToClock(t)} jam dari sekarang`}
              style={{
                ['--track' as string]: `linear-gradient(90deg,#ff7a45 ${(t / STEPS_12H) * 100}%,#c4ccc3 0)`,
                ['--thumb' as string]: '#ff7a45',
              }}
            />
            <span className="num w-14 text-right text-sm font-semibold">{stepToClock(t)}</span>
          </div>
        </div>

        {/* panel hasil */}
        <div className="flex flex-col gap-4 rounded-[20px] bg-bg-surface p-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-text-secondary">Angin dari</p>
            <Segmented
              label="Arah angin"
              value={wind}
              onChange={(v) => {
                setWind(v);
                setT(0);
                setPlaying(true);
              }} options={WINDS.map((w) => ({ value: w.value, label: w.label }))} />
          </div>
          <div>
            <p className="font-display text-4xl font-bold tracking-tight">
              <span className="num">{nf(km2)}</span> km²
            </p>
            <p className="text-sm text-text-secondary">terbakar pada {stepToClock(t)}</p>
          </div>
          <ul className="divide-y divide-line-dark overflow-hidden rounded-[8px] bg-bg-base">
            {(risks.length ? risks : Array.from({ length: 4 }, () => null)).map((v, k) =>
              v ? (
                <li key={v.villageName} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{v.villageName}</span>
                    <span className="num block text-xs text-text-secondary">
                      {v.etaHours === null ? 'Tidak terjangkau 12 jam' : `Tiba ${nf(v.etaHours)} jam`}
                    </span>
                  </span>
                  <StatusBadge level={v.level} />
                </li>
              ) : (
                <li key={k} className="px-3 py-3">
                  <div className="skeleton h-4 w-2/3 rounded" />
                </li>
              ),
            )}
          </ul>
          <p className="mt-auto text-xs leading-5 text-text-muted">
            Mesin simulasi yang sama dengan simulator, berjalan langsung di browser Anda. Geser bilah waktu untuk melompat ke jam mana pun. Lanskap dan nama desa adalah ilustrasi.
          </p>
        </div>
      </div>
    </div>
  );
}
