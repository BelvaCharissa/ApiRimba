import { Fuel, type FuelClass } from './types';

/**
 * Perkiraan emisi CO2 dari area yang diperkirakan terbakar, per kelas tutupan lahan.
 * Angka = bahan bakar yang habis terbakar (t bahan kering/ha) x faktor emisi CO2 (g/kg).
 * Sumber default:
 * - Gambut: IPCC 2013 Wetlands Supplement, Tabel 2.6 & 2.7 (kebakaran liar gambut tropis):
 *   353 t/ha x 1.701 g/kg = 600 t CO2/ha. Belum termasuk CH4 dan CO.
 * - Hutan dan semak: IPCC 2006 Guidelines Vol. 4, Tabel 2.4 & 2.5 (hutan tropis 1.580 g/kg,
 *   sabana/semak 1.613 g/kg). Hutan primer ~84 t/ha, hutan sekunder/perkebunan ~42 t/ha, semak ~27 t/ha,
 *   lahan terbuka/rumput ~6 t/ha.
 * Ini perkiraan orde besaran (bukan inventarisasi resmi): kedalaman bakar gambut sangat bervariasi.
 */
export const CO2_T_PER_HA: Record<FuelClass, number> = {
  [Fuel.WATER]: 0,
  [Fuel.SHRUB]: 43,
  [Fuel.PEAT]: 600,
  [Fuel.SECONDARY_FOREST]: 67,
  [Fuel.PLANTATION]: 67,
  [Fuel.PRIMARY_FOREST]: 133,
  [Fuel.OPEN]: 10,
  [Fuel.SETTLEMENT]: 0,
};

/** Emisi tahunan rata-rata satu mobil penumpang (US EPA): 4,6 t CO2 per tahun. */
export const CAR_T_CO2_PER_YEAR = 4.6;

export interface CarbonEstimate {
  /** Total perkiraan emisi CO2 (ton). */
  tCO2: number;
  /** Bagian dari gambut (0..1). */
  peatShare: number;
  /** Luas gambut yang diperkirakan terbakar (ha). */
  peatHa: number;
}

/**
 * Emisi dari bobot terbakar per sel: peluang terbakar (0..1) dari Monte Carlo, atau 1/0 dari satu run.
 * Fungsi murni (tanpa DOM) agar bisa dites dan dipakai di Web Worker.
 */
export function estimateCarbon(fuel: ArrayLike<number>, burnWeight: ArrayLike<number>, cellSizeM: number): CarbonEstimate {
  const haPerCell = (cellSizeM * cellSizeM) / 10_000;
  let total = 0;
  let peat = 0;
  let peatCells = 0;
  for (let i = 0; i < fuel.length; i++) {
    const w = burnWeight[i];
    if (!(w > 0)) continue;
    const ef = CO2_T_PER_HA[fuel[i] as FuelClass] ?? 0;
    const e = w * ef * haPerCell;
    total += e;
    if (fuel[i] === Fuel.PEAT) {
      peat += e;
      peatCells += w;
    }
  }
  return { tCO2: total, peatShare: total > 0 ? peat / total : 0, peatHa: peatCells * haPerCell };
}

/** Bobot 1/0 dari langkah tiba satu run: terbakar bila tiba dalam `steps` langkah. */
export function arrivalWeights(arrival: Int16Array, steps: number): Uint8Array {
  const w = new Uint8Array(arrival.length);
  for (let i = 0; i < arrival.length; i++) w[i] = arrival[i] >= 0 && arrival[i] <= steps ? 1 : 0;
  return w;
}
