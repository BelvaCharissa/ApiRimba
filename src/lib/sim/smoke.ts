import { Fuel, type FuelClass, type GridSpec } from './types';

/**
 * Prediksi sebaran asap (PM2.5) dari hasil simulasi api.
 *
 * Model "Gaussian puff" sederhana:
 * 1. Tiap langkah waktu, sel yang sedang terbakar (menyala atau membara) melepas PM2.5:
 *    bahan bakar habis terbakar (t/ha) x faktor emisi PM2.5 (g/kg), dibagi rata selama sel itu terbakar.
 * 2. Emisi dikumpulkan per blok 2 x 2 km menjadi "gumpalan" (puff) asap, dilepas 2x per langkah.
 * 3. Gumpalan terbawa angin per jam (prakiraan Open-Meteo bila ada) dan melebar seiring jarak dan waktu.
 * 4. Konsentrasi di permukaan = massa / (2π σ² H) x exp(-d² / 2σ²), H = tinggi lapisan campur.
 *    Malam hari lapisan campur rendah, jadi asap lebih pekat (sesuai pola kabut asap pagi di Sumatra/Kalimantan).
 *
 * Ini perkiraan orde besaran untuk peringatan dini, bukan model kualitas udara resmi. Asap dari
 * kebakaran lain di luar area simulasi dan latar polusi kota tidak dihitung.
 */

/** Bahan bakar yang habis terbakar selama jendela simulasi (t bahan kering/ha). */
export const SMOKE_FUEL_T_PER_HA: Record<FuelClass, number> = {
  [Fuel.WATER]: 0,
  [Fuel.SHRUB]: 27,
  // Gambut: hanya lapisan atas yang terbakar dalam beberapa jam pertama (bukan 353 t/ha sampai habis).
  [Fuel.PEAT]: 50,
  [Fuel.SECONDARY_FOREST]: 42,
  [Fuel.PLANTATION]: 42,
  [Fuel.PRIMARY_FOREST]: 84,
  [Fuel.OPEN]: 6,
  [Fuel.SETTLEMENT]: 0,
};

/**
 * Faktor emisi PM2.5 (g per kg bahan terbakar).
 * Gambut 17,3 g/kg (Stockwell dkk. 2016, pengukuran lapangan Kalimantan Tengah 2015);
 * hutan tropis 9,1 dan semak/sabana 7,2 g/kg (Akagi dkk. 2011).
 */
export const PM25_G_PER_KG: Record<FuelClass, number> = {
  [Fuel.WATER]: 0,
  [Fuel.SHRUB]: 7.2,
  [Fuel.PEAT]: 17.3,
  [Fuel.SECONDARY_FOREST]: 9.1,
  [Fuel.PLANTATION]: 9.1,
  [Fuel.PRIMARY_FOREST]: 9.1,
  [Fuel.OPEN]: 7.2,
  [Fuel.SETTLEMENT]: 0,
};

/** Ambang ISPU PM2.5 (µg/m³) yang dipakai untuk peringatan asap. */
export const SMOKE_THRESHOLDS = { sedang: 15.5, tidakSehat: 55.4, sangatTidakSehat: 150.4, berbahaya: 250.4 } as const;

export interface SmokeWind {
  windMs: number;
  /** Arah ASAL angin (meteorologi). */
  windFromDeg: number;
}

export interface SmokeTarget {
  name: string;
  lon: number;
  lat: number;
  kind: 'village' | 'city';
}

export interface SmokeTargetResult extends SmokeTarget {
  /** Jarak dari pusat area simulasi (km). */
  distanceKm: number;
  /** Konsentrasi PM2.5 tambahan dari asap per langkah (µg/m³), indeks = langkah. */
  series: Float32Array;
  /** Konsentrasi puncak dalam 12 jam (µg/m³). */
  peak: number;
  /** Langkah saat puncak. */
  peakStep: number;
  /** Langkah pertama asap mencapai level "tidak sehat"; null bila tidak pernah. */
  unhealthyStep: number | null;
  /** Langkah pertama asap terasa (di atas "baik"); null bila tidak pernah. */
  noticeableStep: number | null;
}

interface Puff {
  /** Indeks sub-langkah saat dilepas. */
  k: number;
  /** Posisi lepas (meter dari titik acuan; x ke timur, y ke utara). */
  x: number;
  y: number;
  /** Massa PM2.5 (gram). */
  mass: number;
  sigma0: number;
}

export interface SmokeModel {
  /** Titik acuan koordinat lokal [lon, lat]. */
  origin: [number, number];
  mPerDegLon: number;
  mPerDegLat: number;
  steps: number;
  stepMinutes: number;
  sub: number;
  puffs: Puff[];
  /** Perpindahan kumulatif udara (m) dan panjang lintasan (m) per sub-langkah. */
  dispX: Float64Array;
  dispY: Float64Array;
  path: Float64Array;
  /** Tinggi lapisan campur (m) per sub-langkah. */
  mixing: Float64Array;
  /** Angin yang dipakai berasal dari prakiraan per jam (true) atau angin simulasi tetap (false). */
  hourly: boolean;
  targets: SmokeTargetResult[];
  /** Total PM2.5 yang dilepas selama 12 jam (ton). */
  totalTonnes: number;
}

const SUB = 2;
/** Ukuran blok sumber (sel). */
const BLOCK = 8;
/** Asap di atas 10 m bergerak sedikit lebih cepat dari angin permukaan. */
const TRANSPORT = 1.2;
const MIN_SPEED = 0.5;
/** Pelebaran puff: proporsional jarak tempuh dan waktu (meander angin lemah). */
const SPREAD_PER_M = 0.12;
const SPREAD_M_PER_S = 0.25;

/** Tinggi lapisan campur berdasarkan jam lokal (WIB-WIT dari bujur). */
export function mixingHeight(localHour: number): number {
  const h = ((localHour % 24) + 24) % 24;
  if (h >= 9 && h < 17) return 1200;
  if ((h >= 7 && h < 9) || (h >= 17 && h < 19)) return 700;
  return 350;
}

function sigmaAt(p: Puff, m: SmokeModel, kNow: number): number {
  const age = ((kNow - p.k) * m.stepMinutes * 60) / m.sub;
  const dist = m.path[kNow] - m.path[p.k];
  const a = SPREAD_PER_M * dist;
  const b = SPREAD_M_PER_S * age;
  return Math.sqrt(p.sigma0 * p.sigma0 + a * a + b * b);
}

interface PuffGeom {
  x: number;
  y: number;
  /** Vektor satuan searah angin. */
  ux: number;
  uy: number;
  /** Sebaran searah angin (memanjang karena dilepas terus-menerus) dan melintang. */
  sa: number;
  sc: number;
}

/**
 * Bentuk puff pada sub-langkah kNow. Puff mewakili asap yang dilepas terus-menerus selama satu
 * sub-langkah, jadi bentuknya segmen yang memanjang searah angin. Segmen berurutan menyambung
 * menjadi kepulan asap utuh dari sumber ke hilir (tanpa celah antar-puff).
 */
function puffGeom(p: Puff, m: SmokeModel, kNow: number): PuffGeom {
  const k1 = Math.min(p.k + 1, kNow);
  // Udara yang dilepas di awal sub-langkah sudah bergerak D(kNow)-D(k); yang di akhir D(kNow)-D(k1).
  const ax = m.dispX[kNow] - m.dispX[p.k];
  const ay = m.dispY[kNow] - m.dispY[p.k];
  const bx = m.dispX[kNow] - m.dispX[k1];
  const by = m.dispY[kNow] - m.dispY[k1];
  const sx = ax - bx;
  const sy = ay - by;
  const L = Math.hypot(sx, sy);
  const s = sigmaAt(p, m, kNow);
  return {
    x: p.x + (ax + bx) / 2,
    y: p.y + (ay + by) / 2,
    ux: L > 0 ? sx / L : 1,
    uy: L > 0 ? sy / L : 0,
    sa: Math.sqrt(s * s + (L * L) / 12),
    sc: s,
  };
}

function puffValue(g: PuffGeom, amp: number, x: number, y: number): number {
  const dx = x - g.x;
  const dy = y - g.y;
  const da = dx * g.ux + dy * g.uy;
  const dc = -dx * g.uy + dy * g.ux;
  return amp * Math.exp(-(da * da) / (2 * g.sa * g.sa) - (dc * dc) / (2 * g.sc * g.sc));
}

/** Sub-langkah akhir dari langkah t (asap dihitung di akhir langkah, sama dengan keadaan api yang ditampilkan). */
function kOfStep(m: SmokeModel, t: number): number {
  return Math.min(m.steps * m.sub, (Math.max(0, t) + 1) * m.sub);
}

/** Konsentrasi PM2.5 (µg/m³) di titik lokal (x, y meter) pada langkah t. */
export function concentrationAt(m: SmokeModel, x: number, y: number, t: number): number {
  const kNow = kOfStep(m, t);
  const H = m.mixing[kNow];
  let c = 0;
  for (const p of m.puffs) {
    if (p.k >= kNow) continue;
    const g = puffGeom(p, m, kNow);
    if ((x - g.x) ** 2 + (y - g.y) ** 2 > 16 * g.sa * g.sa) continue;
    c += puffValue(g, p.mass / (2 * Math.PI * g.sa * g.sc * H), x, y);
  }
  return c * 1e6;
}

export function toLocal(m: SmokeModel, lon: number, lat: number): [number, number] {
  return [(lon - m.origin[0]) * m.mPerDegLon, (lat - m.origin[1]) * m.mPerDegLat];
}

export function toLonLat(m: SmokeModel, x: number, y: number): [number, number] {
  return [m.origin[0] + x / m.mPerDegLon, m.origin[1] + y / m.mPerDegLat];
}

export interface BuildSmokeInput {
  grid: GridSpec;
  fuelClass: ArrayLike<number>;
  arrival: Int16Array;
  burnUntil: Int16Array;
  steps: number;
  stepMinutes: number;
  /** Angin per jam mulai jam ke-0. Satu elemen = angin tetap. */
  winds: SmokeWind[];
  hourly: boolean;
  /** Waktu mulai simulasi (ms epoch) untuk jam lokal (lapisan campur siang/malam). */
  startMs: number;
  targets: SmokeTarget[];
}

export function buildSmoke(inp: BuildSmokeInput): SmokeModel {
  const { grid, steps, stepMinutes } = inp;
  const centerLon = grid.originLon + (grid.w * grid.cellDegLon) / 2;
  const centerLat = grid.originLat - (grid.h * grid.cellDegLat) / 2;
  const mPerDegLat = 110_574;
  const mPerDegLon = 111_320 * Math.cos((centerLat * Math.PI) / 180);
  const cellM = grid.cellSizeM;
  const haPerCell = (cellM * cellM) / 10_000;

  // 1. Emisi per blok per langkah: massa dan momen posisi (untuk pusat dan sebaran sumber).
  const bw = Math.ceil(grid.w / BLOCK);
  const bh = Math.ceil(grid.h / BLOCK);
  const nb = bw * bh;
  const mass = new Float64Array(nb * steps);
  const mx = new Float64Array(nb * steps);
  const my = new Float64Array(nb * steps);
  const mxx = new Float64Array(nb * steps);
  for (let i = 0; i < inp.arrival.length; i++) {
    const a = inp.arrival[i];
    if (a < 0 || a >= steps) continue;
    const f = inp.fuelClass[i] as FuelClass;
    const g = (SMOKE_FUEL_T_PER_HA[f] ?? 0) * haPerCell * 1e6 * ((PM25_G_PER_KG[f] ?? 0) / 1000); // gram
    if (g <= 0) continue;
    const dur = Math.max(1, inp.burnUntil[i] - a);
    const per = g / dur;
    const cx = i % grid.w;
    const cy = (i - cx) / grid.w;
    const b = Math.floor(cy / BLOCK) * bw + Math.floor(cx / BLOCK);
    const x = (cx + 0.5 - grid.w / 2) * cellM;
    const y = (grid.h / 2 - cy - 0.5) * cellM;
    const end = Math.min(steps, inp.burnUntil[i]);
    for (let s = a; s < end; s++) {
      const j = b * steps + s;
      mass[j] += per;
      mx[j] += per * x;
      my[j] += per * y;
      mxx[j] += per * (x * x + y * y);
    }
  }

  // 2. Angin per sub-langkah -> perpindahan kumulatif udara.
  const K = steps * SUB;
  const dts = (stepMinutes * 60) / SUB;
  const dispX = new Float64Array(K + 1);
  const dispY = new Float64Array(K + 1);
  const path = new Float64Array(K + 1);
  const mixing = new Float64Array(K + 1);
  const winds = inp.winds.length ? inp.winds : [{ windMs: 4, windFromDeg: 135 }];
  const lonHours = centerLon / 15;
  for (let k = 0; k <= K; k++) {
    const sec = k * dts;
    const utcHour = new Date(inp.startMs + sec * 1000).getUTCHours() + new Date(inp.startMs + sec * 1000).getUTCMinutes() / 60;
    mixing[k] = mixingHeight(utcHour + lonHours);
    if (k === K) break;
    const w = winds[Math.min(winds.length - 1, Math.floor(sec / 3600))];
    const v = Math.max(MIN_SPEED, w.windMs * TRANSPORT);
    const to = ((w.windFromDeg + 180) * Math.PI) / 180;
    dispX[k + 1] = dispX[k] + Math.sin(to) * v * dts;
    dispY[k + 1] = dispY[k] + Math.cos(to) * v * dts;
    path[k + 1] = path[k] + v * dts;
  }

  // 3. Puff per blok aktif per sub-langkah.
  const puffs: Puff[] = [];
  let total = 0;
  for (let b = 0; b < nb; b++) {
    for (let s = 0; s < steps; s++) {
      const j = b * steps + s;
      const M = mass[j];
      if (M <= 0) continue;
      total += M;
      const x = mx[j] / M;
      const y = my[j] / M;
      const varPos = Math.max(0, mxx[j] / M - x * x - y * y);
      const sigma0 = Math.max(150, Math.sqrt(varPos + (cellM * cellM) / 4));
      for (let q = 0; q < SUB; q++) puffs.push({ k: s * SUB + q, x, y, mass: M / SUB, sigma0 });
    }
  }

  const model: SmokeModel = {
    origin: [centerLon, centerLat],
    mPerDegLon,
    mPerDegLat,
    steps,
    stepMinutes,
    sub: SUB,
    puffs,
    dispX,
    dispY,
    path,
    mixing,
    hourly: inp.hourly,
    targets: [],
    totalTonnes: total / 1e6,
  };

  // 4. Deret konsentrasi di desa dan kota.
  model.targets = inp.targets.map((tg) => {
    const [x, y] = toLocal(model, tg.lon, tg.lat);
    const series = new Float32Array(steps);
    let peak = 0;
    let peakStep = 0;
    let unhealthyStep: number | null = null;
    let noticeableStep: number | null = null;
    for (let t = 0; t < steps; t++) {
      const c = concentrationAt(model, x, y, t);
      series[t] = c;
      if (c > peak) {
        peak = c;
        peakStep = t;
      }
      if (noticeableStep === null && c > SMOKE_THRESHOLDS.sedang) noticeableStep = t;
      if (unhealthyStep === null && c > SMOKE_THRESHOLDS.tidakSehat) unhealthyStep = t;
    }
    return { ...tg, distanceKm: Math.hypot(x, y) / 1000, series, peak, peakStep, unhealthyStep, noticeableStep };
  });
  return model;
}

export interface SmokeField {
  w: number;
  h: number;
  /** µg/m³ per piksel, baris dari utara ke selatan. */
  values: Float32Array;
  /** [barat, selatan, timur, utara] */
  bbox: [number, number, number, number];
}

/** Kotak dalam koordinat lokal (meter): [minX, minY, maxX, maxY]. */
export type LocalBox = [number, number, number, number];

export interface SmokeFieldOptions {
  /** Batas raster tetap (koordinat lokal). Tanpa ini batas mengikuti sebaran asap. */
  extent?: LocalBox;
  /** Kosongkan piksel di dalam kotak ini (sudah digambar raster lain yang lebih rinci). */
  hole?: LocalBox;
}

/**
 * Raster konsentrasi asap pada langkah t untuk digambar di peta. Puff "dicap" ke piksel di sekitarnya
 * saja (±4σ), jadi cepat dihitung ulang setiap kali waktu digeser. Puff yang lebih sempit dari piksel
 * dilebarkan dengan massa tetap, agar kepulan sempit di dekat api tidak hilang di antara titik sampel.
 */
export function smokeField(m: SmokeModel, t: number, size = 112, opts: SmokeFieldOptions = {}): SmokeField | null {
  const kNow = kOfStep(m, t);
  const H = m.mixing[kNow];
  const live: { g: PuffGeom; amp: number }[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of m.puffs) {
    if (p.k >= kNow) continue;
    const g = puffGeom(p, m, kNow);
    const amp = (p.mass / (2 * Math.PI * g.sa * g.sc * H)) * 1e6;
    const r = 3 * g.sa;
    if (opts.extent) {
      const [ex0, ey0, ex1, ey1] = opts.extent;
      if (g.x + r < ex0 || g.x - r > ex1 || g.y + r < ey0 || g.y - r > ey1) continue;
    }
    live.push({ g, amp });
    minX = Math.min(minX, g.x - r);
    maxX = Math.max(maxX, g.x + r);
    minY = Math.min(minY, g.y - r);
    maxY = Math.max(maxY, g.y + r);
  }
  if (!live.length) return null;
  if (opts.extent) {
    [minX, minY, maxX, maxY] = opts.extent;
  } else {
    // Batasi luas raster (±400 km) agar resolusi tetap berguna.
    const LIM = 400_000;
    minX = Math.max(minX, -LIM);
    minY = Math.max(minY, -LIM);
    maxX = Math.min(maxX, LIM);
    maxY = Math.min(maxY, LIM);
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (!(spanX > 0 && spanY > 0)) return null;
  const w = spanX >= spanY ? size : Math.max(16, Math.round((size * spanX) / spanY));
  const h = spanY > spanX ? size : Math.max(16, Math.round((size * spanY) / spanX));
  const px = spanX / w;
  const py = spanY / h;
  const blur = (Math.max(px, py) * Math.max(px, py)) / 4;
  const values = new Float32Array(w * h);
  for (const { g: g0, amp: amp0 } of live) {
    // Lebarkan puff sempit ke ukuran piksel; amplitudo diturunkan agar massanya tetap.
    const sa = Math.sqrt(g0.sa * g0.sa + blur);
    const sc = Math.sqrt(g0.sc * g0.sc + blur);
    const amp = (amp0 * g0.sa * g0.sc) / (sa * sc);
    if (amp < SMOKE_THRESHOLDS.sedang * 0.1) continue;
    const g = { ...g0, sa, sc };
    const r = 4 * sa;
    const x0 = Math.max(0, Math.floor((g.x - r - minX) / px));
    const x1 = Math.min(w - 1, Math.ceil((g.x + r - minX) / px));
    const y0 = Math.max(0, Math.floor((maxY - (g.y + r)) / py));
    const y1 = Math.min(h - 1, Math.ceil((maxY - (g.y - r)) / py));
    for (let j = y0; j <= y1; j++) {
      const cy = maxY - (j + 0.5) * py;
      for (let i = x0; i <= x1; i++) values[j * w + i] += puffValue(g, amp, minX + (i + 0.5) * px, cy);
    }
  }
  if (opts.hole) {
    const [hx0, hy0, hx1, hy1] = opts.hole;
    for (let j = 0; j < h; j++) {
      const cy = maxY - (j + 0.5) * py;
      if (cy < hy0 || cy > hy1) continue;
      for (let i = 0; i < w; i++) {
        const cx = minX + (i + 0.5) * px;
        if (cx >= hx0 && cx <= hx1) values[j * w + i] = 0;
      }
    }
  }
  const [west, north] = toLonLat(m, minX, maxY);
  const [east, south] = toLonLat(m, maxX, minY);
  return { w, h, values, bbox: [west, south, east, north] };
}

/** Arah dan jarak asap terjauh (level "sedang" ke atas) pada langkah t. */
export function plumeReach(m: SmokeModel, t: number): { km: number; towardDeg: number } | null {
  const f = smokeField(m, t, 64);
  if (!f) return null;
  let best = 0;
  let bx = 0;
  let by = 0;
  const [w, s, e, n] = f.bbox;
  for (let j = 0; j < f.h; j++) {
    for (let i = 0; i < f.w; i++) {
      if (f.values[j * f.w + i] <= SMOKE_THRESHOLDS.sedang) continue;
      const lon = w + ((i + 0.5) / f.w) * (e - w);
      const lat = n - ((j + 0.5) / f.h) * (n - s);
      const [x, y] = toLocal(m, lon, lat);
      const d = Math.hypot(x, y);
      if (d > best) {
        best = d;
        bx = x;
        by = y;
      }
    }
  }
  if (best === 0) return null;
  return { km: best / 1000, towardDeg: ((Math.atan2(bx, by) * 180) / Math.PI + 360) % 360 };
}
