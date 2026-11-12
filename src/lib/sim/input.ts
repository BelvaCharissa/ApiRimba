import type { ScenarioData } from '../scenario';
import { DEFAULT_PARAMS, STEP_MINUTES, STEPS_12H } from './params';
import type { SimInput, SimParams } from './types';

export interface InputOptions {
  windMs: number;
  windFromDeg: number;
  dryness?: number;
  firebreakCells?: number[];
  params?: Partial<SimParams>;
}

/** Ubah data skenario (JSON) menjadi input mesin simulasi dengan typed array. */
export function buildSimInput(data: ScenarioData, opts: InputOptions): SimInput {
  const n = data.grid.w * data.grid.h;
  const firebreak = new Uint8Array(n);
  for (const c of opts.firebreakCells ?? []) if (c >= 0 && c < n) firebreak[c] = 1;
  return {
    grid: data.grid,
    steps: STEPS_12H,
    stepMinutes: STEP_MINUTES,
    fuelClass: Uint8Array.from(data.fuelClass),
    elevation: Float32Array.from(data.elevation),
    peatMoisture: Float32Array.from(data.peatMoisture),
    firebreak,
    ignitions: data.ignitions,
    windMs: opts.windMs,
    windFromDeg: opts.windFromDeg,
    dryness: opts.dryness ?? data.defaultDryness,
    params: { ...DEFAULT_PARAMS, ...opts.params },
  };
}
