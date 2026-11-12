import type { GridSpec, VillageInput } from './sim/types';

/** Isi berkas public/data/scenarios/{slug}.json (dibuat oleh scripts/build-scenario-grid.ts). */
export interface ScenarioData {
  slug: string;
  name: string;
  province: string;
  description: string;
  center: [number, number];
  /** [barat, selatan, timur, utara] */
  bbox: [number, number, number, number];
  grid: GridSpec;
  defaultWindMs: number;
  defaultWindFromDeg: number;
  defaultSeed: number;
  defaultDryness: number;
  fuelClass: number[];
  elevation: number[];
  peatMoisture: number[];
  ignitions: number[];
  villages: VillageInput[];
  peatZones: GeoJSON.FeatureCollection<GeoJSON.Polygon, { name: string; moisture: number }>;
  rivers: GeoJSON.FeatureCollection<GeoJSON.LineString, { name: string }>;
}

export interface ScenarioMeta {
  slug: string;
  name: string;
  province: string;
  center: [number, number];
  bbox: [number, number, number, number];
  defaultWindMs: number;
  defaultWindFromDeg: number;
}

export const SCENARIOS: ScenarioMeta[] = [
  {
    slug: 'riau',
    name: 'Riau - Lahan Gambut',
    province: 'Riau',
    center: [102.0, 0.45],
    bbox: [101.928, 0.378, 102.072, 0.522],
    defaultWindMs: 6,
    defaultWindFromDeg: 225,
  },
  {
    slug: 'kalteng',
    name: 'Kalimantan Tengah - Eks PLG',
    province: 'Kalimantan Tengah',
    center: [113.95, -2.3],
    bbox: [113.878, -2.372, 114.022, -2.228],
    defaultWindMs: 6,
    defaultWindFromDeg: 90,
  },
  {
    slug: 'sumsel',
    name: 'Sumatera Selatan - OKI',
    province: 'Sumatera Selatan',
    center: [105.4, -3.3],
    bbox: [105.328, -3.372, 105.472, -3.228],
    defaultWindMs: 5,
    defaultWindFromDeg: 135,
  },
];

export function scenarioMeta(slug: string): ScenarioMeta | undefined {
  return SCENARIOS.find((s) => s.slug === slug);
}
