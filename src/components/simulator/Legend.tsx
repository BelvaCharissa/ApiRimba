'use client';

import { useState } from 'react';
import { IconChevron } from '@/components/ui/icons';

/** Legenda ringkas di pojok peta; bisa dilipat. Setiap simbol punya bentuk dan label, bukan warna saja. */
export default function Legend() {
  const [open, setOpen] = useState(true);
  return (
    <section className="w-[244px] rounded-[12px] border border-line-dark bg-bg-surface p-3 text-sm shadow-float">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between font-semibold">
        Legenda
        <IconChevron size={16} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-text-secondary">
          <div>
            <p className="mb-1 text-xs">Peluang terbakar dalam 12 jam</p>
            <div className="h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#ffd24a,#ff9f1c,#ff4d2e,#b3001b)' }} />
            <div className="num mt-0.5 flex justify-between text-[11px]">
              <span>10%</span>
              <span>50%</span>
              <span>90%</span>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-[3px] bg-fire-core" /> Menyala
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-[3px]" style={{ background: '#ff8c28' }} /> Membara
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-[3px]" style={{ background: '#4a1e1e' }} /> Terbakar
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-fire-low" /> Titik panas
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-4 rounded-full bg-firebreak" /> Sekat bakar
            </li>
            <li className="flex items-center gap-2">
              <span
                className="size-3 rounded-[3px]"
                style={{ background: 'repeating-linear-gradient(45deg,#c4874a 0 1.5px,transparent 1.5px 4px)' }}
              />
              Gambut
            </li>
          </ul>
          <p className="text-[11px] leading-4 text-text-muted">Tutupan lahan, gambut, dan desa adalah ilustrasi.</p>
        </div>
      )}
    </section>
  );
}
