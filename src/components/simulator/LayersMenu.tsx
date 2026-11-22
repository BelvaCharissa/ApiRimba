'use client';

import { useEffect, useRef, useState } from 'react';
import { IconLayers } from '@/components/ui/icons';
import { Switch } from '@/components/ui/primitives';
import { type Layers, useSim } from '@/stores/simStore';
import { t } from '@/lib/i18n';

const ITEMS = (): { key: keyof Layers; label: string }[] => [
  { key: 'satellite', label: t('Satellite imagery', 'Citra satelit') },
  { key: 'probability', label: t('Burn probability (purple)', 'Peluang terbakar (ungu)') },
  { key: 'landcover', label: t('Land cover', 'Tutupan lahan') },
  { key: 'peat', label: t('Peat zones', 'Zona gambut') },
  { key: 'villages', label: t('Villages', 'Desa') },
  { key: 'firebreaks', label: t('Firebreaks', 'Sekat bakar') },
  { key: 'hotspots', label: t('Satellite hotspots', 'Titik panas satelit') },
  { key: 'particles', label: t('Wind animation', 'Animasi arah angin') },
];

/** Tombol lapisan peta dengan daftar switch (pola yang sama dengan aplikasi peta umum). */
export default function LayersMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const layers = useSim((s) => s.layers);
  const toggle = useSim((s) => s.toggleLayer);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className="glass flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-float transition-colors hover:bg-white/10"
      >
        <IconLayers size={18} /> {t('Layers', 'Lapisan')}
      </button>
      {open && (
        <div className="glass absolute right-0 top-12 z-40 w-64 rounded-[16px] px-4 py-2 shadow-float">
          {ITEMS().map((i) => (
            <Switch key={i.key} checked={layers[i.key]} onChange={() => toggle(i.key)} label={i.label} />
          ))}
        </div>
      )}
    </div>
  );
}
