'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import type { RiskLevel } from '@/lib/sim/types';

/* ---------- Button ----------
 * primary  : kontras tertinggi (aksi utama satu per layar)
 * secondary: permukaan netral dengan garis
 * ghost    : teks saja
 * Hover mengganti warna latar (bukan memudar); tekan menggeser 1 px; fokus memakai cincin angin.
 */
type Variant = 'primary' | 'secondary' | 'ghost';
type Tone = 'light' | 'dark';
type Size = 'sm' | 'md' | 'lg';

const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-[15px] gap-2',
  lg: 'h-13 px-7 text-base gap-2',
};

const STYLE: Record<Tone, Record<Variant, string>> = {
  light: {
    primary: 'bg-forest-950 text-white hover:bg-forest-800 active:bg-forest-900',
    secondary: 'bg-card text-ink border border-line-strong hover:bg-sunken active:bg-line',
    ghost: 'text-ink-2 hover:bg-sunken hover:text-ink active:bg-line',
  },
  dark: {
    primary: 'bg-text-primary text-bg-base hover:bg-white active:bg-[#cdd6e0]',
    secondary: 'bg-bg-elevated text-text-primary border border-line-dark hover:bg-bg-hover active:bg-[#2c3a4d]',
    ghost: 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary active:bg-bg-hover',
  },
};

export function buttonClass(variant: Variant = 'primary', tone: Tone = 'light', size: Size = 'md', extra = '') {
  return `inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold transition-[background-color,color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 ${SIZE[size]} ${STYLE[tone][variant]} ${extra}`;
}

export function Button({
  variant = 'primary',
  tone = 'light',
  size = 'md',
  loading = false,
  className = '',
  children,
  ...rest
}: ComponentProps<'button'> & { variant?: Variant; tone?: Tone; size?: Size; loading?: boolean }) {
  return (
    <button {...rest} aria-busy={loading || undefined} className={buttonClass(variant, tone, size, className)}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  tone = 'light',
  size = 'md',
  className = '',
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; tone?: Tone; size?: Size }) {
  return <Link {...rest} className={buttonClass(variant, tone, size, className)} />;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" fill="none" />
      <path d="M17 10a7 7 0 00-7-7" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Segmented control (pilihan saling meniadakan, lebar segmen sama) ---------- */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  tone = 'dark',
  size = 'md',
  className = '',
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  tone?: Tone;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const wrap = tone === 'dark' ? 'bg-bg-base border border-line-dark' : 'bg-sunken';
  const idle =
    tone === 'dark' ? 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated' : 'text-ink-2 hover:text-ink hover:bg-card/60';
  const active = tone === 'dark' ? 'bg-bg-hover text-text-primary' : 'bg-card text-ink shadow-[0_1px_2px_rgba(17,26,21,0.12)]';
  const h = size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm';
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`grid rounded-[12px] p-1 ${wrap} ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`truncate rounded-[8px] px-2 font-semibold transition-colors ${h} ${on ? active : idle}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Switch (hanya untuk on/off) ---------- */
export function Switch({
  checked,
  onChange,
  label,
  tone = 'dark',
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  tone?: Tone;
  hint?: ReactNode;
}) {
  const track = checked ? (tone === 'dark' ? 'bg-wind' : 'bg-forest-800') : tone === 'dark' ? 'bg-line-dark' : 'bg-line-strong';
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5">
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className={`block text-xs ${tone === 'dark' ? 'text-text-muted' : 'text-ink-3'}`}>{hint}</span>}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${track}`}
      >
        <span
          className={`absolute left-0 top-1 size-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`}
        />
      </button>
    </label>
  );
}

/* ---------- Status level risiko: titik + teks, tanpa border berwarna ---------- */
export const LEVEL_TEXT: Record<RiskLevel, string> = { aman: 'Aman', waspada: 'Waspada', siaga: 'Siaga', awas: 'Awas' };
export const LEVEL_DOT: Record<RiskLevel, string> = {
  aman: 'var(--color-ok)',
  waspada: 'var(--color-warn)',
  siaga: 'var(--color-alert)',
  awas: 'var(--color-danger)',
};
const LEVEL_INK: Record<RiskLevel, string> = {
  aman: 'var(--color-ok-ink)',
  waspada: 'var(--color-warn-ink)',
  siaga: 'var(--color-alert-ink)',
  awas: 'var(--color-danger-ink)',
};

export function StatusBadge({ level, tone = 'dark' }: { level: RiskLevel; tone?: Tone }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
        tone === 'dark' ? 'bg-bg-base text-text-primary' : 'bg-sunken'
      }`}
      style={tone === 'light' ? { color: LEVEL_INK[level] } : undefined}
    >
      <span className="size-2 rounded-full" style={{ background: LEVEL_DOT[level] }} aria-hidden="true" />
      {LEVEL_TEXT[level]}
    </span>
  );
}

/* ---------- Angka dengan kilatan saat berubah (umpan balik yang berguna) ---------- */
export function LiveNumber({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span key={value} className={`num inline-block rounded-[4px] animate-flash ${className}`}>
      {value}
    </span>
  );
}
