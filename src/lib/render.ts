import { Fuel } from './sim/types';
import { t } from './i18n';

type RGBA = [number, number, number, number];

/*
 * Warna status api dibuat berbeda jelas (beda rona DAN kecerahan), bukan gradasi tipis:
 *  menyala  = kuning terang (api aktif di permukaan)
 *  membara  = merah tua (gambut terbakar lambat di bawah permukaan)
 *  padam    = abu gelap kecokelatan (bekas terbakar)
 * Peluang terbakar memakai rona ungu agar tidak tertukar dengan status api.
 */
export const FIRE_COLORS = {
  flame: '#ffd43b',
  smolder: '#e03131',
  burned: '#2b2220',
  probLow: '#c8a2ff',
  probMid: '#a855f7',
  probHigh: '#8b2ff0',
  probVHigh: '#6a0dd6',
} as const;

// Dibuat lebih pekat agar tetap terlihat di atas citra satelit (hijau/cokelat).
const FIRE_CORE: RGBA = [255, 212, 59, 255];
const FIRE_SMOLDER: RGBA = [224, 49, 49, 245];
const BURNED: RGBA = [43, 34, 32, 225];
const P_LOW: RGBA = [200, 162, 255, 115];
const P_MID: RGBA = [168, 85, 247, 155];
const P_HIGH: RGBA = [139, 47, 240, 190];
const P_VHIGH: RGBA = [106, 13, 214, 220];

export interface FireFrame {
  arrival: Int16Array;
  burnUntil: Int16Array;
  prob: Float32Array | null;
  meanArrival: Float32Array | null;
}

/**
 * Gambar status api pada langkah t ke ImageData (1 piksel = 1 sel).
 * Menyala, sudah terbakar, dan (opsional) peluang terbakar yang belum terjadi.
 */
export function paintFire(
  img: ImageData,
  f: FireFrame,
  t: number,
  opts: { showProbability: boolean; flameSteps?: number; burnedStyle?: 'dark' | 'light' },
): void {
  const d = img.data;
  const flame = opts.flameSteps ?? 3;
  const burned: RGBA = opts.burnedStyle === 'light' ? [60, 46, 42, 215] : BURNED;
  for (let i = 0; i < f.arrival.length; i++) {
    const a = f.arrival[i];
    let c: RGBA | null = null;
    if (a >= 0 && a <= t) {
      if (t < f.burnUntil[i]) c = t - a > flame ? FIRE_SMOLDER : FIRE_CORE;
      else c = burned;
    } else if (opts.showProbability && f.prob) {
      const p = f.prob[i];
      if (p >= 0.9) c = P_VHIGH;
      else if (p >= 0.6) c = P_HIGH;
      else if (p >= 0.3) c = P_MID;
      else if (p >= 0.1) c = P_LOW;
    }
    const o = i * 4;
    if (c) {
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = c[3];
    } else {
      d[o + 3] = 0;
    }
  }
}

const LAND: Record<number, RGBA> = {
  [Fuel.WATER]: [150, 190, 215, 255],
  [Fuel.SHRUB]: [214, 222, 176, 255],
  [Fuel.PEAT]: [205, 180, 140, 255],
  [Fuel.SECONDARY_FOREST]: [160, 196, 150, 255],
  [Fuel.PLANTATION]: [190, 210, 140, 255],
  [Fuel.PRIMARY_FOREST]: [118, 166, 124, 255],
  [Fuel.OPEN]: [232, 226, 204, 255],
  [Fuel.SETTLEMENT]: [200, 200, 205, 255],
};

/** Peta tutupan lahan sederhana untuk laporan cetak (tanpa tile internet). */
export function paintLand(img: ImageData, fuel: number[]): void {
  const d = img.data;
  for (let i = 0; i < fuel.length; i++) {
    const c = LAND[fuel[i]] ?? LAND[Fuel.OPEN];
    const o = i * 4;
    d[o] = c[0];
    d[o + 1] = c[1];
    d[o + 2] = c[2];
    d[o + 3] = c[3];
  }
}

/** Tutupan lahan untuk peta simulator (terang): agar area yang tidak terbakar tetap terbaca. */
const LAND_SIM: Record<number, RGBA> = {
  [Fuel.WATER]: [122, 176, 214, 210],
  [Fuel.SHRUB]: [196, 210, 158, 200],
  [Fuel.PEAT]: [212, 180, 134, 210],
  [Fuel.SECONDARY_FOREST]: [146, 192, 140, 200],
  [Fuel.PLANTATION]: [184, 204, 120, 200],
  [Fuel.PRIMARY_FOREST]: [104, 158, 112, 210],
  [Fuel.OPEN]: [226, 220, 194, 180],
  [Fuel.SETTLEMENT]: [192, 194, 202, 200],
};

const land = (cls: number, en: string, id: string, color: string) => ({
  cls,
  color,
  get label() {
    return t(en, id);
  },
});

export const LAND_SIM_HEX: { cls: number; label: string; color: string }[] = [
  land(Fuel.PEAT, 'Peat', 'Gambut', '#d4b486'),
  land(Fuel.PRIMARY_FOREST, 'Forest', 'Hutan', '#689e70'),
  land(Fuel.SECONDARY_FOREST, 'Secondary forest', 'Hutan sekunder', '#92c08c'),
  land(Fuel.PLANTATION, 'Plantation', 'Perkebunan', '#b8cc78'),
  land(Fuel.SHRUB, 'Shrub', 'Semak', '#c4d29e'),
  land(Fuel.WATER, 'River/water', 'Sungai/air', '#7ab0d6'),
];

export function paintLandSim(img: ImageData, fuel: number[]): void {
  const d = img.data;
  for (let i = 0; i < fuel.length; i++) {
    const c = LAND_SIM[fuel[i]] ?? LAND_SIM[Fuel.OPEN];
    const o = i * 4;
    d[o] = c[0];
    d[o + 1] = c[1];
    d[o + 2] = c[2];
    d[o + 3] = c[3];
  }
}

/*
 * Asap (PM2.5) dibagi per level ISPU, warna abu-abu hangat makin gelap dan pekat. Sengaja tidak
 * memakai warna ISPU (biru/kuning/merah) agar tidak tertukar dengan warna status api.
 */
export const SMOKE_BANDS: { min: number; hex: string; rgba: RGBA; en: string; id: string }[] = [
  { min: 15.5, hex: '#e6e2da', rgba: [230, 226, 218, 70], en: 'Moderate', id: 'Sedang' },
  { min: 55.5, hex: '#c9beae', rgba: [201, 190, 174, 120], en: 'Unhealthy', id: 'Tidak sehat' },
  { min: 150.5, hex: '#9c8b78', rgba: [156, 139, 120, 155], en: 'Very unhealthy', id: 'Sangat tidak sehat' },
  { min: 250.5, hex: '#6b5a4c', rgba: [107, 90, 76, 185], en: 'Hazardous', id: 'Berbahaya' },
];

/** Gambar raster konsentrasi asap (µg/m³) ke ImageData dengan pita warna ISPU. */
export function paintSmoke(img: ImageData, values: Float32Array): void {
  const d = img.data;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    let c: RGBA | null = null;
    for (let b = SMOKE_BANDS.length - 1; b >= 0; b--) {
      if (v >= SMOKE_BANDS[b].min) {
        c = SMOKE_BANDS[b].rgba;
        break;
      }
    }
    const o = i * 4;
    if (c) {
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = c[3];
    } else {
      d[o + 3] = 0;
    }
  }
}
