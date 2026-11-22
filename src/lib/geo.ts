import { locale, t } from './i18n';
import { compass, nf } from './format';
import { cellCenter, cellIndex } from './sim/grid';
import { Fuel, type GridSpec, type VillageInput } from './sim/types';

export type LonLat = [number, number];

/** Koordinat dalam format lapangan: 0,4567° LU, 101,9876° BT. */
export function fmtCoord(lon: number, lat: number, digits = 4): string {
  const la = Math.abs(lat).toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const lo = Math.abs(lon).toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return t(
    `${la}° ${lat >= 0 ? 'N' : 'S'}, ${lo}° ${lon >= 0 ? 'E' : 'W'}`,
    `${la}° ${lat >= 0 ? 'LU' : 'LS'}, ${lo}° ${lon >= 0 ? 'BT' : 'BB'}`,
  );
}

/** Koordinat desimal (untuk GPS / Google Maps): "0.45610, 102.00786". */
export function decCoord(lon: number, lat: number, digits = 5): string {
  return `${lat.toFixed(digits)}, ${lon.toFixed(digits)}`;
}

export function distanceKm(a: LonLat, b: LonLat): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Arah (derajat dari utara) dari a ke b. */
export function bearingDeg(a: LonLat, b: LonLat): number {
  const dx = (b[0] - a[0]) * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  const dy = b[1] - a[1];
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

/** Titik tengah sel-sel titik awal api. */
export function ignitionPoint(grid: GridSpec, cells: number[]): LonLat {
  let lon = 0;
  let lat = 0;
  for (const c of cells) {
    const [x, y] = cellCenter(grid, c);
    lon += x;
    lat += y;
  }
  return [lon / cells.length, lat / cells.length];
}

/**
 * Sel titik api dari klik di peta: sel yang diklik + 2 tetangga (seperti titik bawaan skenario).
 * Mengembalikan null bila di luar area simulasi atau di air.
 */
export function ignitionCellsAt(grid: GridSpec, fuel: number[], lon: number, lat: number): number[] | null {
  const x = Math.floor((lon - grid.originLon) / grid.cellDegLon);
  const y = Math.floor((grid.originLat - lat) / grid.cellDegLat);
  if (x < 1 || y < 1 || x >= grid.w - 1 || y >= grid.h - 1) return null;
  const c = cellIndex(grid, x, y);
  if (fuel[c] === Fuel.WATER) return null;
  return [c, cellIndex(grid, x + 1, y), cellIndex(grid, x, y + 1)].filter((i) => fuel[i] !== Fuel.WATER);
}

/** Orientasi garis dalam kata: "utara–selatan", "barat laut–tenggara", ... */
export function orientation(a: LonLat, b: LonLat): string {
  const d = bearingDeg(a, b) % 180;
  const id = ['utara–selatan', 'timur laut–barat daya', 'timur–barat', 'tenggara–barat laut'];
  const en = ['north–south', 'north-east–south-west', 'east–west', 'south-east–north-west'];
  const i = Math.round(d / 45) % 4;
  return t(en[i], id[i]);
}

export interface BreakDescription {
  from: LonLat;
  to: LonLat;
  mid: LonLat;
  /** Jarak tengah sekat dari titik api (km). */
  distKm: number;
  /** Arah tengah sekat dilihat dari titik api. */
  direction: string;
  orientation: string;
  nearestVillage: { name: string; km: number } | null;
}

export function describeBreak(line: LonLat[], ignition: LonLat, villages: VillageInput[]): BreakDescription {
  const [from, to] = line;
  const mid: LonLat = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  let nearest: { name: string; km: number } | null = null;
  for (const v of villages) {
    const km = distanceKm(mid, [v.lon, v.lat]);
    if (!nearest || km < nearest.km) nearest = { name: v.name, km };
  }
  return {
    from,
    to,
    mid,
    distKm: distanceKm(ignition, mid),
    direction: compass(bearingDeg(ignition, mid)),
    orientation: orientation(from, to),
    nearestVillage: nearest,
  };
}

/** Kalimat posisi sekat yang bisa dibacakan ke tim lapangan. */
export function breakSentence(d: BreakDescription): string {
  const near = d.nearestVillage;
  return t(
    `${nf(d.distKm)} km ${d.direction} of the ignition point, running ${d.orientation}${near ? `; nearest village ${near.name} (${nf(near.km)} km)` : ''}.`,
    `${nf(d.distKm)} km di ${d.direction} titik api, membentang ${d.orientation}${near ? `; desa terdekat ${near.name} (${nf(near.km)} km)` : ''}.`,
  );
}

/** Apakah api menyentuh tepi area simulasi (hasil terpotong batas grid). */
export function touchesEdge(grid: GridSpec, arrival: Int16Array): boolean {
  const { w, h } = grid;
  for (let x = 0; x < w; x++) {
    if (arrival[x] >= 0 || arrival[(h - 1) * w + x] >= 0) return true;
  }
  for (let y = 0; y < h; y++) {
    if (arrival[y * w] >= 0 || arrival[y * w + w - 1] >= 0) return true;
  }
  return false;
}

/** Warna tiap sekat: A hijau, B biru, C merah muda. Berbeda dari warna api dan peluang. */
export const BREAK_COLORS = ['#0f8a57', '#1f63c6', '#c2306f'] as const;
export const BREAK_COLORS_PRINT = ['#0f8a57', '#1f63c6', '#c2306f'] as const;
export const BREAK_LABELS = ['A', 'B', 'C'] as const;
