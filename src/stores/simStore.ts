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
  ms: number;
}

export type Layers = {
  particles: boolean;
  hotspots: boolean;
  peat: boolean;
  villages: boolean;
  probability: boolean;
  firebreaks: boolean;
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

  layers: { particles: true, hotspots: true, peat: true, villages: true, probability: true, firebreaks: true },
  demoMode: false,
  lightMode: false,

  set: (p) => set(p),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
}));
