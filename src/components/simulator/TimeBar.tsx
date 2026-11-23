'use client';

import { IconPause, IconPlay } from '@/components/ui/icons';
import { Segmented } from '@/components/ui/primitives';
import { stepToClock } from '@/lib/format';
import { t } from '@/lib/i18n';
import { STEPS_12H } from '@/lib/sim/params';

export type Speed = 1 | 2 | 4;

interface Props {
  step: number;
  playing: boolean;
  speed: Speed;
  disabled?: boolean;
  onToggle: () => void;
  onSeek: (step: number) => void;
  onSpeed: (s: Speed) => void;
}

/**
 * Tampilan bilah waktu 0-12 jam (putar/jeda, geser, kecepatan). Dipakai simulator dan hero beranda
 * agar keduanya terlihat dan terasa sama. Spasi = putar/jeda.
 */
export default function TimeBar({ step, playing, speed, disabled = false, onToggle, onSeek, onSpeed }: Props) {
  const pct = (step / STEPS_12H) * 100;
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-label={playing ? t('Pause', 'Jeda') : t('Play the fire spread', 'Putar perkembangan api')}
        className="grid size-11 shrink-0 place-items-center rounded-full grad-sun text-[#1a1300] transition-colors hover:brightness-105 active:translate-y-px disabled:opacity-45"
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
          value={step}
          disabled={disabled}
          aria-label={t('Time from now', 'Waktu sejak sekarang')}
          aria-valuetext={t(`${stepToClock(step)} hours from now`, `${stepToClock(step)} jam dari sekarang`)}
          onChange={(e) => onSeek(Number(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === ' ') {
              e.preventDefault();
              onToggle();
            }
          }}
          style={{
            ['--track' as string]: `linear-gradient(90deg,#9be15d 0%,#ffd24a ${pct}%,rgba(255,255,255,0.2) ${pct}%)`,
            ['--thumb' as string]: '#ffd24a',
          }}
        />
        <div className="num hidden justify-between text-[11px] text-text-muted sm:flex" aria-hidden="true">
          {[0, 3, 6, 9, 12].map((h) => (
            <span key={h}>{h === 0 ? t('Now', 'Sekarang') : t(`+${h} h`, `+${h} jam`)}</span>
          ))}
        </div>
      </div>
      <output className="num w-[68px] shrink-0 text-right text-lg font-semibold">{stepToClock(step)}</output>
      <Segmented
        label={t('Playback speed', 'Kecepatan putar')}
        size="sm"
        value={speed}
        onChange={onSpeed}
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
