/** Tipe rencana respons operasi pemadaman. Murni data, tanpa React/DOM. */

export type LonLat = [number, number];

export type UnitKind =
  | 'regu_ma'
  | 'regu_tni'
  | 'regu_polri'
  | 'regu_mpa'
  | 'alat_berat'
  | 'tangki'
  | 'perahu'
  | 'heli';

export interface ResourceUnit {
  id: string;
  /** Kode singkat di peta, mis. "MA-1". */
  code: string;
  name: string;
  kind: UnitKind;
  base: LonLat;
  baseName: string;
  personnel: number;
  /** siaga = bisa dikerahkan; bertugas = sedang di kejadian lain. */
  status: 'siaga' | 'bertugas';
}

export interface WaterSource {
  id: string;
  name: string;
  kind: 'sungai' | 'sumur_bor' | 'embung';
  pos: LonLat;
}

export type StrategyId = 'A' | 'B' | 'C';

export interface Leg {
  from: LonLat;
  to: LonLat;
  t0: number;
  t1: number;
  mode: 'darat' | 'jalan_kaki' | 'udara' | 'sungai';
}

export type Role = 'garis' | 'kepala' | 'desa' | 'sekat' | 'suplai_air' | 'udara';

export interface Shuttle {
  /** Titik isi air. */
  a: LonLat;
  /** Titik antar (sektor / kepala api). */
  b: LonLat;
  cycleH: number;
  t0: number;
  t1: number;
}

export interface Assignment {
  unitId: string;
  role: Role;
  sectorId: string | null;
  /** Perjalanan berangkat dari pangkalan sampai lokasi kerja. */
  legs: Leg[];
  /** Jam tiba di lokasi kerja (sejak rencana disetujui). */
  onSceneH: number;
  /** Jalur yang dikerjakan (garis kendali); unit bergerak di sepanjang jalur ini. */
  workPath: LonLat[];
  workT0: number;
  workT1: number;
  shuttle: Shuttle | null;
  /** Perjalanan pulang setelah patroli. */
  returnLegs: Leg[];
  distanceKm: number;
  waterSourceId: string | null;
  waterKm: number | null;
  /** Faktor kerja 0..1 (akses air, gambut). */
  efficiency: number;
}

export interface Sector {
  id: string;
  name: string;
  kind: 'garis' | 'kepala' | 'desa' | 'sekat';
  path: LonLat[];
  lengthKm: number;
  unitIds: string[];
  waterSourceId: string | null;
  waterKm: number | null;
  t0: number;
  t1: number;
}

export type PhaseId = 'pengerahan' | 'serangan' | 'pendinginan' | 'patroli';

export interface Phase {
  id: PhaseId;
  label: string;
  t0: number;
  t1: number;
  title: string;
  text: string;
}

export interface SensitivityRow {
  delayH: number;
  containH: number | null;
  areaKm2: number | null;
}

export interface VillageOutcome {
  name: string;
  etaH: number;
  protected: boolean;
  /** Jam regu tiba atau garis tertutup; null bila tidak ada. */
  byH: number | null;
}

export interface ResponsePlan {
  id: StrategyId;
  code: string;
  title: string;
  tactic: string;
  score: number;
  scoreParts: { area: number; time: number; village: number; safety: number };
  /** Jam api terkendali; null = tidak terkendali dalam 72 jam. */
  containH: number | null;
  areaAtControlKm2: number | null;
  /** Luas tanpa tindakan pada jam terkendali (pembanding). */
  areaNoActionKm2: number;
  lineKm: number;
  unitsDeployed: number;
  personnel: number;
  villages: VillageOutcome[];
  sectors: Sector[];
  assignments: Assignment[];
  phases: Phase[];
  endH: number;
  /** Luas api per 0,25 jam (indeks = jam × 4). */
  areaCurve: number[];
  ring: LonLat[];
  staging: LonLat;
  commandPost: { name: string; pos: LonLat };
  /** Titik kepala api (arah angin). */
  head: LonLat;
  sensitivity: SensitivityRow[];
  /** Batas tunda pengerahan (jam) sebelum rencana harus dihitung ulang. */
  validForH: number | null;
  warnings: string[];
}

export interface PlanSet {
  plans: ResponsePlan[];
  recommended: StrategyId | null;
  units: ResourceUnit[];
  waterSources: WaterSource[];
  radiusKm: number;
  ignition: LonLat;
  /** Ringkas: nilai masukan untuk membatalkan persetujuan saat kondisi berubah. */
  signature: string;
}
