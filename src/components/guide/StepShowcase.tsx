'use client';

import Link from 'next/link';
import { type ReactNode, useState } from 'react';
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
export default function StepShowcase({ steps, label }: { steps: ShowcaseStep[]; label: string }) {
  const [i, setI] = useState(0);

  const pick = (k: number) => {
    setI(k);
  };
  const s = steps[i];

  return (
    <div className="mx-auto grid max-w-[1120px] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-6">
      <div role="tablist" aria-label={label} className="grid content-start gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {steps.map((st, k) => {
          const on = k === i;
          return (
            <button
              key={st.title}
              role="tab"
              aria-selected={on}
              aria-controls="showcase-panel"
              onClick={() => pick(k)}
              className={`group relative flex min-h-[82px] items-start gap-3 overflow-hidden rounded-[18px] border p-4 text-left transition-all ${
                on ? 'translate-x-0 border-sun/70 bg-sun/12 shadow-[0_12px_40px_rgba(5,18,12,.12)]' : 'border-line bg-white/[0.03] hover:translate-x-1 hover:bg-white/[0.07]'
              }`}
            >
              <span className={`num grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${on ? 'grad-sun' : 'bg-white/10 text-ink-2'}`}>
                {k + 1}
              </span>
              <span className="min-w-0">
                <span className={`block font-semibold ${on ? 'text-ink' : 'text-ink-2 group-hover:text-ink'}`}>{st.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-sm leading-5 text-ink-3">{st.body}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div id="showcase-panel" role="tabpanel" className="glass overflow-hidden rounded-[24px]">
        <div key={i} className="showcase-in">
          <figure className="relative overflow-hidden border-b border-line">
            {s.art}
            <figcaption className="absolute bottom-3 left-3 rounded-full bg-[#0b1d15]/85 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              {label}: {i + 1}
            </figcaption>
          </figure>
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
