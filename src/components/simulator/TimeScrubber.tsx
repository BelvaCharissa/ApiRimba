'use client';

import { Pause, Play } from 'lucide-react';
import { useEffect } from 'react';
import { stepToClock } from '@/lib/format';
import { STEPS_12H } from '@/lib/sim/params';
import { useSim } from '@/stores/simStore';

/** Bilah waktu 0-12 jam: geser, putar/jeda, kecepatan 1x/2x/4x. */
export default function TimeScrubber({ disabled }: { disabled: boolean }) {
  const timeStep = useSim((s) => s.timeStep);
  const playing = useSim((s) => s.playing);
  const speed = useSim((s) => s.speed);
  const set = useSim((s) => s.set);

  useEffect(() => {
    if (!playing || disabled) return;
    const id = setInterval(() => {
      const t = useSim.getState().timeStep;
      if (t >= STEPS_12H) {
        useSim.getState().set({ playing: false });
        return;
      }
      useSim.getState().set({ timeStep: Math.min(STEPS_12H, t + 1) });
    }, 250 / speed);
    return () => clearInterval(id);
  }, [playing, speed, disabled]);

  const toggle = () => {
    if (!playing && timeStep >= STEPS_12H) set({ timeStep: 0, playing: true });
    else set({ playing: !playing });
  };

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <button
        onClick={toggle}
        disabled={disabled}
        aria-label={playing ? 'Jeda animasi' : 'Putar animasi'}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-text-primary text-bg-base transition hover:bg-white disabled:opacity-40"
      >
        {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>
      <div className="relative min-w-0 flex-1">
        <input
          type="range"
          className="range w-full"
          min={0}
          max={STEPS_12H}
          step={1}
          value={timeStep}
          disabled={disabled}
          aria-label="Waktu simulasi"
          aria-valuetext={`${stepToClock(timeStep)} jam dari sekarang`}
          onChange={(e) => set({ timeStep: Number(e.target.value), playing: false })}
          onKeyDown={(e) => {
            if (e.key === ' ') {
              e.preventDefault();
              toggle();
            }
          }}
          style={{
            ['--track' as string]: `linear-gradient(90deg,#ff6a3d ${(timeStep / STEPS_12H) * 100}%,#263041 0)`,
            ['--thumb' as string]: '#ff6a3d',
          }}
        />
        <div className="mt-0.5 hidden justify-between font-mono text-[10px] text-text-muted sm:flex" aria-hidden="true">
          {Array.from({ length: 13 }, (_, h) => (
            <span key={h}>+{String(h).padStart(2, '0')}</span>
          ))}
        </div>
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-base font-medium tabular text-text-primary">
        {stepToClock(timeStep)}
      </span>
      <div className="flex shrink-0 overflow-hidden rounded-full border border-border-dark" role="group" aria-label="Kecepatan putar">
        {([1, 2, 4] as const).map((v) => (
          <button
            key={v}
            onClick={() => set({ speed: v })}
            aria-pressed={speed === v}
            className={`px-2.5 py-1 font-mono text-xs transition ${
              speed === v ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {v}x
          </button>
        ))}
      </div>
    </div>
  );
}
