'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export default function Legend() {
  const [open, setOpen] = useState(true);
  return (
    <section>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="mb-3 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary"
      >
        Legenda
        <ChevronDown size={14} className={`transition ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="space-y-3 text-xs text-text-secondary">
          <div>
            <p className="mb-1">Peluang terbakar 12 jam</p>
            <div className="h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#ffd24a,#ff9f1c,#ff4d2e,#b3001b)' }} />
            <div className="mt-0.5 flex justify-between font-mono text-[10px]">
              <span>10%</span>
              <span>50%</span>
              <span>90%+</span>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-sm bg-fire-core" /> Api menyala
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ background: '#ff8c28' }} /> Gambut membara
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ background: '#4a1e1e' }} /> Sudah terbakar
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-fire-low ring-2 ring-fire-low/40" /> Titik panas
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-4 rounded bg-firebreak" /> Sekat bakar
            </li>
            <li className="flex items-center gap-2">
              <span
                className="size-3 rounded-sm border border-peat-dry"
                style={{ background: 'repeating-linear-gradient(45deg,#b8793e55 0 2px,transparent 2px 4px)' }}
              />
              Gambut
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-4 rounded" style={{ background: '#2b6e9a' }} /> Sungai
            </li>
            <li className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="#9aa7b8" />
              </svg>
              Desa (fiktif)
            </li>
          </ul>
          <p className="text-[11px] leading-4 text-text-muted">
            Tutupan lahan dan zona gambut adalah ilustrasi untuk demo.
          </p>
        </div>
      )}
    </section>
  );
}
