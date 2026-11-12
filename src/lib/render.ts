import { Fuel } from './sim/types';

type RGBA = [number, number, number, number];

const FIRE_CORE: RGBA = [255, 77, 46, 225];
const FIRE_SMOLDER: RGBA = [255, 140, 40, 205];
const BURNED: RGBA = [74, 30, 30, 185];
const P_LOW: RGBA = [255, 210, 74, 90];
const P_MID: RGBA = [255, 159, 28, 125];
const P_HIGH: RGBA = [255, 77, 46, 150];
const P_VHIGH: RGBA = [179, 0, 27, 170];

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
  const burned: RGBA = opts.burnedStyle === 'light' ? [120, 60, 50, 170] : BURNED;
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
