'use client';

import { useRef } from 'react';
import { compass, nf } from '@/lib/format';

interface Props {
  windMs: number;
  windFromDeg: number;
  source: 'cuaca' | 'preset' | 'manual';
  onChange: (p: { windMs?: number; windFromDeg?: number }) => void;
}

/** Slider kecepatan angin (0-20 m/s) dan kompas arah. Jarum menunjuk arah TUJUAN angin. */
export default function WindControl({ windMs, windFromDeg, source, onChange }: Props) {
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

  const r2 = (v: number) => Math.round(v * 100) / 100;
  const rad = (toDeg * Math.PI) / 180;
  const nx = r2(60 + Math.sin(rad) * 40);
  const ny = r2(60 - Math.cos(rad) * 40);
  const tx = r2(60 - Math.sin(rad) * 26);
  const ty = r2(60 + Math.cos(rad) * 26);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor="wind-speed" className="text-sm text-text-secondary">
          Kecepatan angin
        </label>
        <span className="font-mono text-lg font-medium tabular">
          {nf(windMs)} <span className="text-sm text-text-secondary">m/s</span>
        </span>
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
        style={{ ['--track' as string]: `linear-gradient(90deg,#4fc3f7 ${(windMs / 20) * 100}%,#263041 0)` }}
        aria-valuetext={`${nf(windMs)} meter per detik`}
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-text-muted" aria-hidden="true">
        {[0, 5, 10, 15, 20].map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <svg
          ref={dialRef}
          width={120}
          height={120}
          viewBox="0 0 120 120"
          role="slider"
          tabIndex={0}
          aria-label="Arah angin"
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
          className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
        >
          <circle cx="60" cy="60" r="54" fill="#0b0f14" stroke="#263041" strokeWidth="1.5" />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i * 15 * Math.PI) / 180;
            const long = i % 6 === 0;
            return (
              <line
                key={i}
                x1={r2(60 + Math.sin(a) * (long ? 44 : 48))}
                y1={r2(60 - Math.cos(a) * (long ? 44 : 48))}
                x2={r2(60 + Math.sin(a) * 52)}
                y2={r2(60 - Math.cos(a) * 52)}
                stroke={long ? '#6b7889' : '#263041'}
                strokeWidth={long ? 1.6 : 1}
              />
            );
          })}
          {[
            ['U', 60, 22],
            ['T', 98, 64],
            ['S', 60, 104],
            ['B', 22, 64],
          ].map(([l, x, y]) => (
            <text key={l} x={x} y={y} textAnchor="middle" fontSize="10" fill="#9aa7b8" fontFamily="var(--font-mono)">
              {l}
            </text>
          ))}
          <line x1={tx} y1={ty} x2={nx} y2={ny} stroke="#4fc3f7" strokeWidth="3" strokeLinecap="round" />
          <polygon
            points="0,-9 6,5 -6,5"
            fill="#4fc3f7"
            transform={`translate(${nx} ${ny}) rotate(${toDeg})`}
          />
          <circle cx="60" cy="60" r="4" fill="#e8edf4" />
        </svg>
        <div className="min-w-0 text-sm">
          <p className="text-text-secondary">Angin dari</p>
          <p className="font-mono text-lg font-medium tabular">{Math.round(windFromDeg)}°</p>
          <p className="capitalize text-text-primary">{compass(windFromDeg)}</p>
          <p className="mt-1 text-xs text-text-muted">
            Api terdorong ke {compass(toDeg)}.{' '}
            {source === 'cuaca' ? 'Diisi dari cuaca terkini.' : source === 'preset' ? 'Angin preset skenario.' : 'Diubah manual.'}
          </p>
        </div>
      </div>
    </div>
  );
}
