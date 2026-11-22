'use client';

import { useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';

/** Geser jam tiba api untuk melihat level desa berubah (Awas, Siaga, Waspada, Aman). */
export default function LevelSlider() {
  const t = useT();
  const [h, setH] = useState(3);
  const lv =
    h < 4
      ? { name: t('Danger', 'Awas'), color: '#ee4b4b', act: t('Evacuate now. Fire arrives in under 4 hours.', 'Evakuasi sekarang. Api tiba kurang dari 4 jam.') }
      : h < 8
        ? { name: t('Alert', 'Siaga'), color: '#f07c32', act: t('Prepare to evacuate; send crews. Fire arrives in 4 to 8 hours.', 'Siapkan evakuasi; kirim regu. Api tiba 4 sampai 8 jam.') }
        : h <= 12
          ? { name: t('Watch', 'Waspada'), color: '#f2b33d', act: t('Monitor and warn residents. Fire arrives after 8 hours.', 'Pantau dan beri tahu warga. Api tiba lebih dari 8 jam.') }
          : { name: t('Safe', 'Aman'), color: '#2fb67c', act: t('Not reached within 12 hours.', 'Tidak terjangkau dalam 12 jam.') };
  return (
    <div className="glass grid items-center gap-5 rounded-[24px] p-5 sm:grid-cols-[1fr_220px] sm:p-6">
      <div>
        <label className="block">
          <span className="flex justify-between text-sm font-semibold text-ink">
            {t('Fire arrives at the village in', 'Api tiba di desa dalam')}
            <span className="num">{h > 12 ? t('more than 12 h', 'lebih dari 12 jam') : `${h} ${t('h', 'jam')}`}</span>
          </span>
          <input type="range" min={0} max={13} value={h} onChange={(e) => setH(Number(e.target.value))} className="mt-3 w-full accent-[#ffd24a]" />
        </label>
        <div className="num mt-1 grid grid-cols-4 text-[11px] text-ink-3">
          <span>0</span>
          <span className="text-center">4</span>
          <span className="text-center">8</span>
          <span className="text-right">12+</span>
        </div>
        <p className="mt-4 text-[15px] leading-7 text-ink-2">{lv.act}</p>
      </div>
      <div className="grid place-items-center rounded-[18px] bg-black/25 p-5" aria-live="polite">
        <svg viewBox="0 0 80 60" className="w-24" aria-hidden="true">
          <path d="M10 30 L40 6 L70 30 V56 H10Z" fill={lv.color} />
          <rect x="33" y="36" width="14" height="20" fill="#0b1d15" />
        </svg>
        <span className="mt-3 rounded-full px-4 py-1.5 text-sm font-bold text-white" style={{ background: lv.color }}>
          {lv.name}
        </span>
      </div>
    </div>
  );
}
