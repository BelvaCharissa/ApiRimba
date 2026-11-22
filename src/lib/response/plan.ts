import { locale, t } from '../i18n';
/**
 * Perencana respons operasi pemadaman.
 *
 * Dari prakiraan sebaran (hasil simulasi 12 jam), perencana mencari unit SIAGA terdekat dalam
 * cakupan, menempatkan pos komando lapangan di sisi aman (melawan angin), membagi garis kendali
 * menjadi sektor, mencari sumber air terdekat untuk tiap sektor, lalu menghitung kapan garis
 * kendali tertutup (api terkendali) untuk tiga strategi. Model sederhana dan dapat dijelaskan:
 * bukan pengganti penilaian komandan lapangan.
 *
 * Murni TypeScript: tanpa React, MapLibre, atau DOM.
 */
import { scenarioUnits, scenarioWater, LINE_RATE, offsetKm } from './assets';
import { arcLL, bufferHull, convexHull, distKm, makeProj, pathLength, slicePath } from './geom';
import type {
  Assignment,
  Leg,
  LonLat,
  Phase,
  PlanSet,
  ResourceUnit,
  ResponsePlan,
  Sector,
  SensitivityRow,
  StrategyId,
  UnitKind,
  VillageOutcome,
  WaterSource,
} from './types';

export interface PlanInput {
  slug: string;
  center: LonLat;
  villages: { name: string; lon: number; lat: number; population: number }[];
  rivers: GeoJSON.FeatureCollection<GeoJSON.LineString, { name: string }>;
  waterPoints?: { name: string; lon: number; lat: number }[];
  grid: { w: number; h: number; cellSizeM: number; originLon: number; originLat: number; cellDegLon: number; cellDegLat: number };
  fuelClass: ArrayLike<number>;
  peatMoisture: ArrayLike<number>;
  ignitionCells: number[];
  windMs: number;
  windFromDeg: number;
  /** Langkah tiba api per sel (run representatif). */
  arrival: Int16Array;
  /** Luas terbakar kumulatif (km²) per langkah 15 menit, indeks 0..48. */
  burnedKm2ByStep: number[];
  stepMinutes: number;
  villageRisks: { villageName: string; etaHours: number | null }[];
  radiusKm: number;
  kinds: Record<UnitKind, boolean>;
  edge: boolean;
}

const DT = 0.05;
/** Kecepatan membuat sabuk basah di tepi desa (km/jam): pompa + selang dari sumber air desa. */
const VILLAGE_BELT_RATE = 0.6;
const HORIZON = 72;
const PEAT = 2;

/** Jam ke teks "+03:15". */
export function fmtH(h: number): string {
  const m = Math.max(0, Math.round(h * 60));
  return `+${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Jam ke teks "3 jam 15 menit". */
export function durText(h: number): string {
  const m = Math.max(0, Math.round(h * 60));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  if (hh === 0) return t(`${mm} min`, `${mm} menit`);
  return mm ? t(`${hh} h ${mm} min`, `${hh} jam ${mm} menit`) : t(`${hh} h`, `${hh} jam`);
}

const nf = (v: number, d = 1) => v.toLocaleString(locale(), { maximumFractionDigits: d });
function compass(deg: number): string {
  const id = ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'];
  const en = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return t(en[i], id[i]);
}

/* ---------------- Kurva luas tanpa tindakan ---------------- */
interface Growth {
  area0: (t: number) => number;
  growth0: (t: number) => number;
  tauOf: (a: number) => number;
}

function makeGrowth(byStep: number[], stepMinutes: number): Growth {
  const perH = 60 / stepMinutes;
  const last = byStep.length - 1;
  const lastH = last / perH;
  const back = Math.max(1, Math.round(3 * perH));
  const g = Math.max(0.02, (byStep[last] - byStep[Math.max(0, last - back)]) / (back / perH));
  const area0 = (t: number) => {
    if (t <= 0) return byStep[0];
    if (t >= lastH) return byStep[last] + g * (t - lastH);
    const x = t * perH;
    const i = Math.floor(x);
    return byStep[i] + (byStep[Math.min(last, i + 1)] - byStep[i]) * (x - i);
  };
  const growth0 = (t: number) => Math.max(0.005, (area0(t + 0.25) - area0(Math.max(0, t - 0.25))) / (t < 0.25 ? 0.25 + t : 0.5));
  const tauOf = (a: number) => {
    let lo = 0;
    let hi = 400;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (area0(mid) < a) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  return { area0, growth0, tauOf };
}

/* ---------------- Inti model pengendalian ---------------- */
interface Crew {
  t: number;
  rate: number;
}
interface Heli {
  t: number;
  eff: number;
}
interface CoreOut {
  containH: number | null;
  areaKm2: number;
  curve: number[];
}

function simulateCore(
  strategy: StrategyId,
  crews: Crew[],
  helis: Heli[],
  delay: number,
  gr: Growth,
  k: number,
  bufKm: number,
): CoreOut {
  const curve: number[] = [];
  let L = 0;
  if (strategy === 'B') {
    for (let t = 0; t <= HORIZON + 1e-9; t += DT) {
      for (const c of crews) if (t >= c.t + delay) L += c.rate * DT;
      const a0 = gr.area0(t);
      const need = k * Math.sqrt(a0) + 2 * Math.PI * bufKm;
      if (Math.round(t / DT) % 5 === 0) curve.push(a0);
      if (L >= need && t > 0) {
        const enclosed = a0 + k * Math.sqrt(a0) * bufKm + Math.PI * bufKm * bufKm;
        return { containH: t, areaKm2: enclosed, curve };
      }
    }
    return { containH: null, areaKm2: gr.area0(HORIZON), curve };
  }
  const alpha = strategy === 'A' ? 0.5 : 0.7;
  let A = gr.area0(0);
  for (let t = 0; t <= HORIZON + 1e-9; t += DT) {
    for (const c of crews) if (t >= c.t + delay) L += c.rate * DT;
    const P = Math.max(0.4, k * Math.sqrt(A));
    const c = Math.min(1, L / P);
    if (Math.round(t / DT) % 5 === 0) curve.push(A);
    if (c >= 1) return { containH: t, areaKm2: A, curve };
    let heliMult = 1;
    for (const h of helis) if (t >= h.t + delay) heliMult *= 1 - 0.15 * h.eff;
    const m = (1 - Math.pow(c, alpha)) * heliMult;
    A += gr.growth0(gr.tauOf(A)) * m * DT;
  }
  return { containH: null, areaKm2: A, curve };
}

/* ---------------- Perencana ---------------- */
const MOB: Record<UnitKind, number> = {
  regu_ma: 0.5,
  regu_tni: 0.75,
  regu_polri: 0.75,
  regu_mpa: 0.25,
  alat_berat: 1.5,
  tangki: 0.5,
  perahu: 0.3,
  heli: 0.75,
};
const DRIVE: Record<UnitKind, number> = {
  regu_ma: 35,
  regu_tni: 35,
  regu_polri: 35,
  regu_mpa: 25,
  alat_berat: 20,
  tangki: 30,
  perahu: 15,
  heli: 180,
};
const ROAD = 1.35;

const STRATEGY_META: Record<StrategyId, { code: string; title: string }> = {
  A: {
    code: 'SCN-A',
    get title() {
      return t('Direct attack on the fire head', 'Serangan langsung ke kepala api');
    },
  },
  B: {
    code: 'SCN-B',
    get title() {
      return t('Indirect control line', 'Garis kendali tidak langsung');
    },
  },
  C: {
    code: 'SCN-C',
    get title() {
      return t('Protect villages, then attack the flanks', 'Lindungi desa, lalu serang sayap');
    },
  },
};

function nearestWater(ws: WaterSource[], p: LonLat): { w: WaterSource | null; km: number } {
  let best: WaterSource | null = null;
  let km = Infinity;
  for (const w of ws) {
    const d = distKm(w.pos, p);
    if (d < km) {
      km = d;
      best = w;
    }
  }
  return { w: best, km };
}

function waterEff(km: number, supplied: boolean): number {
  if (km <= 1) return 1;
  if (km <= 3) return supplied ? 0.85 : 0.5;
  return supplied ? 0.7 : 0.35;
}

export function buildPlans(inp: PlanInput): PlanSet {
  const { grid } = inp;
  const cellCenter = (i: number): LonLat => {
    const x = i % grid.w;
    const y = (i - x) / grid.w;
    return [grid.originLon + (x + 0.5) * grid.cellDegLon, grid.originLat - (y + 0.5) * grid.cellDegLat];
  };
  const ign: LonLat = (() => {
    let lo = 0;
    let la = 0;
    for (const c of inp.ignitionCells) {
      const p = cellCenter(c);
      lo += p[0];
      la += p[1];
    }
    const n = Math.max(1, inp.ignitionCells.length);
    return [lo / n, la / n];
  })();
  const proj = makeProj(ign);
  const gr = makeGrowth(inp.burnedKm2ByStep, inp.stepMinutes);
  const lastStep = inp.burnedKm2ByStep.length - 1;
  const A12 = inp.burnedKm2ByStep[lastStep];

  // Selubung api per langkah (km lokal), dengan cache.
  const hullCache = new Map<number, [number, number][]>();
  const hullAt = (step: number) => {
    const s = Math.max(0, Math.min(lastStep, step));
    const hit = hullCache.get(s);
    if (hit) return hit;
    const pts: [number, number][] = [];
    for (let i = 0; i < inp.arrival.length; i++) {
      const a = inp.arrival[i];
      if (a >= 0 && a <= s) pts.push(proj.toKm(cellCenter(i)));
    }
    if (pts.length === 0) pts.push([0, 0]);
    const h = bufferHull(convexHull(pts), grid.cellSizeM / 2000);
    hullCache.set(s, h);
    return h;
  };
  const closed = (h: [number, number][]) => [...h, h[0]];
  const hull12 = hullAt(lastStep);
  const k = A12 > 0.05 ? Math.min(8, Math.max(3.6, pathLength(closed(hull12)) / Math.sqrt(A12))) : 3.6;
  const stepOfArea = (a: number) => {
    for (let s = 0; s <= lastStep; s++) if (inp.burnedKm2ByStep[s] >= a) return s;
    return lastStep;
  };
  const ringFor = (area: number, bufKm: number): [number, number][] => {
    let h: [number, number][];
    if (area > A12 && A12 > 0) {
      const f = Math.sqrt(area / A12);
      const cx = hull12.reduce((s, p) => s + p[0], 0) / hull12.length;
      const cy = hull12.reduce((s, p) => s + p[1], 0) / hull12.length;
      h = hull12.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f] as [number, number]);
    } else {
      h = hullAt(stepOfArea(area));
    }
    return bufKm > 0 ? bufferHull(h, bufKm) : h;
  };

  // Arah angin: TUJUAN = asal + 180.
  const toRad = (((inp.windFromDeg + 180) % 360) * Math.PI) / 180;
  const dwn: [number, number] = [Math.sin(toRad), Math.cos(toRad)];
  const extreme = (ring: [number, number][], sign: 1 | -1) => {
    let bi = 0;
    let bv = -Infinity;
    ring.forEach((p, i) => {
      const v = sign * (p[0] * dwn[0] + p[1] * dwn[1]);
      if (v > bv) {
        bv = v;
        bi = i;
      }
    });
    return bi;
  };

  // Pos komando lapangan: di tumit api (melawan angin), 1,2 km di luar garis 12 jam.
  const ringProv = ringFor(A12, 0.3);
  const heel = ringProv[extreme(ringProv, -1)];
  const staging = proj.toLL([heel[0] - dwn[0] * 1.2, heel[1] - dwn[1] * 1.2]);

  // Posko komando: desa yang paling lambat terancam, terdekat ke pos lapangan.
  const etaOf = new Map(inp.villageRisks.map((v) => [v.villageName, v.etaHours]));
  const safeVillages = [...inp.villages].sort((a, b) => {
    const ea = etaOf.get(a.name) ?? null;
    const eb = etaOf.get(b.name) ?? null;
    const sa = ea === null ? 0 : ea < 8 ? 2 : 1;
    const sb = eb === null ? 0 : eb < 8 ? 2 : 1;
    return sa - sb || distKm([a.lon, a.lat], staging) - distKm([b.lon, b.lat], staging);
  });
  const cpV = safeVillages[0];
  const commandPost = cpV
    ? {
        name: /^(Permukiman|Settlement)/.test(cpV.name) ? t(`Command post at ${cpV.name.toLowerCase()}`, `Posko komando di ${cpV.name.toLowerCase()}`) : t(`Command post, ${cpV.name} village`, `Posko komando Desa ${cpV.name}`),
        pos: offsetKm([cpV.lon, cpV.lat], 0.35, 0.25),
      }
    : { name: t('Command post', 'Posko komando'), pos: staging };

  const units = scenarioUnits({ slug: inp.slug, center: inp.center, villages: inp.villages, rivers: inp.rivers, waterPoints: inp.waterPoints });
  const water = scenarioWater({ slug: inp.slug, center: inp.center, villages: inp.villages, rivers: inp.rivers, waterPoints: inp.waterPoints }, ign);
  const usableWater = water.filter((w) => distKm(w.pos, ign) <= Math.max(inp.radiusKm, 8));
  const inRange = (u: ResourceUnit) => u.kind === 'heli' || distKm(u.base, ign) <= inp.radiusKm;
  const available = units
    .filter((u) => u.status === 'siaga' && inp.kinds[u.kind] && inRange(u))
    .sort((a, b) => distKm(a.base, ign) - distKm(b.base, ign));

  // Peat fraction for mop-up duration.
  let burned = 0;
  let peat = 0;
  for (let i = 0; i < inp.arrival.length; i++) {
    if (inp.arrival[i] >= 0) {
      burned++;
      if (inp.fuelClass[i] === PEAT || inp.peatMoisture[i] >= 0) peat++;
    }
  }
  const peatFrac = burned ? peat / burned : 0;
  const mopupH = Math.round((10 + 14 * peatFrac) * 4) / 4;

  const threatened = inp.villageRisks
    .filter((v) => v.etaHours !== null && v.etaHours <= 12)
    .sort((a, b) => (a.etaHours ?? 99) - (b.etaHours ?? 99));

  const plans = (['A', 'B', 'C'] as StrategyId[]).map((sid) =>
    planFor(sid, {
      inp,
      proj,
      gr,
      k,
      ringFor,
      extreme,
      dwn,
      ign,
      staging,
      commandPost,
      available,
      water: usableWater.length ? usableWater : water,
      mopupH,
      threatened,
      A12,
    }),
  );
  let recommended: StrategyId | null = null;
  let best = -1;
  for (const p of plans) {
    if (p.unitsDeployed > 0 && p.score > best) {
      best = p.score;
      recommended = p.id;
    }
  }
  const kindsSig = Object.entries(inp.kinds)
    .filter(([, v]) => v)
    .map(([key]) => key)
    .join(',');
  const signature = [
    inp.slug,
    inp.ignitionCells.join('.'),
    inp.windMs.toFixed(1),
    Math.round(inp.windFromDeg),
    A12.toFixed(2),
    inp.radiusKm,
    kindsSig,
  ].join('|');
  return { plans, recommended, units, waterSources: water, radiusKm: inp.radiusKm, ignition: ign, signature };
}

interface Ctx {
  inp: PlanInput;
  proj: ReturnType<typeof makeProj>;
  gr: Growth;
  k: number;
  ringFor: (area: number, bufKm: number) => [number, number][];
  extreme: (ring: [number, number][], sign: 1 | -1) => number;
  dwn: [number, number];
  ign: LonLat;
  staging: LonLat;
  commandPost: { name: string; pos: LonLat };
  available: ResourceUnit[];
  water: WaterSource[];
  mopupH: number;
  threatened: { villageName: string; etaHours: number | null }[];
  A12: number;
}

function planFor(sid: StrategyId, cx: Ctx): ResponsePlan {
  const { inp, proj, gr, k, ringFor, extreme, staging, available } = cx;
  const meta = STRATEGY_META[sid];
  const bufKm = sid === 'B' ? 0.8 : 0.15;
  const prodMult = sid === 'A' ? 0.85 : sid === 'B' ? 1.4 : 1;

  const lineKinds: UnitKind[] = ['regu_ma', 'regu_tni', 'regu_polri', 'regu_mpa'];
  if (sid === 'B') lineKinds.push('alat_berat');
  let lineUnits = available.filter((u) => lineKinds.includes(u.kind));
  const tankers = available.filter((u) => u.kind === 'tangki' || u.kind === 'perahu');
  const helis = available.filter((u) => u.kind === 'heli');

  // Strategi C: regu terdekat ke desa terancam (utamakan MPA desa itu sendiri).
  const villageCrew = new Map<string, ResourceUnit>();
  if (sid === 'C') {
    for (const v of cx.threatened.slice(0, 2)) {
      const vi = inp.villages.find((x) => x.name === v.villageName);
      if (!vi) continue;
      const vp: LonLat = [vi.lon, vi.lat];
      const pool = lineUnits.filter((u) => u.kind !== 'alat_berat');
      const own = pool.find((u) => u.kind === 'regu_mpa' && distKm(u.base, vp) < 0.5);
      const pick = own ?? [...pool].sort((a, b) => distKm(a.base, vp) - distKm(b.base, vp))[0];
      if (pick) {
        villageCrew.set(v.villageName, pick);
        lineUnits = lineUnits.filter((u) => u.id !== pick.id);
      }
    }
  }

  // Perjalanan ke pos lapangan.
  const travelTo = (u: ResourceUnit, p: LonLat) => {
    const d = distKm(u.base, p);
    if (u.kind === 'heli') return { arrive: MOB.heli + d / DRIVE.heli, km: d };
    if (u.kind === 'regu_mpa' && d <= 4) return { arrive: MOB.regu_mpa + d / 3, km: d };
    return { arrive: MOB[u.kind] + (d * ROAD) / DRIVE[u.kind], km: d * ROAD };
  };

  // Ring sementara (12 jam) untuk menilai akses air per sisi.
  const anchorSign: 1 | -1 = sid === 'A' ? 1 : -1;
  const provRing = ringFor(cx.A12, bufKm);
  const provSides = sidesOf(provRing, extreme(provRing, anchorSign));
  const sideWater = provSides.map((side) => {
    const mid = proj.toLL(side[Math.floor(side.length / 2)]);
    return nearestWater(cx.water, mid);
  });
  // Mobil tangki/perahu ke sisi dengan akses air terburuk.
  const sideSupplied = [false, false];
  const supplyOrder = [0, 1].sort((a, b) => sideWater[b].km - sideWater[a].km);
  const tankerSide = new Map<string, number>();
  tankers.forEach((t, i) => {
    const side = supplyOrder[i % 2];
    if (sideWater[side].km > 1 || i === 0) {
      tankerSide.set(t.id, side);
      sideSupplied[side] = true;
    }
  });

  interface Planned {
    u: ResourceUnit;
    side: number;
    onScene: number;
    arriveStaging: number;
    rate: number;
    eff: number;
  }
  const planned: Planned[] = lineUnits.map((u, i) => {
    const tr = travelTo(u, staging);
    const side = i % 2;
    const isEks = u.kind === 'alat_berat';
    const eff = isEks ? 1 : waterEff(sideWater[side].km, sideSupplied[side]);
    const onScene = tr.arrive + (u.kind === 'regu_mpa' && tr.km <= 4 ? 0.3 : 0.5);
    return { u, side, onScene, arriveStaging: tr.arrive, rate: (LINE_RATE[u.kind] ?? 0.1) * prodMult * eff, eff };
  });
  const heliPlans = helis.map((h) => {
    const head = proj.toLL(provRing[extreme(provRing, 1)]);
    const dip = nearestWater(cx.water, head);
    const cycle = (2 * dip.km) / 150 + 0.1;
    const tr = travelTo(h, dip.w?.pos ?? head);
    return { u: h, onScene: tr.arrive, dip, head, cycle, eff: Math.min(1, 0.5 / cycle) };
  });
  const crews: Crew[] = planned.map((p) => ({ t: p.onScene, rate: p.rate * (sid === 'B' && heliPlans.length ? 1.08 : 1) }));
  // Strategi C: regu desa bergabung ke garis setelah sabuk basah selesai (±0,5 jam berpindah).
  for (const [vname, u] of villageCrew) {
    const vi = inp.villages.find((x) => x.name === vname);
    if (!vi) continue;
    const arrive = travelTo(u, [vi.lon, vi.lat]).arrive + 0.15;
    crews.push({ t: arrive + (Math.PI * 0.5) / (VILLAGE_BELT_RATE * 0.75) + 0.5, rate: (LINE_RATE[u.kind] ?? 0.1) * prodMult * 0.85 });
  }
  const heliCore: Heli[] = sid === 'B' ? [] : heliPlans.map((h) => ({ t: h.onScene, eff: h.eff }));

  const core = simulateCore(sid, crews, heliCore, 0, gr, k, bufKm);
  const containH = core.containH;
  const tEnd = containH ?? HORIZON;
  const finalArea = core.areaKm2;

  // Ring akhir & sektor.
  const finalRingKm = sid === 'B' ? ringFor(gr.area0(tEnd), bufKm) : ringFor(finalArea, bufKm);
  const anchorIdx = extreme(finalRingKm, anchorSign);
  const sides = sidesOf(finalRingKm, anchorIdx);
  const ringLL = [...finalRingKm, finalRingKm[0]].map(proj.toLL);
  const head = proj.toLL(finalRingKm[extreme(finalRingKm, 1)]);
  const lineKm = pathLength([...finalRingKm, finalRingKm[0]]);

  const sectors: Sector[] = [];
  const assignments: Assignment[] = [];
  const workUntil = (t: number) => Math.max(t + 0.25, tEnd);
  const mopEnd = containH !== null ? containH + cx.mopupH : HORIZON;
  const patrolEnd = containH !== null ? mopEnd + 6 : HORIZON;
  const builtFrac = containH !== null ? 1 : Math.min(1, coreBuiltFraction(crews, k, finalArea, bufKm, sid));

  for (const sideIdx of [0, 1]) {
    const mine = planned.filter((p) => p.side === sideIdx).sort((a, b) => a.onScene - b.onScene);
    const side = sides[sideIdx];
    const sideLen = pathLength(side);
    const work = mine.map((p) => p.rate * Math.max(0.01, tEnd - p.onScene));
    const W = work.reduce((s, v) => s + v, 0) || 1;
    let s0 = 0;
    mine.forEach((p, j) => {
      const len = (sideLen * work[j]) / W;
      const segKm = slicePath(side, s0, s0 + len);
      s0 += len;
      const path = (segKm.length >= 2 ? segKm : [side[0], side[0]]).map(proj.toLL);
      const mid = path[Math.floor(path.length / 2)];
      const wsrc = nearestWater(cx.water, mid);
      const sec: Sector = {
        id: `S${sideIdx + 1}-${j + 1}`,
        name: `${sid === 'A' && j === 0 ? t('Head', 'Kepala') : sideIdx === 0 ? t('Left flank', 'Sayap kiri') : t('Right flank', 'Sayap kanan')} ${j + 1}`,
        kind: p.u.kind === 'alat_berat' ? 'sekat' : sid === 'A' && j === 0 ? 'kepala' : 'garis',
        path,
        lengthKm: len,
        unitIds: [p.u.id],
        waterSourceId: wsrc.w?.id ?? null,
        waterKm: wsrc.km,
        t0: p.onScene,
        t1: workUntil(p.onScene),
      };
      sectors.push(sec);
      const legs = outLegs(p.u, staging, path[0], p.arriveStaging, p.onScene);
      assignments.push({
        unitId: p.u.id,
        role: p.u.kind === 'alat_berat' ? 'sekat' : sec.kind === 'kepala' ? 'kepala' : 'garis',
        sectorId: sec.id,
        legs,
        onSceneH: p.onScene,
        workPath: builtFrac < 1 ? partialPath(path, builtFrac) : path,
        workT0: p.onScene,
        workT1: workUntil(p.onScene),
        shuttle: null,
        returnLegs: [],
        distanceKm: distKm(p.u.base, staging),
        waterSourceId: sec.waterSourceId,
        waterKm: sec.waterKm,
        efficiency: p.eff,
      });
    });
  }

  // Desa (strategi C): sabuk basah radius 0,5 km.
  const villages: VillageOutcome[] = [];
  for (const v of cx.threatened) {
    const eta = v.etaHours ?? 99;
    const crew = villageCrew.get(v.villageName);
    const vi = inp.villages.find((x) => x.name === v.villageName);
    if (crew && vi) {
      const vp: LonLat = [vi.lon, vi.lat];
      const tr = travelTo(crew, vp);
      const onScene = tr.arrive + 0.15;
      const wsrc = nearestWater(cx.water, vp);
      const eff = waterEff(wsrc.km, false);
      // Setengah lingkaran (radius 0,5 km) di sisi desa yang menghadap api: semprotan selang ±0,6 km/jam.
      const face = bearing(vp, cx.ign);
      const ring = arcLL(vp, 0.5, face - 90, face + 90, 16);
      const len = Math.PI * 0.5;
      const done = onScene + len / (VILLAGE_BELT_RATE * Math.max(0.5, eff));
      const sec: Sector = {
        id: `D-${villages.length + 1}`,
        name: t(`Wet belt ${v.villageName}`, `Sabuk basah ${v.villageName}`),
        kind: 'desa',
        path: ring,
        lengthKm: len,
        unitIds: [crew.id],
        waterSourceId: wsrc.w?.id ?? null,
        waterKm: wsrc.km,
        t0: onScene,
        t1: done,
      };
      sectors.push(sec);
      assignments.push({
        unitId: crew.id,
        role: 'desa',
        sectorId: sec.id,
        legs: [{ from: crew.base, to: ring[0], t0: MOB[crew.kind], t1: onScene, mode: tr.km <= 4 ? 'jalan_kaki' : 'darat' }],
        onSceneH: onScene,
        workPath: ring,
        workT0: onScene,
        workT1: done,
        shuttle: null,
        returnLegs: [],
        distanceKm: distKm(crew.base, vp),
        waterSourceId: sec.waterSourceId,
        waterKm: sec.waterKm,
        efficiency: eff,
      });
      villages.push({ name: v.villageName, etaH: eta, protected: done <= eta, byH: done });
    } else {
      const reached = sid === 'B' ? containH === null || containH >= eta - 0.5 : gr.tauOf(finalArea) >= eta;
      villages.push({ name: v.villageName, etaH: eta, protected: !reached, byH: containH });
    }
  }

  // Suplai air: mobil tangki & perahu bolak-balik sumber air -> tengah sisi.
  for (const t of tankers) {
    const side = tankerSide.get(t.id);
    if (side === undefined) continue;
    const secs = sectors.filter((s) => s.id.startsWith(`S${side + 1}-`));
    const target = secs[Math.floor(secs.length / 2)];
    if (!target) continue;
    const drop = target.path[Math.floor(target.path.length / 2)];
    const src =
      t.kind === 'perahu'
        ? nearestWater(cx.water.filter((w) => w.kind === 'sungai'), drop)
        : nearestWater(cx.water, drop);
    if (!src.w) continue;
    const tr = travelTo(t, staging);
    const onScene = t.kind === 'perahu' ? MOB.perahu + distKm(t.base, src.w.pos) / DRIVE.perahu : tr.arrive + distKm(staging, src.w.pos) / 12;
    const legs: Leg[] =
      t.kind === 'perahu'
        ? [{ from: t.base, to: src.w.pos, t0: MOB.perahu, t1: onScene, mode: 'sungai' }]
        : [
            { from: t.base, to: staging, t0: MOB.tangki, t1: tr.arrive, mode: 'darat' },
            { from: staging, to: src.w.pos, t0: tr.arrive, t1: onScene, mode: 'darat' },
          ];
    const cycle = (2 * distKm(src.w.pos, drop) * 1.3) / (t.kind === 'perahu' ? 12 : 15) + 0.4;
    assignments.push({
      unitId: t.id,
      role: 'suplai_air',
      sectorId: target.id,
      legs,
      onSceneH: onScene,
      workPath: [],
      workT0: onScene,
      workT1: mopEnd,
      shuttle: { a: src.w.pos, b: drop, cycleH: cycle, t0: onScene, t1: mopEnd },
      returnLegs: [],
      distanceKm: distKm(t.base, src.w.pos),
      waterSourceId: src.w.id,
      waterKm: distKm(src.w.pos, drop),
      efficiency: 1,
    });
  }

  // Helikopter: bolak-balik titik isi -> kepala api (strategi B: menahan garis).
  for (const h of heliPlans) {
    if (!h.dip.w) continue;
    const target = sid === 'B' ? proj.toLL(finalRingKm[extreme(finalRingKm, 1)]) : head;
    const t1 = Math.min(tEnd, h.onScene + 10);
    assignments.push({
      unitId: h.u.id,
      role: 'udara',
      sectorId: null,
      legs: [{ from: h.u.base, to: h.dip.w.pos, t0: MOB.heli, t1: h.onScene, mode: 'udara' }],
      onSceneH: h.onScene,
      workPath: [],
      workT0: h.onScene,
      workT1: t1,
      shuttle: { a: h.dip.w.pos, b: target, cycleH: h.cycle, t0: h.onScene, t1 },
      returnLegs: [],
      distanceKm: distKm(h.u.base, h.dip.w.pos),
      waterSourceId: h.dip.w.id,
      waterKm: h.dip.km,
      efficiency: h.eff,
    });
  }

  // Pulang ke pangkalan saat patroli selesai (bertahap).
  assignments.forEach((a, i) => {
    const u = available.find((x) => x.id === a.unitId)!;
    const startBack = (a.role === 'udara' ? a.workT1 : patrolEnd) + (i % 4) * 0.25;
    const from =
      a.shuttle ? a.shuttle.a : a.workPath.length ? a.workPath[a.workPath.length - 1] : a.legs[a.legs.length - 1]?.to ?? u.base;
    const back = travelTo(u, from);
    const dur = Math.max(0.3, back.arrive - MOB[u.kind]);
    a.returnLegs = [{ from, to: u.base, t0: startBack, t1: startBack + dur, mode: a.legs[0]?.mode ?? 'darat' }];
  });

  const firstOn = assignments.length ? Math.min(...assignments.map((a) => a.onSceneH)) : 0;
  const lastOnLine = planned.length ? Math.max(...planned.map((p) => p.onScene)) : firstOn;
  const endH = Math.max(patrolEnd, ...assignments.map((a) => a.returnLegs[0]?.t1 ?? 0));

  // Kurva luas per 0,25 jam sampai akhir.
  const curve: number[] = [];
  for (let q = 0; q <= Math.ceil(endH * 4); q++) {
    const t = q / 4;
    if (containH !== null && t >= containH) {
      curve.push(sid === 'B' ? Math.min(finalArea, gr.area0(containH) + (finalArea - gr.area0(containH)) * Math.min(1, (t - containH) / 2)) : finalArea);
    } else {
      const v = core.curve[q];
      curve.push(v ?? core.curve[core.curve.length - 1] ?? 0);
    }
  }

  // Sensitivitas keterlambatan pengerahan.
  const sensitivity: SensitivityRow[] = [0, 1, 2, 4, 6, 8, 12].map((d) => {
    const r = simulateCore(sid, crews, heliCore, d, gr, k, bufKm);
    return { delayH: d, containH: r.containH, areaKm2: r.containH !== null ? r.areaKm2 : null };
  });
  const base0 = sensitivity[0];
  let validForH: number | null = null;
  if (base0.containH !== null && base0.areaKm2 !== null) {
    validForH = 0;
    for (const r of sensitivity) {
      if (r.containH !== null && r.areaKm2 !== null && r.areaKm2 <= base0.areaKm2 * 1.3) validForH = r.delayH;
      else break;
    }
  }

  // Skor 0–100.
  const aRef = Math.max(0.1, gr.area0(48));
  const areaS = containH !== null ? clamp01(1 - finalArea / aRef) : 0;
  const timeS = containH !== null ? clamp01(1 - containH / HORIZON) : 0;
  const villageS = villages.length ? villages.filter((v) => v.protected).length / villages.length : 1;
  const safetyS = sid === 'A' ? clamp01(1 - 0.55 * Math.min(1, inp.windMs / 8)) : sid === 'B' ? 0.95 : 0.85;
  const score = assignments.length
    ? Math.round((35 * areaS + 20 * timeS + 30 * villageS + 15 * safetyS) * 10) / 10
    : 0;

  const deployed = new Set(assignments.map((a) => a.unitId));
  const personnel = available.filter((u) => deployed.has(u.id)).reduce((s, u) => s + u.personnel, 0);

  const warnings: string[] = [];
  if (!planned.length && !villageCrew.size) warnings.push(t('No ground crew on standby within range. Widen the range or enable other unit types.', 'Tidak ada regu darat siaga dalam cakupan. Perluas cakupan atau aktifkan jenis armada lain.'));
  else if (containH === null) warnings.push(t('Units within range are not enough to contain the fire in 72 h. Widen the range or request help.', 'Armada dalam cakupan tidak cukup untuk mengendalikan api dalam 72 jam. Perluas cakupan atau minta bantuan.'));
  if (sid === 'A' && inp.windMs >= 5) warnings.push(t(`Wind ${nf(inp.windMs)} m/s: attacking the fire head puts crews at risk.`, `Angin ${nf(inp.windMs)} m/s: menyerang kepala api berisiko bagi keselamatan regu.`));
  if (inp.edge) warnings.push(t('The fire touches the simulation edge: area after 12 h is extrapolated from the last rate.', 'Api menyentuh batas area simulasi: luas setelah 12 jam diperkirakan dari laju terakhir.'));
  if (peatFracNote(cx.mopupH)) warnings.push(t('Mostly peat: cooling the underground embers takes a long time.', 'Sebagian besar area gambut: pendinginan bara bawah permukaan memakan waktu lama.'));

  const phases = makePhases(sid, {
    firstOn,
    lastOnLine,
    containH,
    mopEnd,
    endH,
    planned: planned.map((p) => p.u),
    assignments,
    available,
    staging,
    ign: cx.ign,
    lineKm,
    finalArea,
    bufKm,
    villages,
    sectors,
    water: cx.water,
    mopupH: cx.mopupH,
    head,
  });

  return {
    id: sid,
    code: meta.code,
    title: villageCrew.size === 0 && sid === 'C' ? t('Flank attack from the anchor point', 'Serangan sayap dari titik tambat') : meta.title,
    tactic: tacticText(sid, villageCrew.size > 0),
    score,
    scoreParts: { area: areaS, time: timeS, village: villageS, safety: safetyS },
    containH,
    areaAtControlKm2: containH !== null ? finalArea : null,
    areaNoActionKm2: gr.area0(tEnd),
    lineKm,
    unitsDeployed: deployed.size,
    personnel,
    villages,
    sectors,
    assignments,
    phases,
    endH,
    areaCurve: curve,
    ring: ringLL,
    staging,
    commandPost: cx.commandPost,
    head,
    sensitivity,
    validForH,
    warnings,
  };
}

function peatFracNote(mopupH: number) {
  return mopupH >= 20;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function coreBuiltFraction(crews: Crew[], k: number, area: number, bufKm: number, sid: StrategyId) {
  let L = 0;
  for (const c of crews) L += c.rate * Math.max(0, HORIZON - c.t);
  const P = k * Math.sqrt(Math.max(0.01, area)) + (sid === 'B' ? 2 * Math.PI * bufKm : 0);
  return L / P;
}

function partialPath(path: LonLat[], f: number): LonLat[] {
  const n = Math.max(2, Math.round(path.length * f));
  return path.slice(0, n);
}

/** Dua sisi garis dari titik tambat: maju dan mundur, masing-masing setengah keliling. */
function sidesOf(ring: [number, number][], anchor: number): [[number, number][], [number, number][]] {
  const n = ring.length;
  if (n < 2) return [ring, ring];
  const rot = [...ring.slice(anchor), ...ring.slice(0, anchor), ring[anchor]];
  const total = pathLength(rot);
  const fwd = slicePath(rot, 0, total / 2);
  const rev = slicePath([...rot].reverse(), 0, total / 2);
  return [fwd, rev];
}

function outLegs(u: ResourceUnit, staging: LonLat, start: LonLat, arriveStaging: number, onScene: number): Leg[] {
  if (u.kind === 'regu_mpa' && distKm(u.base, staging) <= 4) {
    return [{ from: u.base, to: start, t0: MOB.regu_mpa, t1: onScene, mode: 'jalan_kaki' }];
  }
  return [
    { from: u.base, to: staging, t0: MOB[u.kind], t1: arriveStaging, mode: 'darat' },
    { from: staging, to: start, t0: arriveStaging, t1: onScene, mode: 'jalan_kaki' },
  ];
}

function tacticText(sid: StrategyId, villageFirst: boolean): string {
  if (sid === 'A')
    return t(
      'All crews go straight at the fire head on the downwind side, backed by helicopters. Spread slows fastest, but crews work next to the biggest flames.',
      'Semua regu langsung menekan kepala api di sisi hilir angin, dibantu helikopter. Laju sebaran turun paling cepat, tetapi regu bekerja dekat nyala terbesar.',
    );
  if (sid === 'B')
    return t(
      'A control line is built outside the fire edge (in unburned fuel) with excavators and crews, then the fire is left to burn out at the line. Safest, but more area is given up.',
      'Garis kendali dibangun di luar tepi api (di bahan bakar yang belum terbakar) dengan ekskavator dan regu, lalu api dibiarkan habis sampai garis. Paling aman, tetapi area yang dikorbankan lebih luas.',
    );
  return villageFirst
    ? t(
        'The nearest crews wet a belt around the threatened villages first. Other crews build line from the heel (anchor point) along both flanks towards the head.',
        'Regu terdekat membuat sabuk basah di sekeliling desa yang terancam lebih dulu. Regu lain membangun garis dari tumit api (titik tambat) ke dua sayap menuju kepala.',
      )
    : t(
        'No village is threatened within 12 h. All crews build line from the heel (anchor point) along both flanks towards the head.',
        'Tidak ada desa yang terancam 12 jam. Semua regu membangun garis dari tumit api (titik tambat) ke dua sayap menuju kepala api.',
      );
}

interface PhaseCtx {
  firstOn: number;
  lastOnLine: number;
  containH: number | null;
  mopEnd: number;
  endH: number;
  planned: ResourceUnit[];
  assignments: Assignment[];
  available: ResourceUnit[];
  staging: LonLat;
  ign: LonLat;
  lineKm: number;
  finalArea: number;
  bufKm: number;
  villages: VillageOutcome[];
  sectors: Sector[];
  water: WaterSource[];
  mopupH: number;
  head: LonLat;
}

function bearing(a: LonLat, b: LonLat) {
  const dx = (b[0] - a[0]) * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  const dy = b[1] - a[1];
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

function makePhases(sid: StrategyId, c: PhaseCtx): Phase[] {
  const byId = new Map(c.available.map((u) => [u.id, u]));
  const crews = c.assignments.filter((a) => ['garis', 'kepala', 'desa', 'sekat'].includes(a.role));
  const support = c.assignments.length - crews.length;
  const bases = new Set(c.assignments.map((a) => byId.get(a.unitId)?.baseName));
  const first = [...c.assignments].sort((a, b) => a.onSceneH - b.onSceneH)[0];
  const firstU = first ? byId.get(first.unitId) : undefined;
  const pers = c.assignments.reduce((s, a) => s + (byId.get(a.unitId)?.personnel ?? 0), 0);
  const stDist = distKm(c.ign, c.staging);
  const stDir = compass(bearing(c.ign, c.staging));
  const tankers = c.assignments.filter((a) => a.role === 'suplai_air');
  const heli = c.assignments.filter((a) => a.role === 'udara');
  const wsNames = [...new Set(c.sectors.map((s) => c.water.find((w) => w.id === s.waterSourceId)?.name).filter(Boolean))].slice(0, 2);
  const avgWater = c.sectors.length ? c.sectors.reduce((s, x) => s + (x.waterKm ?? 0), 0) / c.sectors.length : 0;

  const pengerahan: Phase = {
    id: 'pengerahan',
    label: t('Dispatch', 'Pengerahan unit'),
    t0: 0,
    t1: Math.max(0.25, c.firstOn),
    title: t('Dispatching units', 'Pengerahan unit'),
    text: c.assignments.length
      ? t(
          `${crews.length} crews and ${support} support units (${pers} personnel) leave from ${bases.size} bases. ${
            firstU ? `First unit, ${firstU.code}, arrives ${fmtH(c.firstOn)}; ` : ''
          }all line crews on scene by ${fmtH(c.lastOnLine)}. Field command post ${nf(stDist)} km ${stDir} of the ignition point, upwind.`,
          `${crews.length} regu dan ${support} unit pendukung (${pers} personel) berangkat dari ${bases.size} pangkalan. ${
            firstU ? `Unit pertama, ${firstU.code}, tiba ${fmtH(c.firstOn)}; ` : ''
          }semua regu garis di lokasi ${fmtH(c.lastOnLine)}. Pos komando lapangan ${nf(stDist)} km di ${stDir} titik api, di sisi melawan angin.`,
        )
      : t('No standby unit within range can be dispatched.', 'Tidak ada unit siaga dalam cakupan yang bisa dikerahkan.'),
  };

  const waterTxt = t(
    `Water comes from ${wsNames.join(' and ') || 'the nearest source'} (on average ${nf(avgWater)} km from the sectors)${tankers.length ? `, shuttled by ${tankers.length} tanker/boat units` : ''}.`,
    `Air diambil dari ${wsNames.join(' dan ') || 'sumber terdekat'} (rata-rata ${nf(avgWater)} km dari sektor)${tankers.length ? `, dipasok ${tankers.length} unit tangki/perahu bolak-balik` : ''}.`,
  );
  const end = c.containH ?? 72;
  const villTxt = c.villages.length
    ? t(
        ` ${c.villages.filter((v) => v.protected).length} of ${c.villages.length} threatened villages protected.`,
        ` ${c.villages.filter((v) => v.protected).length} dari ${c.villages.length} desa terancam terlindungi.`,
      )
    : '';
  const attackText =
    sid === 'A'
      ? t(
          `Crews push the fire head ${compass(bearing(c.ign, c.head))} of the ignition point${heli.length ? ', helicopters drop water on the head' : ''}. ${waterTxt}`,
          `Regu menekan kepala api di ${compass(bearing(c.ign, c.head))} titik api${heli.length ? ', helikopter menjatuhkan air ke kepala api' : ''}. ${waterTxt}`,
        )
      : sid === 'B'
        ? t(
            `A ${nf(c.lineKm)} km control line is built ${nf(c.bufKm)} km outside the fire edge${c.planned.some((u) => u.kind === 'alat_berat') ? ', excavators open the fastest stretch' : ''}. ${waterTxt}`,
            `Garis kendali ${nf(c.lineKm)} km dibangun ${nf(c.bufKm)} km di luar tepi api${c.planned.some((u) => u.kind === 'alat_berat') ? ', ekskavator membuka jalur tercepat' : ''}. ${waterTxt}`,
          )
        : t(
            `${c.villages.filter((v) => v.protected).map((v) => v.name).join(', ') || 'Villages'} get a wet belt first; other crews build line from the heel along both flanks. ${waterTxt}`,
            `${c.villages.filter((v) => v.protected).map((v) => v.name).join(', ') || 'Desa'} dilindungi sabuk basah lebih dulu; regu lain membangun garis dari tumit api ke dua sayap. ${waterTxt}`,
          );
  const serangan: Phase = {
    id: 'serangan',
    label: sid === 'B' ? t('Building the control line', 'Pembuatan garis kendali') : t('Attack & control line', 'Serangan & garis kendali'),
    t0: Math.max(0.25, c.firstOn),
    t1: Math.max(Math.max(0.25, c.firstOn) + 0.25, end),
    title: sid === 'B' ? t('Building the control line', 'Pembuatan garis kendali') : t('Attack & building the control line', 'Serangan & pembuatan garis kendali'),
    text: `${attackText} ${
      c.containH !== null
        ? t(`The control line closes at ${fmtH(c.containH)} with ${nf(c.finalArea)} km² burned.`, `Garis kendali tertutup ${fmtH(c.containH)} dengan luas terbakar ${nf(c.finalArea)} km².`)
        : t('The line does not close within 72 h.', 'Garis belum tertutup dalam 72 jam.')
    }${villTxt}`,
  };
  const phases: Phase[] = [pengerahan, serangan];
  if (c.containH !== null) {
    phases.push({
      id: 'pendinginan',
      label: t('Mop-up', 'Pendinginan'),
      t0: c.containH,
      t1: c.mopEnd,
      title: t('Fire contained — mop-up', 'Api terkendali — pendinginan'),
      text: t(
        `Fire contained at ${fmtH(c.containH)}. Crews sweep ${nf(c.lineKm)} km of line and put out peat embers for about ${durText(c.mopupH)}; tankers keep supplying water.`,
        `Api terkendali ${fmtH(c.containH)}. Regu menyisir ${nf(c.lineKm)} km garis dan memadamkan bara gambut selama ±${durText(c.mopupH)}; mobil tangki tetap memasok air.`,
      ),
    });
    phases.push({
      id: 'patroli',
      label: t('Patrol & return', 'Patroli & pulang'),
      t0: c.mopEnd,
      t1: c.endH,
      title: t('Patrol & demobilisation', 'Patroli & demobilisasi'),
      text: t(
        'Patrols make sure no new hotspot appears inside the line, then units return to base in stages.',
        'Patroli memastikan tidak ada titik panas baru di dalam garis, lalu unit kembali ke pangkalan secara bertahap.',
      ),
    });
  }
  return phases;
}
