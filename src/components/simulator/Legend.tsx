'use client';

import { useState } from 'react';
import { IconChevron, IconFlame } from '@/components/ui/icons';
import { BREAK_COLORS } from '@/lib/geo';
import { FIRE_COLORS, LAND_SIM_HEX } from '@/lib/render';
import { t } from '@/lib/i18n';

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
    <section className="glass w-[260px] rounded-[16px] p-3 text-sm shadow-float">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between font-semibold">
        {open ? t('Legend', 'Legenda') : t('Legend: colours & symbols', 'Legenda: arti warna & simbol')}
        <IconChevron size={16} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="mt-3 max-h-[46vh] space-y-3 overflow-y-auto text-xs text-text-secondary">
          <div>
            <p className="mb-1.5 font-semibold text-text-primary">{t('Fire at the selected hour', 'Api pada jam yang dipilih')}</p>
            <ul className="space-y-1.5">
              <Row swatch={<span className="size-3.5 rounded-[3px]" style={{ background: FIRE_COLORS.flame }} />}>
                <b className="text-text-primary">{t('Flaming', 'Menyala')}</b>: {t('active surface fire', 'api aktif di permukaan')}
              </Row>
              <Row swatch={<span className="size-3.5 rounded-[3px]" style={{ background: FIRE_COLORS.smolder }} />}>
                <b className="text-text-primary">{t('Smouldering', 'Membara')}</b>: {t('peat burning slowly', 'gambut terbakar lambat')}
              </Row>
              <Row swatch={<span className="size-3.5 rounded-[3px] border border-ink/20" style={{ background: FIRE_COLORS.burned }} />}>
                <b className="text-text-primary">{t('Burnt', 'Bekas terbakar')}</b>: {t('fire is out', 'api sudah padam')}
              </Row>
            </ul>
          </div>
          <div>
            <p className="mb-1 font-semibold text-text-primary">{t('Chance of burning within 12 h', 'Peluang terbakar dalam 12 jam')}</p>
            <div
              className="h-2 rounded-full"
              style={{
                background: `linear-gradient(90deg,${FIRE_COLORS.probLow},${FIRE_COLORS.probMid},${FIRE_COLORS.probHigh},${FIRE_COLORS.probVHigh})`,
              }}
            />
            <div className="num mt-0.5 flex justify-between text-[11px]">
              <span>{t('Low 10%', 'Kecil 10%')}</span>
              <span>{t('Almost certain 90%', 'Hampir pasti 90%')}</span>
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-semibold text-text-primary">{t('Symbols', 'Simbol')}</p>
            <ul className="space-y-1.5">
              <Row
                swatch={
                  <span className="grid size-4 place-items-center rounded-full border-2 border-[#f08c00] text-[#f08c00]">
                    <IconFlame size={9} />
                  </span>
                }
              >
                {t('Ignition point', 'Titik awal api')}
              </Row>
              <Row
                swatch={
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="#ffffff" stroke="#111a15" strokeWidth="2" />
                  </svg>
                }
              >
                {t('Village (red once the fire arrives)', 'Desa (merah bila api sudah tiba)')}
              </Row>
              <Row swatch={<span className="size-2.5 rounded-full bg-[#ff6a1a]" />}>{t('Satellite hotspot', 'Titik panas satelit')}</Row>
              <Row
                swatch={
                  <span className="flex flex-col gap-0.5">
                    {BREAK_COLORS.map((c) => (
                      <span key={c} className="h-[3px] w-4 rounded-full" style={{ background: c }} />
                    ))}
                  </span>
                }
              >
                {t('Firebreaks A, B, C', 'Sekat bakar A, B, C')}
              </Row>
              <Row
                swatch={
                  <span
                    className="size-3.5 rounded-[3px] border border-dashed border-[#a8662a]"
                    style={{ background: 'repeating-linear-gradient(45deg,#a8662a 0 1.5px,transparent 1.5px 4px)' }}
                  />
                }
              >
                {t('Peat zone', 'Zona gambut')}
              </Row>
              <Row swatch={<span className="h-0 w-4 border-t-2 border-dashed border-ink-2" />}>{t('Simulation area edge', 'Batas area simulasi')}</Row>
            </ul>
          </div>
          <div>
            <p className="mb-1.5 font-semibold text-text-primary">{t('Land cover', 'Tutupan lahan')}</p>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
              {LAND_SIM_HEX.map((l) => (
                <li key={l.cls} className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[3px]" style={{ background: l.color }} />
                  {l.label}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] leading-4 text-text-muted">{t('In the sample areas, land cover, peat and villages are illustrative.', 'Pada area contoh, tutupan lahan, gambut, dan desa adalah ilustrasi.')}</p>
        </div>
      )}
    </section>
  );
}
