'use client';

import { useRef } from 'react';
import { compass, nf } from '@/lib/format';

interface Props {
  windMs: number;
  windFromDeg: number;
  onChange: (p: { windMs?: number; windFromDeg?: number }) => void;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Kecepatan angin (0-20 m/s) dan kompas arah. Jarum menunjuk arah TUJUAN angin (ke mana api didorong). */
export default function WindControl({ windMs, windFromDeg, onChange }: Props) {
  const dialRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const toDeg = (windFromDeg + 180) % 360;

  const setFromPointer = (e: React.PointerEvent) => {
    const svg = dialRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const to = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    onChange({ windFromDeg: Math.round((to + 180) % 360) });
  };

  const onDialKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 15 : 5;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange({ windFromDeg: (windFromDeg + step) % 360 });
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange({ windFromDeg: (windFromDeg - step + 360) % 360 });
    else return;
    e.preventDefault();
  };

  const rad = (toDeg * Math.PI) / 180;
  const nx = r2(48 + Math.sin(rad) * 31);
  const ny = r2(48 - Math.cos(rad) * 31);
  const tx = r2(48 - Math.sin(rad) * 20);
  const ty = r2(48 + Math.cos(rad) * 20);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <label htmlFor="wind-speed" className="text-sm font-medium text-text-secondary">
            Kecepatan angin
          </label>
          <output htmlFor="wind-speed" className="num text-base font-semibold">
            {nf(windMs)} m/s
          </output>
        </div>
        <input
          id="wind-speed"
          type="range"
          className="range w-full"
          min={0}
          max={20}
          step={0.5}
          value={windMs}
          onChange={(e) => onChange({ windMs: Number(e.target.value) })}
          onKeyDown={(e) => {
            if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
              e.preventDefault();
              onChange({ windMs: Math.max(0, Math.min(20, windMs + (e.key === 'ArrowRight' ? 5 : -5))) });
            }
          }}
          style={{ ['--track' as string]: `linear-gradient(90deg,#4fc3f7 ${(windMs / 20) * 100}%,#2b3645 0)` }}
          aria-valuetext={`${nf(windMs)} meter per detik`}
        />
        <div className="num flex justify-between text-[11px] text-text-muted" aria-hidden="true">
          <span>0</span>
          <span>10</span>
          <span>20</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <svg
          ref={dialRef}
          width={96}
          height={96}
          viewBox="0 0 96 96"
          role="slider"
          tabIndex={0}
          aria-label="Arah angin, seret atau gunakan tombol panah"
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={Math.round(windFromDeg)}
          aria-valuetext={`Angin dari ${Math.round(windFromDeg)} derajat (${compass(windFromDeg)})`}
          onKeyDown={onDialKey}
          onPointerDown={(e) => {
            dragging.current = true;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setFromPointer(e);
          }}
          onPointerMove={(e) => dragging.current && setFromPointer(e)}
          onPointerUp={() => (dragging.current = false)}
          className="shrink-0 cursor-grab touch-none select-none rounded-full active:cursor-grabbing"
        >
          <circle cx="48" cy="48" r="44" fill="#0a0e13" stroke="#2b3645" strokeWidth="1.5" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            const long = i % 3 === 0;
            return (
              <line
                key={i}
                x1={r2(48 + Math.sin(a) * (long ? 36 : 39))}
                y1={r2(48 - Math.cos(a) * (long ? 36 : 39))}
                x2={r2(48 + Math.sin(a) * 42)}
                y2={r2(48 - Math.cos(a) * 42)}
                stroke={long ? '#94a1b2' : '#2b3645'}
                strokeWidth={1.5}
              />
            );
          })}
          <text x="48" y="22" textAnchor="middle" fontSize="10" fontWeight="700" fill="#b6c1ce">
            U
          </text>
          <line x1={tx} y1={ty} x2={nx} y2={ny} stroke="#4fc3f7" strokeWidth="3" strokeLinecap="round" />
          <polygon points="0,-8 5.5,4.5 -5.5,4.5" fill="#4fc3f7" transform={`translate(${nx} ${ny}) rotate(${toDeg})`} />
          <circle cx="48" cy="48" r="3.5" fill="#eef2f7" />
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-secondary">Arah angin</p>
          <p className="text-lg font-semibold capitalize leading-tight">Dari {compass(windFromDeg)}</p>
          <p className="num text-sm text-text-secondary">{Math.round(windFromDeg)}°, api terdorong ke {compass(toDeg)}</p>
        </div>
      </div>
      <p className="rounded-[8px] bg-bg-base px-3 py-2 text-xs leading-5 text-text-secondary">
        Arah angin bisa diubah: <b className="text-text-primary">seret jarum biru</b> di kompas, atau klik lalu pakai tombol panah.
      </p>
    </div>
  );
}
