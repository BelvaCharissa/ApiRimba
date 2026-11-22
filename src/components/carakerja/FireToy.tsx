'use client';

import { useEffect, useMemo, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { IconPause, IconPlay, IconUndo } from '@/components/ui/icons';
import { Button } from '@/components/ui/primitives';
import type { ScenarioData } from '@/lib/scenario';
import type { NationalHotspots } from '@/lib/pantau';
import { burnedByStep, cellsToKm2, runMonteCarlo } from '@/lib/sim/engine';
import { buildSimInput } from '@/lib/sim/input';
import { DEFAULT_SEED, STEP_MINUTES, STEPS_12H } from '@/lib/sim/params';

const IMG = { w: 2400, h: 1350 };
const AREA = { x: 600, y: 75, w: 1200, h: 1200 };
const WIND_OPTIONS = [
  { deg: 225, en: 'South-west', id: 'Barat daya' },
  { deg: 315, en: 'North-west', id: 'Barat laut' },
  { deg: 180, en: 'South', id: 'Selatan' },
] as const;

export default function FireToy() {
  const t = useT();
  const [data, setData] = useState<ScenarioData | null>(null);
  const [live, setLive] = useState<NationalHotspots | null>(null);
  const [wind, setWind] = useState(225);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/data/scenarios/riau.json').then((r) => r.ok ? r.json() : Promise.reject()),
      fetch('/api/pantau/hotspots').then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([scenario, hotspots]) => {
      setData(scenario as ScenarioData);
      setLive(hotspots as NationalHotspots | null);
    }).catch(() => undefined);
  }, []);

  const result = useMemo(() => {
    if (!data) return null;
    const mc = runMonteCarlo(buildSimInput(data, { windMs: 7, windFromDeg: wind }), DEFAULT_SEED, 12);
    return {
      mc,
      km2: burnedByStep(mc.representative.arrival, STEPS_12H).map((c) => cellsToKm2(c, data.grid.cellSizeM)),
    };
  }, [data, wind]);

  useEffect(() => {
    if (!playing) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- gerak dikurangi: langsung ke langkah akhir
      setStep(STEPS_12H);
      setPlaying(false);
      return;
    }
    const id = window.setInterval(() => {
      setStep((v) => {
        if (v >= STEPS_12H) {
          setPlaying(false);
          return STEPS_12H;
        }
        return v + 1;
      });
    }, 220);
    return () => window.clearInterval(id);
  }, [playing]);

  const fireUrl = useMemo(() => {
    if (!data || !result || typeof document === 'undefined') return null;
    const { w, h } = data.grid;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const image = ctx.createImageData(w, h);
    const arrival = result.mc.representative.arrival;
    const burnUntil = result.mc.representative.burnUntil;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      let px: [number, number, number, number] = [0, 0, 0, 0];
      const a = arrival[i];
      if (step > 0 && a >= 0 && a <= step) {
        px = step < burnUntil[i] ? (step - a > 3 ? [228, 64, 28, 230] : [255, 206, 74, 245]) : [28, 18, 14, 140];
      } else if (step > 0 && result.mc.prob[i] >= 0.3) {
        px = [255, 140, 60, Math.round(result.mc.prob[i] * 55)];
      }
      image.data.set(px, o);
    }
    ctx.putImageData(image, 0, 0);

    const enlarged = document.createElement('canvas');
    enlarged.width = w * 4;
    enlarged.height = h * 4;
    const enlargedCtx = enlarged.getContext('2d');
    if (!enlargedCtx) return canvas.toDataURL();
    enlargedCtx.filter = 'blur(2px)';
    enlargedCtx.imageSmoothingEnabled = true;
    enlargedCtx.drawImage(canvas, 0, 0, enlarged.width, enlarged.height);
    return enlarged.toDataURL();
  }, [data, result, step]);

  const hours = (step * STEP_MINUTES) / 60;
  const km2 = result?.km2[step] ?? 0;
  const liveCount = live?.source === 'nasa-firms' ? live.items.length : null;

  const reset = () => {
    setStep(0);
    setPlaying(true);
  };

  return (
    <div className="glass overflow-hidden rounded-[24px]">
      <div className="grid gap-0 lg:grid-cols-[1.55fr_1fr]">
        <div className="relative min-h-[440px] overflow-hidden bg-[#06120c]">
          <svg viewBox={`0 0 ${IMG.w} ${IMG.h}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" role="img" aria-label={t('Real Riau 16 by 16 kilometre fire simulation', 'Simulasi nyata api Riau 16 kali 16 kilometer')}>
            <image href="/img/hero-riau.jpg" width={IMG.w} height={IMG.h} />
            {fireUrl && <image href={fireUrl} x={AREA.x} y={AREA.y} width={AREA.w} height={AREA.h} preserveAspectRatio="none" />}
            <rect x={AREA.x} y={AREA.y} width={AREA.w} height={AREA.h} fill="none" stroke="#ffd24a" strokeOpacity="0.7" strokeWidth="4" strokeDasharray="18 12" />
            {data?.villages.map((v) => {
              const g = data.grid;
              const x = AREA.x + ((v.lon - g.originLon) / g.cellDegLon / g.w) * AREA.w;
              const y = AREA.y + ((g.originLat - v.lat) / g.cellDegLat / g.h) * AREA.h;
              return (
                <g key={v.name}>
                  <circle cx={x} cy={y} r="9" fill="#fff" stroke="#0b1d15" strokeWidth="3" />
                </g>
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,18,12,.05),rgba(6,18,12,.58))]" />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#0b1d15]/85 px-3 py-1.5 text-xs font-bold text-white">
              {t('Riau · real 16 × 16 km example', 'Riau · contoh nyata 16 × 16 km')}
            </span>
            {liveCount !== null && (
              <span className="rounded-full bg-[#2fb67c]/90 px-3 py-1.5 text-xs font-bold text-white">
                NASA FIRMS · {liveCount} {t('hotspots', 'titik panas')}
              </span>
            )}
          </div>
          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white/70">{t('Time', 'Waktu')}</p>
              <p className="num text-3xl font-bold text-white">+{hours.toFixed(1)} h</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-white/70">{t('Estimated area', 'Perkiraan luas')}</p>
              <p className="num text-2xl font-bold text-[#ffd24a]">{km2.toFixed(1)} km²</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => step >= STEPS_12H ? (setStep(0), setPlaying(true)) : setPlaying((v) => !v)}>
              {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
              {playing ? t('Pause', 'Jeda') : t('Play 12 hours', 'Putar 12 jam')}
            </Button>
            <Button variant="secondary" onClick={reset}>
              <IconUndo size={16} /> {t('Reset', 'Ulang')}
            </Button>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink">{t('Wind direction', 'Arah angin')}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {WIND_OPTIONS.map((w) => (
                <button
                  key={w.deg}
                  type="button"
                  aria-pressed={wind === w.deg}
                  onClick={() => { setWind(w.deg); setStep(0); setPlaying(true); }}
                  className={`rounded-[12px] border px-2 py-2 text-xs font-semibold ${wind === w.deg ? 'border-sun bg-sun/10 text-ink' : 'border-line text-ink-2'}`}
                >
                  {t(w.en, w.id)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="grid grid-cols-3 text-xs font-semibold text-ink-2">
              <span><b className="block text-base text-ink">0 h</b>{t('Ignition', 'Mulai')}</span>
              <span className="text-center"><b className="block text-base text-ink">6 h</b>{t('Spreading', 'Merambat')}</span>
              <span className="text-right"><b className="block text-base text-ink">12 h</b>{t('Finished', 'Selesai')}</span>
            </div>
            <div className="relative mt-2 h-2 rounded-full bg-white/10">
              <span className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#ffd24a,#ff7a32,#ef4444)]" style={{ width: `${(step / STEPS_12H) * 100}%` }} />
              {[0, 50, 100].map((p) => <span key={p} className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink bg-white" style={{ left: `${p}%` }} />)}
            </div>
          </div>

          <p className="text-xs leading-5 text-ink-3">
            {t(
              'This example uses the same 16 × 16 km Riau scenario and engine as Map & simulation. It starts automatically and changes when the wind changes.',
              'Contoh ini memakai skenario Riau 16 × 16 km dan mesin yang sama dengan Peta & Simulasi. Mulai otomatis dan berubah saat arah angin diganti.',
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
