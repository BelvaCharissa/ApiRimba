'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';
import { IconArrowRight } from '@/components/ui/icons';

export interface ShowcaseStep {
  art: ReactNode;
  title: string;
  body: string;
  /** Rincian tambahan (opsional), tampil di bawah teks. */
  points?: string[];
  href?: string;
  cta?: string;
}

/**
 * Langkah interaktif: klik / ketuk satu langkah, gambar dan penjelasannya berganti.
 * Berganti otomatis tiap 6 detik sampai pengguna memilih sendiri.
 */
export default function StepShowcase({ steps, label }: { steps: ShowcaseStep[]; label: string }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % steps.length), 6000);
    return () => window.clearInterval(id);
  }, [auto, steps.length]);

  const pick = (k: number) => {
    setAuto(false);
    setI(k);
  };
  const s = steps[i];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-6">
      <div role="tablist" aria-label={label} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {steps.map((st, k) => {
          const on = k === i;
          return (
            <button
              key={st.title}
              role="tab"
              aria-selected={on}
              aria-controls="showcase-panel"
              onClick={() => pick(k)}
              className={`group relative flex items-start gap-3 overflow-hidden rounded-[18px] border p-4 text-left transition-colors ${
                on ? 'border-sun/60 bg-sun/10' : 'border-line bg-white/[0.03] hover:bg-white/[0.07]'
              }`}
            >
              <span className={`num grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${on ? 'grad-sun' : 'bg-white/10 text-ink-2'}`}>
                {k + 1}
              </span>
              <span className="min-w-0">
                <span className={`block font-semibold ${on ? 'text-ink' : 'text-ink-2 group-hover:text-ink'}`}>{st.title}</span>
                <span className="mt-0.5 line-clamp-1 block text-sm text-ink-3">{st.body}</span>
              </span>
              {on && auto && <span key={`bar-${i}`} className="showcase-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-sun" />}
            </button>
          );
        })}
      </div>
      <div id="showcase-panel" role="tabpanel" className="glass overflow-hidden rounded-[24px]">
        <div key={i} className="showcase-in">
          {s.art}
          <div className="p-5 sm:p-6">
            <p className="num text-xs font-semibold text-sun">
              {i + 1} / {steps.length}
            </p>
            <h3 className="mt-1 text-2xl font-bold leading-tight text-ink">{s.title}</h3>
            <p className="mt-2 text-[16px] leading-7 text-ink-2">{s.body}</p>
            {s.points && (
              <ul className="mt-3 space-y-1.5 text-sm leading-6 text-ink-2">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-leaf" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
            {s.href && s.cta && (
              <Link href={s.href} className="mt-4 inline-flex items-center gap-2 font-semibold text-sun underline-offset-4 hover:underline">
                {s.cta} <IconArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
