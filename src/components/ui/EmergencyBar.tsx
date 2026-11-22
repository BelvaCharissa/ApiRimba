'use client';

import { useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { HOTLINES } from '@/lib/bantuan';
import { IconAlert, IconClose } from './icons';

export default function EmergencyBar() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="no-print fixed bottom-20 right-4 z-[70] sm:bottom-5 sm:right-5">
      {open && (
        <div className="mb-2 w-[min(330px,calc(100vw-32px))] rounded-[18px] border border-danger/40 bg-[#151b17] p-4 text-white shadow-float">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold">{t('Emergency mode', 'Mode darurat')}</p>
              <p className="mt-1 text-xs leading-5 text-white/70">{t('Life in danger? Call first. Move away from smoke and follow BPBD instructions.', 'Nyawa terancam? Telepon dulu. Jauh dari asap dan ikuti arahan BPBD.')}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('Close emergency mode', 'Tutup mode darurat')} className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10">
              <IconClose size={16} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {HOTLINES.slice(0, 3).map((h) => (
              <a key={h.number} href={`tel:${h.number}`} className="rounded-[12px] bg-white/10 px-3 py-2.5 text-sm font-bold">
                <span className="num block text-lg text-[#ffab70]">{h.number}</span>
                {h.label}
              </a>
            ))}
          </div>
          <ol className="mt-3 space-y-1 text-xs leading-5 text-white/80">
            <li>1. {t('Leave the fire/smoke area if safe.', 'Keluar dari area api/asap jika aman.')}</li>
            <li>2. {t('Avoid low areas and follow official routes.', 'Jauhi daerah rendah dan ikuti jalur resmi.')}</li>
            <li>3. {t('Report again after reaching safety.', 'Laporkan lagi setelah berada di tempat aman.')}</li>
          </ol>
        </div>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="grad-fire ml-auto flex h-12 items-center gap-2 rounded-full px-4 text-sm font-bold text-white shadow-float">
        <IconAlert size={17} /> {t('Emergency', 'Darurat')}
      </button>
    </div>
  );
}
