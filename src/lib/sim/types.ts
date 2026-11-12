/** Kelas tutupan lahan per sel grid. */
export const Fuel = {
  WATER: 0,
  SHRUB: 1,
  PEAT: 2,
  SECONDARY_FOREST: 3,
  PLANTATION: 4,
  PRIMARY_FOREST: 5,
  OPEN: 6,
  SETTLEMENT: 7,
} as const;
export type FuelClass = (typeof Fuel)[keyof typeof Fuel];

export interface GridSpec {
  w: number;
  h: number;
  cellSizeM: number;
  /** Sudut barat laut grid. */
  originLon: number;
  originLat: number;
  cellDegLon: number;
  cellDegLat: number;
}

export interface SimParams {
  p0: number;
  c1: number;
  c2: number;
  slopeCoef: number;
  baseBurnSteps: number;
  peatBurnMultiplier: number;
  /** Pengali peluang menjalar saat gambut sudah melewati fase nyala (membara). */
  smolderFactor: number;
  peatBypassBase: number;
  peatBypassMoistureMax: number;
  maxProb: number;
}

export interface SimInput {
  grid: GridSpec;
  steps: number;
  stepMinutes: number;
  /** Kelas tutupan lahan per sel (FuelClass). */
  fuelClass: Uint8Array;
  /** Elevasi per sel (meter). */
  elevation: Float32Array;
  /** Indeks kelembapan gambut 0..1 per sel; -1 bila bukan gambut. */
  peatMoisture: Float32Array;
  /** 1 bila sel sekat bakar. */
  firebreak: Uint8Array;
  ignitions: number[];
  windMs: number;
  /** Arah ASAL angin (meteorologi), 0..359. */
  windFromDeg: number;
  /** Kekeringan 0..1 dari kelembapan udara dan hujan. */
  dryness: number;
  params: SimParams;
}

export interface SimResult {
  /** Langkah tiba api per sel; -1 = tidak terbakar. */
  arrival: Int16Array;
  /** Langkah terakhir sel masih menyala (eksklusif). */
  burnUntil: Int16Array;
  steps: number;
}

export interface MonteCarloResult {
  /** Peluang terbakar 0..1 per sel. */
  prob: Float32Array;
  /** Rata-rata langkah tiba bila terbakar; -1 bila tidak pernah terbakar. */
  meanArrival: Float32Array;
  /** Satu run representatif (seed pertama) untuk animasi. */
  representative: SimResult;
  runs: number;
}

export type RiskLevel = 'aman' | 'waspada' | 'siaga' | 'awas';

export interface VillageInput {
  name: string;
  lon: number;
  lat: number;
  cell: number;
  population: number;
}

export interface VillageRisk {
  villageName: string;
  etaHours: number | null;
  burnProbability: number;
  level: RiskLevel;
}

export interface FirebreakCandidate {
  id: number;
  /** Sel-sel garis sekat. */
  cells: number[];
  /** Ujung garis dalam koordinat grid (x, y). */
  a: [number, number];
  b: [number, number];
  lengthKm: number;
}

export interface FirebreakRecommendation {
  rank: number;
  candidateId: number;
  cells: number[];
  line: { type: 'LineString'; coordinates: [number, number][] };
  widthM: number;
  lengthKm: number;
  score: number;
  reductionPct: number;
  marginHours: number;
  villagesSaved: number;
  peatBypassRisk: boolean;
  note: string;
}

export interface RecommendResult {
  recommendations: FirebreakRecommendation[];
  candidatesTested: number;
  baselineRisk: number;
  /** Alasan bila tidak ada sekat valid. */
  emptyReason: string | null;
}
