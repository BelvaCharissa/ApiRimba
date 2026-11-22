import { locale, t } from './i18n';
import type { RiskLevel } from './sim/types';

export const nf = (v: number, digits = 1) => v.toLocaleString(locale(), { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Bulatkan ke 2 angka penting untuk perkiraan kasar (mis. 183.420 -> 180.000). */
export const nfRough = (v: number) => {
  if (v <= 0) return '0';
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
  return (Math.round(v / p) * p).toLocaleString(locale(), { maximumFractionDigits: 0 });
};
export const nf1 =(v: number) => v.toLocaleString(locale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function stepToClock(step: number, stepMinutes = 15): string {
  const mins = Math.round(step * stepMinutes);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `+${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function fmtTimeWIB(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleString(locale(), {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB'
  );
}

const COMPASS_ID = ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'];
const COMPASS_EN = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

export function compass(deg: number): string {
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return t(COMPASS_EN[i], COMPASS_ID[i]);
}

/** Label level risiko; getter agar ikut bahasa aktif. */
export const LEVEL_LABEL: Record<RiskLevel, string> = {
  get aman() {
    return t('Safe', 'Aman');
  },
  get waspada() {
    return t('Watch', 'Waspada');
  },
  get siaga() {
    return t('Alert', 'Siaga');
  },
  get awas() {
    return t('Danger', 'Awas');
  },
};

export const LEVEL_COLOR: Record<RiskLevel, string> = {
  aman: '#2fb67c',
  waspada: '#f2b33d',
  siaga: '#f07c32',
  awas: '#ee4b4b',
};

export function etaText(eta: number | null): string {
  return eta === null ? t('Safe for 12 h', 'Aman 12 jam') : t(`Arrives in ${nf(eta)} h`, `Tiba ${nf(eta)} jam`);
}
