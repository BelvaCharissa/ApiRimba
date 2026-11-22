'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { IconPause, IconPlay, IconUndo } from '@/components/ui/icons';
import { Button } from '@/components/ui/primitives';

/**
 * Simulasi mainan untuk halaman cara kerja: versi kecil dari mesin sebenarnya
 * (automata seluler, 8 tetangga, peluang naik searah angin, di lahan kering, dan di gambut).
 * Klik untuk menyalakan api, mode "Sekat" untuk menggambar sekat bakar.
 */
const W = 28;
const H = 18;
type Cell = 0 | 1 | 2 | 3 | 4 | 5; // 0 hutan, 1 gambut, 2 air, 3 menyala, 4 bekas, 5 sekat

const DIRS: { key: string; ab: string; dx: number; dy: number; id: string; en: string }[] = [
  { key: 'N', ab: 'U', dx: 0, dy: -1, id: 'Utara', en: 'North' },
  { key: 'NE', ab: 'TL', dx: 1, dy: -1, id: 'Timur laut', en: 'North-east' },
  { key: 'E', ab: 'T', dx: 1, dy: 0, id: 'Timur', en: 'East' },
  { key: 'SE', ab: 'TG', dx: 1, dy: 1, id: 'Tenggara', en: 'South-east' },
  { key: 'S', ab: 'S', dx: 0, dy: 1, id: 'Selatan', en: 'South' },
  { key: 'SW', ab: 'BD', dx: -1, dy: 1, id: 'Barat daya', en: 'South-west' },
  { key: 'W', ab: 'B', dx: -1, dy: 0, id: 'Barat', en: 'West' },
  { key: 'NW', ab: 'BL', dx: -1, dy: -1, id: 'Barat laut', en: 'North-west' },
];

function initial(): Cell[] {
  const g: Cell[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // sungai berkelok dan petak gambut di tenggara
      const river = Math.abs(y - (11 + Math.round(2 * Math.sin(x / 4)))) < 1 && x > 4;
      const peat = x > 15 && y > 3 && y < 10;
      g.push(river ? 2 : peat ? 1 : 0);
    }
  return g;
}

const COLOR: Record<Cell, string> = {
  0: '#1f6038',
  1: '#7a5a2e',
  2: '#2f7fb0',
  3: '#ffb020',
  4: '#4a3b36',
  5: '#4ade80',
};

export default function FireToy() {
  const t = useT();
  const [grid, setGrid] = useState<Cell[]>(() => {
    const g = initial();
    g[8 * W + 5] = 3;
    return g;
  });
  const [dir, setDir] = useState(2); // angin bertiup ke timur
  const [wind, setWind] = useState(6);
  const [dry, setDry] = useState(0.7);
  const [mode, setMode] = useState<'fire' | 'break'>('fire');
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const painting = useRef(false);
  const seed = useRef(1);

  const rand = () => {
    // LCG sederhana agar hasil bisa diulang
    seed.current = (seed.current * 1664525 + 1013904223) % 4294967296;
    return seed.current / 4294967296;
  };

  const tick = useCallback(() => {
    setGrid((g) => {
      const d = DIRS[dir];
      const next = [...g];
      let burning = 0;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (g[i] !== 3) continue;
          burning++;
          // gambut membara lebih lama
          next[i] = rand() < 0.35 ? 4 : 3;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              const j = ny * W + nx;
              if (g[j] !== 0 && g[j] !== 1) continue;
              const align = (dx * d.dx + dy * d.dy) / (Math.hypot(dx, dy) * Math.hypot(d.dx, d.dy));
              const windF = Math.exp((wind / 8) * align * 1.6);
              const fuel = g[j] === 1 ? 1.5 : 1;
              const p = Math.min(0.95, 0.09 * dry * 1.6 * windF * fuel * (dx && dy ? 0.7 : 1));
              if (rand() < p) next[j] = 3;
            }
        }
      if (burning === 0) setPlaying(false);
      return next;
    });
    setStep((s) => s + 1);
  }, [dir, wind, dry]);

  // 48 langkah x 15 menit = 12 jam, lalu berhenti
  const active = playing && step < 48;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(tick, 180);
    return () => window.clearInterval(id);
  }, [active, tick]);

  const paint = (i: number) => {
    setGrid((g) => {
      if (g[i] === 2) return g;
      const n = [...g];
      n[i] = mode === 'fire' ? 3 : 5;
      return n;
    });
  };

  const reset = () => {
    setPlaying(false);
    setStep(0);
    seed.current = 1;
    const g = initial();
    g[8 * W + 5] = 3;
    setGrid(g);
  };

  const burnt = grid.filter((c) => c === 3 || c === 4).length;
  const hours = (step * 15) / 60;
  const d = DIRS[dir];

  return (
    <div className="glass overflow-hidden rounded-[24px]">
      <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative bg-black/30 p-3 sm:p-4">
          <div
            className="grid touch-none select-none gap-px overflow-hidden rounded-[12px]"
            style={{ gridTemplateColumns: `repeat(${W}, minmax(0, 1fr))` }}
            onPointerLeave={() => (painting.current = false)}
            onPointerUp={() => (painting.current = false)}
            role="grid"
            aria-label={t('Simulation area. Click to place fire or firebreak.', 'Area simulasi. Klik untuk menaruh api atau sekat.')}
          >
            {grid.map((c, i) => (
              <span
                key={i}
                onPointerDown={() => {
                  painting.current = true;
                  paint(i);
                }}
                onPointerEnter={() => painting.current && paint(i)}
                className={`aspect-square cursor-crosshair ${c === 3 ? 'animate-pulse' : ''}`}
                style={{ background: COLOR[c] }}
              />
            ))}
          </div>
          {/* panah angin */}
          <span
            className="pointer-events-none absolute right-6 top-6 grid size-12 place-items-center rounded-full bg-black/55 text-[#7cc7ee]"
            aria-hidden="true"
            style={{ transform: `rotate(${(Math.atan2(d.dy, d.dx) * 180) / Math.PI + 90}deg)` }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path d="M12 3 L18 13 H14 V21 H10 V13 H6Z" fill="currentColor" />
            </svg>
          </span>
          <div className="num mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
            <span>
              {t('Time', 'Waktu')}: <b className="text-ink">+{hours.toFixed(2).replace(/\.?0+$/, '')} {t('h', 'jam')}</b> / 12
            </span>
            <span>
              {t('Burnt', 'Terbakar')}: <b className="text-ink">{(burnt * 0.0625).toLocaleString(undefined, { maximumFractionDigits: 1 })} km²</b>
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 text-xs font-semibold text-ink-2" aria-label={t('Example timeline', 'Garis waktu contoh')}>
            <span className="text-left"><b className="block text-base text-ink">0 h</b>{t('Ignition', 'Mulai')}</span>
            <span className="text-center"><b className="block text-base text-ink">6 h</b>{t('Spreading', 'Merambat')}</span>
            <span className="text-right"><b className="block text-base text-ink">12 h</b>{t('Finished', 'Selesai')}</span>
          </div>
          <div className="relative mt-1 h-2 rounded-full bg-white/10">
            <span className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#ffd24a,#ff7a32,#ef4444)]" style={{ width: `${Math.min(100, (step / 48) * 100)}%` }} />
            {[0, 50, 100].map((p) => <span key={p} className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink bg-white" style={{ left: `${p}%` }} />)}
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setPlaying((p) => !p)} disabled={step >= 48}>
              {active ? <IconPause size={16} /> : <IconPlay size={16} />} {active ? t('Pause', 'Jeda') : t('Play 12 hours', 'Putar 12 jam')}
            </Button>
            <Button variant="secondary" onClick={reset}>
              <IconUndo size={16} /> {t('Reset', 'Ulang')}
            </Button>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-ink">{t('When you click the map', 'Saat Anda klik peta')}</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  ['fire', t('Start a fire', 'Nyalakan api'), '#ffb020'],
                  ['break', t('Draw a firebreak', 'Gambar sekat'), '#4ade80'],
                ] as const
              ).map(([k, label, c]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={mode === k}
                  onClick={() => setMode(k)}
                  className={`flex items-center gap-2 rounded-[12px] border px-3 py-2 text-sm font-semibold ${mode === k ? 'border-sun bg-sun/10 text-ink' : 'border-line text-ink-2 hover:bg-white/5'}`}
                >
                  <span className="size-3 rounded-[3px]" style={{ background: c }} /> {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <p className="text-sm font-semibold text-ink">
              {t('Wind blows towards', 'Angin bertiup ke')}: <span className="text-wind">{t(d.en, d.id)}</span>
            </p>
            <div className="mt-2 grid grid-cols-8 gap-1">
              {DIRS.map((x, k) => (
                <button
                  key={x.key}
                  type="button"
                  aria-pressed={dir === k}
                  aria-label={t(x.en, x.id)}
                  onClick={() => setDir(k)}
                  className={`num rounded-[8px] py-1.5 text-[11px] font-bold ${dir === k ? 'bg-[#7cc7ee] text-[#06202c]' : 'bg-white/10 text-ink-2 hover:bg-white/15'}`}
                >
                  {t(x.key, x.ab)}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="flex justify-between text-sm font-semibold text-ink">
              {t('Wind speed', 'Kecepatan angin')} <span className="num text-ink-2">{wind} m/s</span>
            </span>
            <input type="range" min={0} max={16} value={wind} onChange={(e) => setWind(Number(e.target.value))} className="mt-2 w-full accent-[#7cc7ee]" />
          </label>
          <label className="block">
            <span className="flex justify-between text-sm font-semibold text-ink">
              {t('Dryness', 'Kekeringan')} <span className="num text-ink-2">{Math.round(dry * 100)}%</span>
            </span>
            <input type="range" min={0.2} max={1} step={0.05} value={dry} onChange={(e) => setDry(Number(e.target.value))} className="mt-2 w-full accent-[#ffd24a]" />
          </label>

          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-ink-2">
            {(
              [
                [0, t('Forest', 'Hutan')],
                [1, t('Peat (burns longer)', 'Gambut (lebih lama)')],
                [2, t('River (stops fire)', 'Sungai (menahan api)')],
                [3, t('Burning', 'Menyala')],
                [4, t('Burnt', 'Bekas terbakar')],
                [5, t('Firebreak', 'Sekat bakar')],
              ] as const
            ).map(([c, label]) => (
              <li key={c} className="flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-[3px]" style={{ background: COLOR[c] }} /> {label}
              </li>
            ))}
          </ul>
          <p className="text-xs leading-5 text-ink-3">
            {t(
              'Try it: draw a green firebreak in front of the fire, downwind, then press play. The real simulator does this on a 16 x 16 km area, 12 times over, and tests 225 firebreak lines.',
              'Coba: gambar sekat hijau di depan api searah angin, lalu tekan putar. Simulator sebenarnya melakukan ini di area 16 x 16 km, diulang 12 kali, dan menguji 225 garis sekat.',
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
