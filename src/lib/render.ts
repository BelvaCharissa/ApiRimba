import { Fuel } from './sim/types';

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
  smolder: '#c92a2a',
  burned: '#8a7570',
  probLow: '#d0bfff',
  probMid: '#b197fc',
  probHigh: '#9775fa',
  probVHigh: '#7048e8',
} as const;

const FIRE_CORE: RGBA = [255, 212, 59, 240];
const FIRE_SMOLDER: RGBA = [201, 42, 42, 230];
const BURNED: RGBA = [138, 117, 112, 175];
const P_LOW: RGBA = [208, 191, 255, 60];
const P_MID: RGBA = [177, 151, 252, 95];
const P_HIGH: RGBA = [151, 117, 250, 125];
const P_VHIGH: RGBA = [112, 72, 232, 150];

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
  const burned: RGBA = opts.burnedStyle === 'light' ? [110, 90, 85, 170] : BURNED;
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

export const LAND_SIM_HEX: { cls: number; label: string; color: string }[] = [
  { cls: Fuel.PEAT, label: 'Gambut', color: '#d4b486' },
  { cls: Fuel.PRIMARY_FOREST, label: 'Hutan', color: '#689e70' },
  { cls: Fuel.SECONDARY_FOREST, label: 'Hutan sekunder', color: '#92c08c' },
  { cls: Fuel.PLANTATION, label: 'Perkebunan', color: '#b8cc78' },
  { cls: Fuel.SHRUB, label: 'Semak', color: '#c4d29e' },
  { cls: Fuel.WATER, label: 'Sungai/air', color: '#7ab0d6' },
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
