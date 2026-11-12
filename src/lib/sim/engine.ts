import { FUEL_FACTOR } from './params';
import { mulberry32 } from './rng';
import { Fuel, type MonteCarloResult, type SimInput, type SimResult } from './types';

/** 8 tetangga: dx, dy (y bertambah ke selatan). */
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];
/** Bearing tiap arah tetangga (derajat searah jarum jam dari utara). */
const BEARING = DX.map((dx, k) => ((Math.atan2(dx, -DY[k]) * 180) / Math.PI + 360) % 360);
const DIST_W = DX.map((dx, k) => (dx !== 0 && DY[k] !== 0 ? Math.SQRT1_2 : 1));

/** Arah TUJUAN angin dari arah ASAL meteorologi. */
export function windToDeg(windFromDeg: number): number {
  return (((windFromDeg + 180) % 360) + 360) % 360;
}

/** Faktor angin per arah tetangga (TRD: f_angin = e^{c1 V} * e^{c2 V (cos phi - 1)}). */
export function windFactors(input: Pick<SimInput, 'windMs' | 'windFromDeg' | 'params'>): Float64Array {
  const to = windToDeg(input.windFromDeg);
  const V = input.windMs;
  const { c1, c2 } = input.params;
  const out = new Float64Array(8);
  for (let k = 0; k < 8; k++) {
    const phi = ((BEARING[k] - to) * Math.PI) / 180;
    out[k] = Math.exp(c1 * V) * Math.exp(c2 * V * (Math.cos(phi) - 1));
  }
  return out;
}

/** Faktor dasar per sel: bahan bakar x kekeringan. */
export function cellFactors(input: SimInput): Float64Array {
  const n = input.grid.w * input.grid.h;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const cls = input.fuelClass[i];
    const fuel = FUEL_FACTOR[cls] ?? 0;
    let dry = input.dryness;
    const m = input.peatMoisture[i];
    if (m >= 0) dry = Math.max(dry, 1 - m);
    out[i] = fuel * (0.4 + 0.8 * dry);
  }
  return out;
}

function burnSteps(input: SimInput, i: number): number {
  const m = input.peatMoisture[i];
  const base = input.params.baseBurnSteps;
  if (m >= 0 && m < input.params.peatBypassMoistureMax) return base * input.params.peatBurnMultiplier;
  return base;
}

interface Prepared {
  wind: Float64Array;
  cell: Float64Array;
}

export function prepare(input: SimInput): Prepared {
  return { wind: windFactors(input), cell: cellFactors(input) };
}

/**
 * Satu run cellular automata. Hanya sel menyala (daftar aktif) yang diproses tiap langkah.
 * Keluaran berupa peta waktu tiba (arrival map).
 */
export function runSimulation(input: SimInput, seed: number, prepared?: Prepared): SimResult {
  const { w, h, cellSizeM } = input.grid;
  const n = w * h;
  const steps = input.steps;
  const { p0, slopeCoef, maxProb, peatBypassBase, peatBypassMoistureMax } = input.params;
  const baseBurn = input.params.baseBurnSteps;
  const smolder = input.params.smolderFactor;
  const prep = prepared ?? prepare(input);
  const rng = mulberry32(seed);
  const arrival = new Int16Array(n).fill(-1);
  const burnUntil = new Int16Array(n);
  const fb = input.firebreak;
  const fuel = input.fuelClass;
  const elev = input.elevation;
  const peat = input.peatMoisture;

  let active: number[] = [];
  for (const i of input.ignitions) {
    if (i < 0 || i >= n || fuel[i] === Fuel.WATER || arrival[i] !== -1) continue;
    arrival[i] = 0;
    burnUntil[i] = burnSteps(input, i);
    active.push(i);
  }

  for (let t = 1; t <= steps; t++) {
    const next: number[] = [];
    for (let a = 0; a < active.length; a++) {
      const i = active[a];
      // Setelah fase nyala, gambut membara pelan: tetap aktif tapi peluang menjalar kecil.
      const phase = t - arrival[i] > baseBurn ? smolder : 1;
      const x = i % w;
      const y = (i - x) / w;
      for (let k = 0; k < 8; k++) {
        const nx = x + DX[k];
        const ny = y + DY[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (arrival[j] !== -1) continue;
        if (fb[j]) {
          // Api bawah tanah di gambut kering dapat menembus sekat permukaan.
          const m = peat[j];
          if (m >= 0 && m < peatBypassMoistureMax && rng() < peatBypassBase * (1 - m) * 0.25) {
            let bx = nx;
            let by = ny;
            for (let s = 0; s < 4; s++) {
              bx += DX[k];
              by += DY[k];
              if (bx < 0 || by < 0 || bx >= w || by >= h) break;
              const b = by * w + bx;
              if (fb[b]) continue;
              if (arrival[b] === -1 && fuel[b] !== Fuel.WATER) {
                arrival[b] = t;
                burnUntil[b] = t + burnSteps(input, b);
                next.push(b);
              }
              break;
            }
          }
          continue;
        }
        const base = prep.cell[j];
        if (base <= 0) continue;
        const distM = cellSizeM * (DIST_W[k] === 1 ? 1 : Math.SQRT2);
        let slopeDeg = (Math.atan2(elev[j] - elev[i], distM) * 180) / Math.PI;
        if (slopeDeg > 30) slopeDeg = 30;
        else if (slopeDeg < -30) slopeDeg = -30;
        let p = p0 * phase * base * prep.wind[k] * Math.exp(slopeCoef * slopeDeg) * DIST_W[k];
        if (p > maxProb) p = maxProb;
        if (rng() < p) {
          arrival[j] = t;
          burnUntil[j] = t + burnSteps(input, j);
          next.push(j);
        }
      }
      if (burnUntil[i] > t) next.push(i);
    }
    active = next;
    if (active.length === 0) break;
  }
  return { arrival, burnUntil, steps };
}

/** Monte Carlo: beberapa run dengan seed berurutan, hasil peluang terbakar dan waktu tiba rata-rata. */
export function runMonteCarlo(input: SimInput, seed: number, runs: number): MonteCarloResult {
  const n = input.grid.w * input.grid.h;
  const prep = prepare(input);
  const count = new Uint16Array(n);
  const sumArr = new Float64Array(n);
  let representative: SimResult | null = null;
  for (let r = 0; r < runs; r++) {
    const res = runSimulation(input, seed + r * 7919, prep);
    if (r === 0) representative = res;
    const arr = res.arrival;
    for (let i = 0; i < n; i++) {
      if (arr[i] >= 0) {
        count[i]++;
        sumArr[i] += arr[i];
      }
    }
  }
  const prob = new Float32Array(n);
  const meanArrival = new Float32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (count[i] > 0) {
      prob[i] = count[i] / runs;
      meanArrival[i] = sumArr[i] / count[i];
    }
  }
  return { prob, meanArrival, representative: representative as SimResult, runs };
}

/** Jumlah sel terbakar per langkah (kumulatif). */
export function burnedByStep(arrival: Int16Array, steps: number): number[] {
  const counts = new Array<number>(steps + 1).fill(0);
  for (let i = 0; i < arrival.length; i++) {
    const a = arrival[i];
    if (a >= 0 && a <= steps) counts[a]++;
  }
  for (let t = 1; t <= steps; t++) counts[t] += counts[t - 1];
  return counts;
}

/** Luas (km2) dari jumlah sel. */
export function cellsToKm2(cells: number, cellSizeM: number): number {
  return (cells * cellSizeM * cellSizeM) / 1e6;
}

/** Luas terbakar yang diharapkan (km2) dari peta peluang. */
export function expectedBurnedKm2(prob: Float32Array, cellSizeM: number): number {
  let s = 0;
  for (let i = 0; i < prob.length; i++) s += prob[i];
  return cellsToKm2(s, cellSizeM);
}
