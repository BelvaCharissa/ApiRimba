'use client';

import { useEffect } from 'react';
import { STEPS_12H } from '@/lib/sim/params';
import { useSim } from '@/stores/simStore';
import TimeBar from './TimeBar';

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
    <TimeBar
      step={timeStep}
      playing={playing}
      speed={speed}
      disabled={disabled}
      onToggle={toggle}
      onSeek={(v) => set({ timeStep: v, playing: false })}
      onSpeed={(v) => set({ speed: v })}
    />
  );
}
