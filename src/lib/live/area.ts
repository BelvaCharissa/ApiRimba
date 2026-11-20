/**
 * Bangun area simulasi 16 x 16 km di sekitar titik panas mana pun di Indonesia dari data nyata:
 *  - tutupan lahan Sentinel-2 10 m (Esri Land Cover) -> kelas bahan bakar
 *  - elevasi DEM (tile terrarium AWS)
 *  - desa dari OpenStreetMap; bila tidak tersedia, kelompok permukiman dari citra
 *  - gambut diperkirakan: dataran rendah (< 25 m) bervegetasi di Sumatra, Kalimantan, Papua
 *  - kelembapan gambut dari indeks kekeringan cuaca langsung
 * Berjalan di peramban (memakai canvas untuk membaca gambar).
 */
import type { ScenarioData } from '../scenario';
import { Fuel, type GridSpec, type VillageInput } from '../sim/types';

const N = 64;
const CELL_M = 250;

/** Warna kelas Esri Land Cover -> kelas bahan bakar. */
const PALETTE: { rgb: [number, number, number]; cls: 'water' | 'trees' | 'flooded' | 'crops' | 'built' | 'bare' | 'snow' | 'clouds' | 'range' }[] = [
  { rgb: [26, 91, 171], cls: 'water' },
  { rgb: [53, 130, 33], cls: 'trees' },
  { rgb: [135, 209, 158], cls: 'flooded' },
  { rgb: [255, 219, 92], cls: 'crops' },
  { rgb: [237, 2, 42], cls: 'built' },
  { rgb: [237, 233, 228], cls: 'bare' },
  { rgb: [242, 250, 255], cls: 'snow' },
  { rgb: [200, 200, 200], cls: 'clouds' },
  { rgb: [239, 207, 168], cls: 'range' },
];
type LcClass = (typeof PALETTE)[number]['cls'];

/** Wilayah gambut utama (kasar): Sumatra timur, Kalimantan, Papua selatan. */
const PEAT_REGIONS: [number, number, number, number][] = [
  [98, -5, 106.5, 3.5],
  [108, -4.5, 119.5, 4.5],
  [130, -9.5, 141.5, -0.5],
];

export interface LiveRequest {
  lat: number;
  lon: number;
  /** Titik panas (lon, lat) yang menjadi titik awal api. */
  ignitions: [number, number][];
  province: string;
  /** Kekeringan 0..1 dari cuaca langsung. */
  dryness: number;
  windMs: number;
  windFromDeg: number;
  onStep?: (label: string) => void;
}

export function liveGrid(lat: number, lon: number): GridSpec {
  const cellDegLat = CELL_M / 1000 / 111.32;
  const cellDegLon = CELL_M / 1000 / (111.32 * Math.cos((lat * Math.PI) / 180));
  return {
    w: N,
    h: N,
    cellSizeM: CELL_M,
    originLon: lon - (N / 2) * cellDegLon,
    originLat: lat + (N / 2) * cellDegLat,
    cellDegLon,
    cellDegLat,
  };
}

export function gridBbox(g: GridSpec): [number, number, number, number] {
  return [g.originLon, g.originLat - g.h * g.cellDegLat, g.originLon + g.w * g.cellDegLon, g.originLat];
}

async function loadImage(url: string): Promise<ImageData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  const bmp = await createImageBitmap(await res.blob());
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, bmp.width, bmp.height);
}

function nearestClass(r: number, g: number, b: number): LcClass {
  let best: LcClass = 'range';
  let bd = Infinity;
  for (const p of PALETTE) {
    const d = (p.rgb[0] - r) ** 2 + (p.rgb[1] - g) ** 2 + (p.rgb[2] - b) ** 2;
    if (d < bd) {
      bd = d;
      best = p.cls;
    }
  }
  return best;
}

async function landcover(g: GridSpec): Promise<LcClass[] | null> {
  try {
    const img = await loadImage(`/api/area/landcover?bbox=${gridBbox(g).map((v) => v.toFixed(5)).join(',')}`);
    const f = img.width / N;
    const out: LcClass[] = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const count = new Map<LcClass, number>();
        for (let dy = 0; dy < f; dy++) {
          for (let dx = 0; dx < f; dx++) {
            const px = Math.min(img.width - 1, Math.floor(x * f + dx));
            const py = Math.min(img.height - 1, Math.floor(y * f + dy));
            const o = (py * img.width + px) * 4;
            if (img.data[o + 3] < 10) continue;
            const c = nearestClass(img.data[o], img.data[o + 1], img.data[o + 2]);
            count.set(c, (count.get(c) ?? 0) + 1);
          }
        }
        let best: LcClass = 'range';
        let bn = -1;
        for (const [c, n] of count) if (n > bn) {
          bn = n;
          best = c;
        }
        out.push(best);
      }
    }
    return out;
  } catch {
    return null;
  }
}

async function elevation(g: GridSpec): Promise<number[]> {
  const z = 12;
  const scale = 256 * 2 ** z;
  const toPx = (lon: number, lat: number) => {
    const x = ((lon + 180) / 360) * scale;
    const s = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
    return [x, y];
  };
  const tiles = new Map<string, Promise<ImageData | null>>();
  const tile = (tx: number, ty: number) => {
    const k = `${tx}/${ty}`;
    if (!tiles.has(k)) {
      tiles.set(
        k,
        loadImage(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx}/${ty}.png`).catch(() => null),
      );
    }
    return tiles.get(k)!;
  };
  const out: number[] = new Array(N * N).fill(0);
  const jobs: Promise<void>[] = [];
  for (let i = 0; i < N * N; i++) {
    const x = i % N;
    const y = (i - x) / N;
    const lon = g.originLon + (x + 0.5) * g.cellDegLon;
    const lat = g.originLat - (y + 0.5) * g.cellDegLat;
    const [px, py] = toPx(lon, lat);
    const tx = Math.floor(px / 256);
    const ty = Math.floor(py / 256);
    jobs.push(
      tile(tx, ty).then((img) => {
        if (!img) return;
        const ix = Math.floor(px - tx * 256);
        const iy = Math.floor(py - ty * 256);
        const o = (iy * 256 + ix) * 4;
        out[i] = Math.round(img.data[o] * 256 + img.data[o + 1] + img.data[o + 2] / 256 - 32768);
      }),
    );
  }
  await Promise.all(jobs);
  return out;
}

interface OsmVillage {
  name: string;
  lat: number;
  lon: number;
  place: string;
  population: number | null;
}

async function osmVillages(g: GridSpec): Promise<OsmVillage[]> {
  const [w, s, e, n] = gridBbox(g);
  try {
    const res = await fetch(`/api/area/desa?bbox=${[w, s, e, n].map((v) => v.toFixed(4)).join(',')}`);
    if (!res.ok) return [];
    return ((await res.json()) as { villages: OsmVillage[] }).villages;
  } catch {
    return [];
  }
}

function compass(dx: number, dy: number) {
  const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  return ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'][Math.round(deg / 45) % 8];
}

/** Hash deterministik kecil untuk variasi kelembapan gambut. */
function noise(i: number) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export async function buildLiveArea(req: LiveRequest): Promise<ScenarioData> {
  const g = liveGrid(req.lat, req.lon);
  const bbox = gridBbox(g);
  req.onStep?.('Membaca tutupan lahan dari citra Sentinel-2');
  const [lc, elev, osm] = await Promise.all([
    landcover(g),
    (async () => {
      const e = await elevation(g);
      req.onStep?.('Membaca elevasi dan mencari desa');
      return e;
    })(),
    osmVillages(g),
  ]);

  const inPeatRegion = PEAT_REGIONS.some(([w, s, e, n]) => req.lon >= w && req.lon <= e && req.lat >= s && req.lat <= n);
  const baseMoist = Math.max(0.05, Math.min(0.9, 0.88 - 0.75 * req.dryness));
  const fuelClass: number[] = [];
  const peatMoisture: number[] = [];
  let peatCells = 0;
  for (let i = 0; i < N * N; i++) {
    const c: LcClass = lc ? lc[i] : 'range';
    const low = elev[i] < 25;
    const peatLike = inPeatRegion && low && (c === 'trees' || c === 'flooded' || c === 'range' || c === 'crops');
    let f: number;
    switch (c) {
      case 'water':
        f = Fuel.WATER;
        break;
      case 'trees':
        f = peatLike ? Fuel.PEAT : elev[i] > 300 ? Fuel.PRIMARY_FOREST : Fuel.SECONDARY_FOREST;
        break;
      case 'flooded':
        f = peatLike ? Fuel.PEAT : Fuel.SHRUB;
        break;
      case 'crops':
        f = Fuel.PLANTATION;
        break;
      case 'built':
        f = Fuel.SETTLEMENT;
        break;
      case 'bare':
      case 'snow':
        f = Fuel.OPEN;
        break;
      default:
        f = peatLike ? Fuel.PEAT : Fuel.SHRUB;
    }
    fuelClass.push(f);
    if (peatLike && f !== Fuel.WATER) {
      peatCells++;
      const wet = c === 'flooded' ? 0.15 : 0;
      peatMoisture.push(Math.round(Math.max(0.03, Math.min(0.95, baseMoist + wet + (noise(i) - 0.5) * 0.12)) * 100) / 100);
    } else peatMoisture.push(-1);
  }

  // Titik awal api: sel titik panas (yang bukan air); geser ke sel darat terdekat bila perlu.
  const cellOf = (lon: number, lat: number) => {
    const x = Math.floor((lon - g.originLon) / g.cellDegLon);
    const y = Math.floor((g.originLat - lat) / g.cellDegLat);
    if (x < 2 || y < 2 || x >= N - 2 || y >= N - 2) return -1;
    return y * N + x;
  };
  const ign = new Set<number>();
  for (const [lon, lat] of req.ignitions) {
    const c = cellOf(lon, lat);
    if (c < 0) continue;
    if (fuelClass[c] !== Fuel.WATER) {
      ign.add(c);
      continue;
    }
    const cx = c % N;
    const cy = (c - cx) / N;
    let found = -1;
    for (let r = 1; r <= 3 && found < 0; r++) {
      for (let dy = -r; dy <= r && found < 0; dy++) for (let dx = -r; dx <= r && found < 0; dx++) {
        const k = (cy + dy) * N + cx + dx;
        if (fuelClass[k] !== undefined && fuelClass[k] !== Fuel.WATER) found = k;
      }
    }
    if (found >= 0) ign.add(found);
  }
  if (ign.size === 0) {
    const c = (N / 2) * N + N / 2;
    if (fuelClass[c] === Fuel.WATER) fuelClass[c] = Fuel.SHRUB;
    ign.add(c);
  }

  // Desa: OSM di dalam area; bila kosong, kelompok sel permukiman dari citra.
  const villages: VillageInput[] = [];
  const centerLonLat = (i: number): [number, number] => [g.originLon + ((i % N) + 0.5) * g.cellDegLon, g.originLat - (Math.floor(i / N) + 0.5) * g.cellDegLat];
  const seen = new Set<string>();
  const osmIn = osm
    .map((v) => ({ v, cell: cellOf(v.lon, v.lat) }))
    .filter((x) => x.cell >= 0 && !seen.has(x.v.name) && seen.add(x.v.name))
    .sort((a, b) => Math.hypot(a.v.lon - req.lon, a.v.lat - req.lat) - Math.hypot(b.v.lon - req.lon, b.v.lat - req.lat))
    .slice(0, 6);
  for (const { v, cell } of osmIn) {
    villages.push({ name: v.name, lon: v.lon, lat: v.lat, cell, population: v.population ?? (v.place === 'town' ? 8000 : v.place === 'hamlet' ? 400 : 1500) });
  }
  let villageSource: 'osm' | 'permukiman' = 'osm';
  if (villages.length === 0) {
    villageSource = 'permukiman';
    const seenCell = new Uint8Array(N * N);
    const groups: number[][] = [];
    for (let i = 0; i < N * N; i++) {
      if (fuelClass[i] !== Fuel.SETTLEMENT || seenCell[i]) continue;
      const q = [i];
      seenCell[i] = 1;
      const grp: number[] = [];
      while (q.length) {
        const c = q.pop()!;
        grp.push(c);
        const x = c % N;
        for (const k of [c - 1, c + 1, c - N, c + N]) {
          if (k < 0 || k >= N * N || seenCell[k] || fuelClass[k] !== Fuel.SETTLEMENT) continue;
          if ((k === c - 1 && x === 0) || (k === c + 1 && x === N - 1)) continue;
          seenCell[k] = 1;
          q.push(k);
        }
      }
      groups.push(grp);
    }
    groups.sort((a, b) => b.length - a.length);
    for (const grp of groups.slice(0, 4)) {
      const mid = grp[Math.floor(grp.length / 2)];
      const [lon, lat] = centerLonLat(mid);
      const dx = (lon - req.lon) * 111.32 * Math.cos((req.lat * Math.PI) / 180);
      const dy = (req.lat - lat) * 111.32;
      villages.push({
        name: `Permukiman ${compass(dx, dy)} (${Math.max(1, Math.round(Math.hypot(dx, dy)))} km)`,
        lon,
        lat,
        cell: mid,
        population: grp.length * 150,
      });
    }
  }

  // Titik sumber air dari sel air, berjarak minimal ±1 km.
  const waterPoints: { name: string; lon: number; lat: number }[] = [];
  for (let i = 0; i < N * N && waterPoints.length < 16; i++) {
    if (fuelClass[i] !== Fuel.WATER) continue;
    const [lon, lat] = centerLonLat(i);
    if (waterPoints.some((w) => Math.hypot((w.lon - lon) / g.cellDegLon, (w.lat - lat) / g.cellDegLat) < 4)) continue;
    waterPoints.push({ name: 'Sungai/kanal', lon, lat });
  }

  const near = villages[0]?.name;
  const counts = new Map<number, number>();
  for (const f of fuelClass) counts.set(f, (counts.get(f) ?? 0) + 1);
  const pct = (f: number) => Math.round(((counts.get(f) ?? 0) / (N * N)) * 100);
  const description = `Area 16 x 16 km di sekitar titik panas, dibangun dari citra nyata: perkebunan ${pct(Fuel.PLANTATION)}%, hutan ${
    pct(Fuel.SECONDARY_FOREST) + pct(Fuel.PRIMARY_FOREST)
  }%, gambut (perkiraan) ${pct(Fuel.PEAT)}%, semak ${pct(Fuel.SHRUB)}%, permukiman ${pct(Fuel.SETTLEMENT)}%.`;

  return {
    slug: 'live',
    name:
      villageSource === 'osm' && near
        ? `Sekitar ${near}`
        : `Titik panas ${Math.abs(req.lat).toFixed(2).replace('.', ',')}° ${req.lat >= 0 ? 'LU' : 'LS'}, ${req.lon.toFixed(2).replace('.', ',')}° BT`,
    province: req.province,
    description,
    center: [req.lon, req.lat],
    bbox,
    grid: g,
    defaultWindMs: req.windMs,
    defaultWindFromDeg: req.windFromDeg,
    defaultSeed: 20261112,
    defaultDryness: req.dryness,
    fuelClass,
    elevation: elev,
    peatMoisture,
    ignitions: [...ign].slice(0, 12),
    villages,
    peatZones: { type: 'FeatureCollection', features: [] },
    rivers: { type: 'FeatureCollection', features: [] },
    waterPoints,
    live: { builtAt: new Date().toISOString(), landcover: lc ? 'sentinel2' : 'none', villages: villageSource, peatEstimated: peatCells > 0 },
  };
}
