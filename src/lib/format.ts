import type { RiskLevel } from './sim/types';

export const nf = (v: number, digits = 1) =>
  v.toLocaleString('id-ID', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export const nf1 = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function stepToClock(step: number, stepMinutes = 15): string {
  const mins = Math.round(step * stepMinutes);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `+${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function fmtTimeWIB(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB';
}

export function compass(deg: number): string {
  const names = ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  aman: 'Aman',
  waspada: 'Waspada',
  siaga: 'Siaga',
  awas: 'Awas',
};

export const LEVEL_COLOR: Record<RiskLevel, string> = {
  aman: '#3ddc97',
  waspada: '#ffc53d',
  siaga: '#ff8a3d',
  awas: '#ff4d4f',
};

export function etaText(eta: number | null): string {
  return eta === null ? 'Aman 12 jam' : `Tiba ${nf(eta)} jam`;
}
