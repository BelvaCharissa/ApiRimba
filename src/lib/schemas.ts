import { z } from 'zod';

export const ScenarioSlug = z.enum(['riau', 'kalteng', 'sumsel']);
export type ScenarioSlug = z.infer<typeof ScenarioSlug>;
/** Skenario contoh atau area langsung yang dibangun dari lokasi titik panas. */
export const AreaSlug = z.enum(['riau', 'kalteng', 'sumsel', 'live']);
export type AreaSlug = z.infer<typeof AreaSlug>;

export const DataSource = z.enum(['live', 'cache', 'fallback', 'demo']);

export const HotspotItem = z.object({
  id: z.string(),
  lat: z.number(),
  lon: z.number(),
  acquiredAt: z.string(),
  confidence: z.enum(['low', 'nominal', 'high']),
  frp: z.number(),
  satellite: z.string(),
});
export type HotspotItem = z.infer<typeof HotspotItem>;

export const HotspotsResponse = z.object({
  scenario: AreaSlug,
  source: z.string(),
  fetchedAt: z.string(),
  stale: z.boolean(),
  note: z.string().optional(),
  items: z.array(HotspotItem),
});
export type HotspotsResponse = z.infer<typeof HotspotsResponse>;

export const WeatherResponse = z.object({
  scenario: AreaSlug,
  source: z.string(),
  fetchedAt: z.string(),
  stale: z.boolean(),
  windMs: z.number(),
  windFromDeg: z.number(),
  tempC: z.number(),
  rhPct: z.number(),
  rain7dMm: z.number(),
  rain14dMm: z.number(),
  dryness: z.number(),
});
export type WeatherResponse = z.infer<typeof WeatherResponse>;

const LineString = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2).max(2),
});

export const RecommendationSave = z.object({
  rank: z.number().int().min(1).max(3),
  line: LineString,
  widthM: z.number().int().positive().max(2000),
  lengthKm: z.number().positive().max(50),
  score: z.number().min(0).max(100),
  reductionPct: z.number().min(-100).max(100),
  marginHours: z.number().min(-99).max(99),
  villagesSaved: z.number().int().min(0).max(20),
  peatBypassRisk: z.boolean(),
  note: z.string().max(400),
  applied: z.boolean(),
});

export const VillageRiskSave = z.object({
  villageName: z.string().max(80),
  variant: z.enum(['baseline', 'with_firebreak']),
  etaHours: z.number().min(0).max(24).nullable(),
  burnProbability: z.number().min(0).max(1),
  level: z.enum(['aman', 'waspada', 'siaga', 'awas']),
});

export const SimulationSave = z.object({
  scenarioSlug: ScenarioSlug,
  label: z.string().max(120).optional(),
  windMs: z.number().min(0).max(20),
  windFromDeg: z.number().int().min(0).max(359),
  seed: z.number().int(),
  steps: z.number().int().min(1).max(96),
  stepMinutes: z.number().int().min(1).max(60),
  ignitions: z.array(z.object({ lon: z.number(), lat: z.number() })).max(20),
  params: z.record(z.string(), z.number()),
  dataSource: DataSource,
  summary: z.object({
    burnedKm2By12h: z.number(),
    burnedKm2WithFirebreak: z.number().nullable(),
    burnedCellsByStep: z.array(z.number()).max(97),
    dryness: z.number(),
    maxProb: z.number(),
  }),
  arrivalB64: z.string().max(60000),
  firebreakApplied: z.boolean(),
  aiBriefing: z.string().max(6000).optional(),
  recommendations: z.array(RecommendationSave).max(3),
  villageRisks: z.array(VillageRiskSave).max(40),
});
export type SimulationSave = z.infer<typeof SimulationSave>;

const LatLon = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });

export const BriefingRequest = z.object({
  lang: z.enum(['en', 'id']).optional(),
  scenarioName: z.string().max(120),
  province: z.string().max(80),
  windMs: z.number().min(0).max(20),
  windFromDeg: z.number().min(0).max(359),
  dryness: z.number().min(0).max(1),
  burnedKm2: z.number().min(0).max(1000),
  burnedKm2WithFirebreak: z.number().min(0).max(1000).nullable(),
  villages: z
    .array(
      z.object({
        name: z.string().max(80),
        etaHours: z.number().nullable(),
        level: z.enum(['aman', 'waspada', 'siaga', 'awas']),
        population: z.number().int().min(0).max(1_000_000),
        lat: z.number().min(-90).max(90).optional(),
        lon: z.number().min(-180).max(180).optional(),
        distanceKm: z.number().min(0).max(100).optional(),
        direction: z.string().max(20).optional(),
      }),
    )
    .max(20),
  recommendations: z
    .array(
      z.object({
        label: z.string().max(20),
        score: z.number(),
        reductionPct: z.number(),
        marginHours: z.number(),
        lengthKm: z.number(),
        peatBypassRisk: z.boolean(),
        from: LatLon.optional(),
        to: LatLon.optional(),
        position: z.string().max(200).optional(),
      }),
    )
    .max(3),
  ignition: LatLon.extend({ custom: z.boolean() }).optional(),
  firstHotspot: z.object({ lat: z.number(), lon: z.number(), when: z.string().max(40), frp: z.number() }).nullable().optional(),
  appliedFirebreak: z.string().max(20).nullable(),
  emptyReason: z.string().max(300).nullable(),
});
export type BriefingRequest = z.infer<typeof BriefingRequest>;

export const BriefingResponse = z.object({
  source: z.enum(['gemini', 'fallback']),
  model: z.string().nullable(),
  text: z.string(),
  generatedAt: z.string(),
});
export type BriefingResponse = z.infer<typeof BriefingResponse>;

export function apiError(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}
