import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ScenarioData } from '@/lib/scenario';
import { burnedByStep, runMonteCarlo, runSimulation, windToDeg } from '@/lib/sim/engine';
import { buildSimInput } from '@/lib/sim/input';
import { DEFAULT_PARAMS, DEFAULT_SEED } from '@/lib/sim/params';
import { villageRisks } from '@/lib/sim/risk';
import { Fuel, type SimInput } from '@/lib/sim/types';

const load = (slug: string): ScenarioData =>
  JSON.parse(readFileSync(join(__dirname, `../../public/data/scenarios/${slug}.json`), 'utf8'));

const riau = load('riau');

/** Grid seragam semak tanpa lereng untuk uji arah. */
function flatInput(windFromDeg: number, windMs = 8): SimInput {
  const w = 41;
  const h = 41;
  const n = w * h;
  return {
    grid: { w, h, cellSizeM: 250, originLon: 0, originLat: 0, cellDegLon: 0.00225, cellDegLat: 0.00225 },
    steps: 48,
    stepMinutes: 15,
    fuelClass: new Uint8Array(n).fill(Fuel.SHRUB),
    elevation: new Float32Array(n),
    peatMoisture: new Float32Array(n).fill(-1),
    firebreak: new Uint8Array(n),
    ignitions: [20 * w + 20],
    windMs,
    windFromDeg,
    dryness: 0.7,
    params: DEFAULT_PARAMS,
  };
}

function countSide(arr: Int16Array, w: number, side: 'east' | 'west'): number {
  let c = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < 0) continue;
    const x = i % w;
    if (side === 'east' ? x > 20 : x < 20) c++;
  }
  return c;
}

describe('mesin simulasi', () => {
  it('mengubah arah asal angin menjadi arah tujuan', () => {
    expect(windToDeg(270)).toBe(90);
    expect(windToDeg(225)).toBe(45);
    expect(windToDeg(0)).toBe(180);
  });

  it('seed sama memberi arrival identik', () => {
    const input = buildSimInput(riau, { windMs: 6, windFromDeg: 225 });
    const a = runSimulation(input, DEFAULT_SEED).arrival;
    const b = runSimulation(input, DEFAULT_SEED).arrival;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('angin dari barat membuat api menjalar lebih luas ke timur', () => {
    const input = flatInput(270);
    const mc = runMonteCarlo(input, DEFAULT_SEED, 6);
    const arr = mc.representative.arrival;
    expect(countSide(arr, input.grid.w, 'east')).toBeGreaterThan(countSide(arr, input.grid.w, 'west') * 2);
  });

  it('api tidak menembus sel air', () => {
    const input = flatInput(270);
    const w = input.grid.w;
    for (let y = 0; y < input.grid.h; y++) input.fuelClass[y * w + 26] = Fuel.WATER;
    for (let s = 0; s < 5; s++) {
      const arr = runSimulation(input, DEFAULT_SEED + s).arrival;
      for (let i = 0; i < arr.length; i++) if (arr[i] >= 0) expect(i % w).toBeLessThan(26);
    }
  });

  it('sekat non-gambut menghentikan api', () => {
    const input = flatInput(270);
    const w = input.grid.w;
    for (let y = 0; y < input.grid.h; y++) {
      input.firebreak[y * w + 25] = 1;
      input.firebreak[y * w + 26] = 1;
    }
    for (let s = 0; s < 5; s++) {
      const arr = runSimulation(input, DEFAULT_SEED + s).arrival;
      for (let i = 0; i < arr.length; i++) if (arr[i] >= 0) expect(i % w).toBeLessThan(25);
    }
  });

  it('sekat di gambut kering kadang ditembus api bawah tanah', () => {
    const input = flatInput(270);
    const w = input.grid.w;
    input.fuelClass.fill(Fuel.PEAT);
    input.peatMoisture.fill(0.1);
    for (let y = 0; y < input.grid.h; y++) {
      input.firebreak[y * w + 25] = 1;
      input.firebreak[y * w + 26] = 1;
    }
    let crossed = 0;
    for (let s = 0; s < 10; s++) {
      const arr = runSimulation(input, DEFAULT_SEED + s).arrival;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] >= 0 && i % w > 26) {
          crossed++;
          break;
        }
      }
    }
    expect(crossed).toBeGreaterThan(0);
  });

  it('angin lebih kencang memperbesar luas terbakar rata-rata', () => {
    const lo = runMonteCarlo(buildSimInput(riau, { windMs: 2, windFromDeg: 225 }), DEFAULT_SEED, 8);
    const hi = runMonteCarlo(buildSimInput(riau, { windMs: 12, windFromDeg: 225 }), DEFAULT_SEED, 8);
    const sum = (p: Float32Array) => p.reduce((s, v) => s + v, 0);
    expect(sum(hi.prob)).toBeGreaterThan(sum(lo.prob));
  });

  it('angin ke arah desa mempercepat estimasi tiba di Sungai Buluh', () => {
    const toward = buildSimInput(riau, { windMs: 8, windFromDeg: 225 });
    const away = buildSimInput(riau, { windMs: 8, windFromDeg: 45 });
    const eta = (inp: SimInput) => {
      const mc = runMonteCarlo(inp, DEFAULT_SEED, 12);
      return villageRisks(riau.grid, riau.villages, mc.prob, mc.meanArrival, 15).find(
        (v) => v.villageName === 'Sungai Buluh',
      )!.etaHours;
    };
    const a = eta(toward);
    const b = eta(away);
    expect(a).not.toBeNull();
    expect(b === null || (a as number) < b).toBe(true);
  });

  it('simulasi 12 jam di grid 64x64 selesai < 2 detik (12 run Monte Carlo)', () => {
    const input = buildSimInput(riau, { windMs: 8, windFromDeg: 225 });
    const t0 = performance.now();
    const mc = runMonteCarlo(input, DEFAULT_SEED, 12);
    const ms = performance.now() - t0;
    const single0 = performance.now();
    runSimulation(input, DEFAULT_SEED);
    const single = performance.now() - single0;
    console.log(
      `MC 12 run: ${ms.toFixed(1)} ms, 1 run: ${single.toFixed(1)} ms, terbakar (run 1): ${
        burnedByStep(mc.representative.arrival, 48)[48]
      } sel`,
    );
    expect(ms).toBeLessThan(2000);
  });
});
