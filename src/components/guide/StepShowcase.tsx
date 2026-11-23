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
 * Langkah interaktif: pengguna memilih langkah secara sengaja. Tidak ada pergantian
 * otomatis, sehingga judul, gambar, dan penjelasan selalu tetap sinkron.
 */
export default function StepShowcase({
  steps,
  label,
  autoMs,
}: {
  steps: ShowcaseStep[];
  label: string;
  autoMs?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!autoMs || typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      setI((v) => (v + 1) % steps.length);
    }, autoMs);
    return () => window.clearInterval(id);
  }, [autoMs, steps.length]);

  const pick = (k: number) => {
    setI(k);
  };
  const s = steps[i];

  return (
    <div className="mx-auto max-w-[1120px]">
      <div role="tablist" aria-label={label} className="grid grid-cols-2 gap-2 overflow-hidden sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((st, k) => {
          const on = k === i;
          return (
            <button
              key={st.title}
              role="tab"
              aria-selected={on}
              aria-controls="showcase-panel"
              onClick={() => pick(k)}
              className={`group relative flex min-h-[72px] items-center gap-2 overflow-hidden rounded-[14px] border px-3 py-3 text-left transition-all ${
                on ? 'border-sun/70 bg-sun/12 shadow-[0_12px_40px_rgba(5,18,12,.12)]' : 'border-line bg-white/[0.03] hover:bg-white/[0.07]'
              }`}
            >
              <span className={`num grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${on ? 'grad-sun' : 'bg-white/10 text-ink-2'}`}>
                {k + 1}
              </span>
              <span className="min-w-0">
                <span className={`block line-clamp-2 text-sm font-semibold leading-5 ${on ? 'text-ink' : 'text-ink-2 group-hover:text-ink'}`}>{st.title}</span>
              </span>
              {on && autoMs && (
                <span
                  key={`progress-${i}`}
                  className="showcase-progress absolute inset-x-0 bottom-0 h-0.5 origin-left bg-sun"
                  style={{ animationDuration: `${autoMs}ms` }}
                />
              )}
            </button>
          );
        })}
      </div>
      <div id="showcase-panel" role="tabpanel" className="glass mt-4 overflow-hidden rounded-[24px]">
        <div key={i} className="showcase-in">
          <div className="grid lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,.82fr)]">
            <figure className="relative min-h-[320px] overflow-hidden border-b border-line lg:min-h-[420px] lg:border-b-0 lg:border-r">
              {s.art}
              <figcaption className="absolute bottom-3 left-3 rounded-full bg-[#0b1d15]/85 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                {label}: {i + 1}
              </figcaption>
            </figure>
            <div className="flex flex-col justify-center p-5 sm:p-8">
              <p className="num text-xs font-semibold text-sun">
                {i + 1} / {steps.length}
              </p>
              <h3 className="mt-2 text-2xl font-bold leading-tight text-ink sm:text-3xl">{s.title}</h3>
              <p className="mt-3 text-[16px] leading-7 text-ink-2">{s.body}</p>
              {s.points && (
                <ul className="mt-4 space-y-2 text-sm leading-6 text-ink-2">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-leaf" />
                      {p}
                    </li>
                  ))}
                </ul>
              )}
              {s.href && s.cta && (
                <Link href={s.href} className="mt-5 inline-flex items-center gap-2 self-start font-semibold text-sun underline-offset-4 hover:underline">
                  {s.cta} <IconArrowRight size={16} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
