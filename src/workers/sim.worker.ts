/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import type { ScenarioData } from '@/lib/scenario';
import { runMonteCarlo, runSimulation } from '@/lib/sim/engine';
import { recommendFirebreaks } from '@/lib/sim/firebreak';
import { buildSimInput } from '@/lib/sim/input';
import type { RecommendResult } from '@/lib/sim/types';

export interface RunArgs {
  windMs: number;
  windFromDeg: number;
  dryness: number;
  seed: number;
  firebreakCells?: number[];
  ignitions?: number[];
}

export interface PreviewResult {
  arrival: Int16Array;
  burnUntil: Int16Array;
  ms: number;
}

export interface RefineResult extends PreviewResult {
  prob: Float32Array;
  meanArrival: Float32Array;
  runs: number;
}

let scenario: ScenarioData | null = null;

const api = {
  setScenario(data: ScenarioData) {
    scenario = data;
  },

  /** Pratinjau: 1 run dengan seed tetap. */
  preview(args: RunArgs): PreviewResult {
    if (!scenario) throw new Error('Skenario belum dimuat');
    const t0 = performance.now();
    const input = buildSimInput(scenario, args);
    const r = runSimulation(input, args.seed);
    const out = { arrival: r.arrival, burnUntil: r.burnUntil, ms: performance.now() - t0 };
    return Comlink.transfer(out, [out.arrival.buffer, out.burnUntil.buffer]);
  },

  /** Halus: 12 run Monte Carlo -> peluang terbakar dan waktu tiba rata-rata. */
  refine(args: RunArgs, runs = 12): RefineResult {
    if (!scenario) throw new Error('Skenario belum dimuat');
    const t0 = performance.now();
    const input = buildSimInput(scenario, args);
    const mc = runMonteCarlo(input, args.seed, runs);
    const out = {
      arrival: mc.representative.arrival,
      burnUntil: mc.representative.burnUntil,
      prob: mc.prob,
      meanArrival: mc.meanArrival,
      runs,
      ms: performance.now() - t0,
    };
    return Comlink.transfer(out, [out.arrival.buffer, out.burnUntil.buffer, out.prob.buffer, out.meanArrival.buffer]);
  },

  /** Rekomendasi sekat bakar dengan laporan progres. */
  recommend(args: RunArgs, onProgress: (done: number, total: number) => void): RecommendResult {
    if (!scenario) throw new Error('Skenario belum dimuat');
    const input = buildSimInput(scenario, { ...args, firebreakCells: [] });
    return recommendFirebreaks(input, {
      seed: args.seed,
      villages: scenario.villages,
      onProgress: (d, t) => onProgress(d, t),
    });
  },
};

export type SimWorkerApi = typeof api;

Comlink.expose(api);
