'use client';

import { useEffect } from 'react';
import { IconPause, IconPlay } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/primitives';
import { stepToClock } from '@/lib/format';
import { STEPS_12H } from '@/lib/sim/params';
import { useSim } from '@/stores/simStore';
import { t } from '@/lib/i18n';

/** Bilah waktu 0-12 jam seperti pemutar video: putar/jeda, geser, kecepatan. Spasi = putar/jeda. */
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
        aria-label={playing ? t('Pause', 'Jeda') : t('Play the fire spread', 'Putar perkembangan api')}
        className="grid size-11 shrink-0 place-items-center rounded-full grad-sun transition-colors hover:brightness-105 active:translate-y-px disabled:opacity-45"
      >
        {playing ? <IconPause /> : <IconPlay />}
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          className="range w-full"
          min={0}
          max={STEPS_12H}
          step={1}
          value={timeStep}
          disabled={disabled}
          aria-label={t('Time from now', 'Waktu sejak sekarang')}
          aria-valuetext={t(`${stepToClock(timeStep)} hours from now`, `${stepToClock(timeStep)} jam dari sekarang`)}
          onChange={(e) => set({ timeStep: Number(e.target.value), playing: false })}
          onKeyDown={(e) => {
            if (e.key === ' ') {
              e.preventDefault();
              toggle();
            }
          }}
          style={{
            ['--track' as string]: `linear-gradient(90deg,#9be15d 0%,#ffd24a ${(timeStep / STEPS_12H) * 100}%,rgba(255,255,255,0.2) ${(timeStep / STEPS_12H) * 100}%)`,
            ['--thumb' as string]: '#ffd24a',
          }}
        />
        <div className="num hidden justify-between text-[11px] text-text-muted sm:flex" aria-hidden="true">
          {[0, 3, 6, 9, 12].map((h) => (
            <span key={h}>{h === 0 ? t('Now', 'Sekarang') : t(`+${h} h`, `+${h} jam`)}</span>
          ))}
        </div>
      </div>
      <output className="num w-[68px] shrink-0 text-right text-lg font-semibold">{stepToClock(timeStep)}</output>
      <Segmented
        label={t('Playback speed', 'Kecepatan putar')}
        size="sm"
        value={speed}
        onChange={(v) => set({ speed: v })}
        options={[
          { value: 1 as const, label: '1x' },
          { value: 2 as const, label: '2x' },
          { value: 4 as const, label: '4x' },
        ]}
        className="hidden w-[132px] shrink-0 sm:grid"
      />
    </div>
  );
}
