'use client';

import { useState } from 'react';
import { IconChevron, IconFlame } from '@/components/ui/icons';
import { BREAK_COLORS } from '@/lib/geo';
import { FIRE_COLORS, LAND_DARK_HEX } from '@/lib/render';

function Row({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="grid w-5 shrink-0 place-items-center">{swatch}</span>
      <span>{children}</span>
    </li>
  );
}

/** Legenda: dikelompokkan per arti (status api sekarang / peluang ke depan / simbol peta). */
export default function Legend() {
  // Terbuka otomatis hanya di layar tinggi; di layar biasa dilipat agar tidak menutupi peta dan popup.
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.innerHeight >= 1000);
  return (
    <section className="w-[260px] rounded-[12px] border border-line-dark bg-bg-surface p-3 text-sm shadow-float">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between font-semibold">
        {open ? 'Legenda' : 'Legenda: arti warna & simbol'}
        <IconChevron size={16} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="mt-3 max-h-[46vh] space-y-3 overflow-y-auto text-xs text-text-secondary">
          <div>
            <p className="mb-1.5 font-semibold text-text-primary">Api pada jam yang dipilih</p>
            <ul className="space-y-1.5">
              <Row swatch={<span className="size-3.5 rounded-[3px]" style={{ background: FIRE_COLORS.flame }} />}>
                <b className="text-text-primary">Menyala</b>: api aktif di permukaan
              </Row>
              <Row swatch={<span className="size-3.5 rounded-[3px]" style={{ background: FIRE_COLORS.smolder }} />}>
                <b className="text-text-primary">Membara</b>: gambut terbakar lambat
              </Row>
              <Row swatch={<span className="size-3.5 rounded-[3px] border border-white/30" style={{ background: FIRE_COLORS.burned }} />}>
                <b className="text-text-primary">Bekas terbakar</b>: api sudah padam
              </Row>
            </ul>
          </div>
          <div>
            <p className="mb-1 font-semibold text-text-primary">Peluang terbakar dalam 12 jam</p>
            <div
              className="h-2 rounded-full"
              style={{
                background: `linear-gradient(90deg,${FIRE_COLORS.probLow},${FIRE_COLORS.probMid},${FIRE_COLORS.probHigh},${FIRE_COLORS.probVHigh})`,
              }}
            />
            <div className="num mt-0.5 flex justify-between text-[11px]">
              <span>Kecil 10%</span>
              <span>Hampir pasti 90%</span>
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-semibold text-text-primary">Simbol</p>
            <ul className="space-y-1.5">
              <Row
                swatch={
                  <span className="grid size-4 place-items-center rounded-full border-2 border-[#ffd43b] text-[#ffd43b]">
                    <IconFlame size={9} />
                  </span>
                }
              >
                Titik awal api
              </Row>
              <Row
                swatch={
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="#eef2f7" />
                  </svg>
                }
              >
                Desa (merah bila api sudah tiba)
              </Row>
              <Row swatch={<span className="size-2.5 rounded-full bg-[#ff8a3d]" />}>Titik panas satelit</Row>
              <Row
                swatch={
                  <span className="flex flex-col gap-0.5">
                    {BREAK_COLORS.map((c) => (
                      <span key={c} className="h-[3px] w-4 rounded-full" style={{ background: c }} />
                    ))}
                  </span>
                }
              >
                Sekat bakar A, B, C
              </Row>
              <Row
                swatch={
                  <span
                    className="size-3.5 rounded-[3px] border border-dashed border-[#e8aa64]"
                    style={{ background: 'repeating-linear-gradient(45deg,#e8aa64 0 1.5px,transparent 1.5px 4px)' }}
                  />
                }
              >
                Zona gambut
              </Row>
              <Row swatch={<span className="h-0 w-4 border-t-2 border-dashed border-white/70" />}>Batas area simulasi</Row>
            </ul>
          </div>
          <div>
            <p className="mb-1.5 font-semibold text-text-primary">Tutupan lahan</p>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
              {LAND_DARK_HEX.map((l) => (
                <li key={l.cls} className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[3px]" style={{ background: l.color }} />
                  {l.label}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] leading-4 text-text-muted">Tutupan lahan, gambut, dan desa adalah ilustrasi.</p>
        </div>
      )}
    </section>
  );
}
