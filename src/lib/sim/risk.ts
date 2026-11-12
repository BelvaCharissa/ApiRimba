import { RISK_THRESHOLDS } from './params';
import type { GridSpec, RiskLevel, VillageInput, VillageRisk } from './types';

export function levelFromEta(etaHours: number | null): RiskLevel {
  if (etaHours === null) return 'aman';
  if (etaHours < RISK_THRESHOLDS.awas) return 'awas';
  if (etaHours <= RISK_THRESHOLDS.siaga) return 'siaga';
  return 'waspada';
}

/**
 * Estimasi waktu tiba api di tiap desa: waktu tiba paling awal di sekitar desa
 * (radius `radius` sel), dari peta peluang dan waktu tiba rata-rata Monte Carlo.
 * Api dianggap tiba bila peluang terbakar di sel itu minimal `minProb`.
 */
export function villageRisks(
  grid: GridSpec,
  villages: VillageInput[],
  prob: Float32Array,
  meanArrival: Float32Array,
  stepMinutes: number,
  radius = 2,
  minProb = 0.25,
): VillageRisk[] {
  return villages.map((v) => {
    const vx = v.cell % grid.w;
    const vy = (v.cell - vx) / grid.w;
    let best = Infinity;
    let maxP = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = vx + dx;
        const y = vy + dy;
        if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) continue;
        const i = y * grid.w + x;
        if (prob[i] > maxP) maxP = prob[i];
        if (prob[i] >= minProb && meanArrival[i] >= 0 && meanArrival[i] < best) best = meanArrival[i];
      }
    }
    const etaHours = Number.isFinite(best) ? Math.round(((best * stepMinutes) / 60) * 10) / 10 : null;
    return {
      villageName: v.name,
      etaHours,
      burnProbability: Math.round(maxP * 100) / 100,
      level: levelFromEta(etaHours),
    };
  });
}

/** Versi deterministik (satu run): pakai arrival map langsung. */
export function villageRisksFromArrival(
  grid: GridSpec,
  villages: VillageInput[],
  arrival: Int16Array,
  stepMinutes: number,
  radius = 2,
): VillageRisk[] {
  const prob = new Float32Array(arrival.length);
  const mean = new Float32Array(arrival.length).fill(-1);
  for (let i = 0; i < arrival.length; i++) {
    if (arrival[i] >= 0) {
      prob[i] = 1;
      mean[i] = arrival[i];
    }
  }
  return villageRisks(grid, villages, prob, mean, stepMinutes, radius, 0.5);
}
