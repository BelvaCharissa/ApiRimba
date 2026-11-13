import { create } from 'zustand';
import type { ScenarioData } from '@/lib/scenario';
import type { BriefingResponse, HotspotsResponse, ScenarioSlug, WeatherResponse } from '@/lib/schemas';
import type { FirebreakRecommendation, VillageRisk } from '@/lib/sim/types';

export interface FireResult {
  arrival: Int16Array;
  burnUntil: Int16Array;
  prob: Float32Array | null;
  meanArrival: Float32Array | null;
  quality: 'preview' | 'refined';
  burnedKm2: number;
  burnedByStep: number[];
  villageRisks: VillageRisk[];
  /** Api menyentuh batas area simulasi dalam 12 jam (hasil terpotong). */
  edge: boolean;
  ms: number;
}

export type Layers = {
  particles: boolean;
  hotspots: boolean;
  peat: boolean;
  villages: boolean;
  probability: boolean;
  firebreaks: boolean;
  landcover: boolean;
};

interface SimState {
  slug: ScenarioSlug;
  scenario: ScenarioData | null;
  hotspots: HotspotsResponse | null;
  weather: WeatherResponse | null;
  loading: boolean;

  windMs: number;
  windFromDeg: number;
  windSource: 'cuaca' | 'preset' | 'manual';
  dryness: number;
  /** Sel titik awal api pilihan pengguna; null = titik bawaan skenario. */
  ignitions: number[] | null;
  pickIgnition: boolean;

  hasRun: boolean;
  running: boolean;
  /** Hasil tanpa sekat (baseline). */
  baseline: FireResult | null;
  /** Hasil dengan sekat diterapkan. */
  withBreak: FireResult | null;

  timeStep: number;
  playing: boolean;
  speed: 1 | 2 | 4;

  recState: 'idle' | 'running' | 'done' | 'stale';
  recProgress: number;
  recommendations: FirebreakRecommendation[];
  recEmptyReason: string | null;
  recCandidates: number;
  activeRank: number | null;
  appliedRank: number | null;
  compare: boolean;

  briefing: BriefingResponse | null;
  briefingState: 'idle' | 'loading' | 'error';

  layers: Layers;
  tab: 'dampak' | 'sekat' | 'briefing';
  demoMode: boolean;
  lightMode: boolean;

  set: (p: Partial<SimState>) => void;
  toggleLayer: (k: keyof Layers) => void;
}

export const useSim = create<SimState>((set) => ({
  slug: 'riau',
  scenario: null,
  hotspots: null,
  weather: null,
  loading: true,

  windMs: 6,
  windFromDeg: 225,
  windSource: 'preset',
  dryness: 0.78,
  ignitions: null,
  pickIgnition: false,

  hasRun: false,
  running: false,
  baseline: null,
  withBreak: null,

  timeStep: 0,
  playing: false,
  speed: 2,

  recState: 'idle',
  recProgress: 0,
  recommendations: [],
  recEmptyReason: null,
  recCandidates: 0,
  activeRank: null,
  appliedRank: null,
  compare: false,

  briefing: null,
  briefingState: 'idle',

  layers: { particles: false, hotspots: true, peat: true, villages: true, probability: true, firebreaks: true, landcover: true },
  tab: 'dampak',
  demoMode: false,
  lightMode: false,

  set: (p) => set(p),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
}));
