import { Fuel, type SimParams } from './types';

/**
 * Parameter model. Nilai awal dari docs/TRD.md, ditala secara visual —
 * bukan hasil kalibrasi dengan data kebakaran historis.
 */
export const DEFAULT_PARAMS: SimParams = {
  p0: 0.12,
  c1: 0.1,
  c2: 0.131,
  slopeCoef: 0.078,
  baseBurnSteps: 3,
  peatBurnMultiplier: 4,
  smolderFactor: 0.1,
  peatBypassBase: 0.35,
  peatBypassMoistureMax: 0.4,
  maxProb: 0.95,
};

export const STEPS_12H = 48;
export const STEP_MINUTES = 15;
export const DEFAULT_SEED = 20261112;

/** Faktor bahan bakar per kelas tutupan lahan (TRD). */
export const FUEL_FACTOR: Record<number, number> = {
  [Fuel.WATER]: 0,
  [Fuel.SHRUB]: 1.2,
  [Fuel.PEAT]: 1.1,
  [Fuel.SECONDARY_FOREST]: 0.9,
  [Fuel.PLANTATION]: 0.8,
  [Fuel.PRIMARY_FOREST]: 0.6,
  [Fuel.OPEN]: 0.5,
  [Fuel.SETTLEMENT]: 0.2,
};

/** Bobot nilai yang dilindungi per kelas tutupan (dipakai skor risiko sekat). */
export const RISK_WEIGHT: Record<number, number> = {
  [Fuel.WATER]: 0,
  [Fuel.SHRUB]: 1,
  [Fuel.PEAT]: 5,
  [Fuel.SECONDARY_FOREST]: 3,
  [Fuel.PLANTATION]: 10,
  [Fuel.PRIMARY_FOREST]: 3,
  [Fuel.OPEN]: 1,
  [Fuel.SETTLEMENT]: 100,
};

export const FUEL_LABEL: Record<number, string> = {
  [Fuel.WATER]: 'Air',
  [Fuel.SHRUB]: 'Semak belukar',
  [Fuel.PEAT]: 'Lahan gambut',
  [Fuel.SECONDARY_FOREST]: 'Hutan sekunder',
  [Fuel.PLANTATION]: 'Perkebunan',
  [Fuel.PRIMARY_FOREST]: 'Hutan primer',
  [Fuel.OPEN]: 'Lahan terbuka',
  [Fuel.SETTLEMENT]: 'Permukiman',
};

/** Ambang level risiko desa (jam). */
export const RISK_THRESHOLDS = { awas: 4, siaga: 8 } as const;

/** Waktu yang dibutuhkan tim untuk membangun sekat (jam). */
export const FIREBREAK_BUILD_HOURS = 4;
