/**
 * Membuat data skenario demo:
 *  - public/data/scenarios/{slug}.json   grid 64x64 (tutupan lahan, elevasi, gambut, desa, titik awal)
 *  - public/data/fallback/hotspots-{slug}.json, weather-{slug}.json
 *  - supabase/seed.sql
 *
 * Lanskap bersifat ILUSTRASI (sintetis, deterministik), bukan data resmi.
 * Jalankan: npx tsx scripts/build-scenario-grid.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCENARIOS, type ScenarioData } from '../src/lib/scenario';
import { DEFAULT_SEED } from '../src/lib/sim/params';
import { mulberry32 } from '../src/lib/sim/rng';
import { Fuel, type GridSpec, type VillageInput } from '../src/lib/sim/types';

const W = 64;
const H = 64;
const CELL_M = 250;
const ROOT = join(__dirname, '..');

interface Ellipse {
  name: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
  moisture: number;
}

interface Config {
  slug: string;
  description: string;
  ignition: [number, number];
  villages: { name: string; bearing: number; km: number; pop: number }[];
  peat: Ellipse[];
  river: { name: string; pts: [number, number][]; width: number };
  plantations: [number, number, number, number][];
  dryness: number;
  hotspotTime: string;
}

const CONFIGS: Config[] = [
  {
    slug: 'riau',
    description:
      'Beberapa titik panas di kubah gambut kering. Angin barat daya mendorong api ke arah dua desa.',
    ignition: [24, 40],
    villages: [
      { name: 'Sungai Buluh', bearing: 45, km: 4, pop: 900 },
      { name: 'Tanjung Harapan', bearing: 90, km: 7, pop: 1200 },
      { name: 'Pematang Baru', bearing: 225, km: 5, pop: 700 },
      { name: 'Kuala Lama', bearing: 0, km: 6, pop: 500 },
    ],
    peat: [
      { name: 'Kubah Gambut Buluh', cx: 30, cy: 34, rx: 17, ry: 10, rot: -40, moisture: 0.22 },
      { name: 'Gambut Harapan', cx: 46, cy: 40, rx: 9, ry: 6, rot: 10, moisture: 0.35 },
    ],
    river: { name: 'Sungai Siak Kecil (ilustrasi)', pts: [[4, 0], [7, 16], [5, 30], [9, 46], [6, 63]], width: 2 },
    plantations: [[44, 50, 58, 60], [40, 6, 54, 14]],
    dryness: 0.78,
    hotspotTime: '2026-11-12T05:42:00Z',
  },
  {
    slug: 'kalteng',
    description:
      'Lahan gambut eks proyek lahan sejuta hektare dengan kanal. Angin timur membawa api ke barat.',
    ignition: [40, 32],
    villages: [
      { name: 'Telaga Kencana', bearing: 270, km: 5, pop: 800 },
      { name: 'Pulau Nyiur', bearing: 315, km: 7, pop: 650 },
      { name: 'Bukit Raya Baru', bearing: 90, km: 5, pop: 1100 },
      { name: 'Sei Gambut', bearing: 180, km: 6, pop: 550 },
    ],
    peat: [
      { name: 'Blok Gambut C', cx: 30, cy: 30, rx: 19, ry: 11, rot: 15, moisture: 0.2 },
      { name: 'Gambut Kanal Utara', cx: 24, cy: 14, rx: 10, ry: 7, rot: -20, moisture: 0.3 },
    ],
    river: { name: 'Sungai Kahayan (ilustrasi)', pts: [[0, 60], [18, 57], [34, 61], [50, 58], [63, 61]], width: 2 },
    plantations: [[50, 40, 62, 50]],
    dryness: 0.8,
    hotspotTime: '2026-11-12T06:10:00Z',
  },
  {
    slug: 'sumsel',
    description:
      'Gambut pesisir timur Sumatera Selatan. Angin tenggara mengarahkan api ke barat laut.',
    ignition: [38, 38],
    villages: [
      { name: 'Air Hitam Jaya', bearing: 315, km: 4, pop: 750 },
      { name: 'Mekar Sari', bearing: 0, km: 7, pop: 980 },
      { name: 'Pasir Putih', bearing: 135, km: 5, pop: 600 },
      { name: 'Lubuk Rawa', bearing: 90, km: 6, pop: 520 },
    ],
    peat: [
      { name: 'Gambut Air Hitam', cx: 32, cy: 30, rx: 16, ry: 10, rot: 45, moisture: 0.24 },
      { name: 'Gambut Mekar', cx: 38, cy: 14, rx: 9, ry: 7, rot: 0, moisture: 0.33 },
    ],
    river: { name: 'Sungai Lumpur (ilustrasi)', pts: [[63, 4], [56, 14], [60, 24], [54, 30], [63, 34]], width: 2 },
    plantations: [[6, 44, 20, 58]],
    dryness: 0.74,
    hotspotTime: '2026-11-12T05:55:00Z',
  },
];

function valueNoise(seed: number, scale: number): (x: number, y: number) => number {
  const rng = mulberry32(seed);
  const gw = Math.ceil(W / scale) + 2;
  const gh = Math.ceil(H / scale) + 2;
  const g = Array.from({ length: gw * gh }, () => rng());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / scale;
    const fy = y / scale;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = smooth(fx - x0);
    const ty = smooth(fy - y0);
    const v = (ix: number, iy: number) => g[iy * gw + ix];
    const a = v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx;
    const b = v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
}

function inEllipse(e: Ellipse, x: number, y: number): number {
  const r = (e.rot * Math.PI) / 180;
  const dx = x - e.cx;
  const dy = y - e.cy;
  const u = dx * Math.cos(r) + dy * Math.sin(r);
  const v = -dx * Math.sin(r) + dy * Math.cos(r);
  return (u * u) / (e.rx * e.rx) + (v * v) / (e.ry * e.ry);
}

function distToSegment(px: number, py: number, a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

function build(cfg: Config): ScenarioData {
  const meta = SCENARIOS.find((s) => s.slug === cfg.slug)!;
  const cellDegLat = CELL_M / 111320;
  const cellDegLon = CELL_M / (111320 * Math.cos((meta.center[1] * Math.PI) / 180));
  const grid: GridSpec = {
    w: W,
    h: H,
    cellSizeM: CELL_M,
    originLon: round(meta.center[0] - (W / 2) * cellDegLon, 6),
    originLat: round(meta.center[1] + (H / 2) * cellDegLat, 6),
    cellDegLon: round(cellDegLon, 8),
    cellDegLat: round(cellDegLat, 8),
  };
  const toLonLat = (x: number, y: number): [number, number] => [
    round(grid.originLon + x * grid.cellDegLon, 6),
    round(grid.originLat - y * grid.cellDegLat, 6),
  ];
  const seedBase = [...cfg.slug].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0;
  const n1 = valueNoise(seedBase, 9);
  const n2 = valueNoise(seedBase + 1, 4);
  const hills = valueNoise(seedBase + 2, 16);

  const fuel: number[] = [];
  const elev: number[] = [];
  const peat: number[] = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = 0.7 * n1(x, y) + 0.3 * n2(x, y);
      let cls: number;
      if (n < 0.14) cls = Fuel.OPEN;
      else if (n < 0.48) cls = Fuel.SHRUB;
      else if (n < 0.74) cls = Fuel.SECONDARY_FOREST;
      else cls = Fuel.PRIMARY_FOREST;

      for (const [x0, y0, x1, y1] of cfg.plantations) {
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) cls = Fuel.PLANTATION;
      }

      let m = -1;
      for (const e of cfg.peat) {
        const d = inEllipse(e, x, y);
        if (d <= 1) {
          cls = Fuel.PEAT;
          const local = round(Math.min(0.95, Math.max(0.05, e.moisture + (n2(x, y) - 0.5) * 0.16 + d * 0.06)), 2);
          m = m < 0 ? local : Math.min(m, local);
        }
      }

      for (let s = 0; s < cfg.river.pts.length - 1; s++) {
        if (distToSegment(x + 0.5, y + 0.5, cfg.river.pts[s], cfg.river.pts[s + 1]) < cfg.river.width / 2 + 0.2) {
          cls = Fuel.WATER;
          m = -1;
        }
      }

      fuel.push(cls);
      peat.push(m);
      // gambut relatif datar; tanah mineral sedikit berbukit
      const base = 8 + hills(x, y) * 30;
      elev.push(Math.round(cls === Fuel.PEAT ? base * 0.5 + 4 : cls === Fuel.WATER ? 2 : base));
    }
  }

  const villages: VillageInput[] = cfg.villages.map((v) => {
    const cells = (v.km * 1000) / CELL_M;
    const b = (v.bearing * Math.PI) / 180;
    const vx = Math.round(cfg.ignition[0] + Math.sin(b) * cells);
    const vy = Math.round(cfg.ignition[1] - Math.cos(b) * cells);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const i = (vy + dy) * W + (vx + dx);
        if (fuel[i] !== Fuel.WATER) {
          fuel[i] = Fuel.SETTLEMENT;
          peat[i] = -1;
        }
      }
    }
    const [lon, lat] = toLonLat(vx + 0.5, vy + 0.5);
    return { name: v.name, lon, lat, cell: vy * W + vx, population: v.pop };
  });

  const [ix, iy] = cfg.ignition;
  const ignitions = [iy * W + ix, (iy - 1) * W + (ix + 1), (iy + 1) * W + (ix - 1)];
  for (const i of ignitions) {
    if (fuel[i] === Fuel.WATER || fuel[i] === Fuel.SETTLEMENT) fuel[i] = Fuel.PEAT;
  }

  const peatZones: ScenarioData['peatZones'] = {
    type: 'FeatureCollection',
    features: cfg.peat.map((e) => {
      const ring: [number, number][] = [];
      const r = (e.rot * Math.PI) / 180;
      for (let k = 0; k <= 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        const u = Math.cos(a) * e.rx;
        const v = Math.sin(a) * e.ry;
        const x = e.cx + u * Math.cos(r) - v * Math.sin(r);
        const y = e.cy + u * Math.sin(r) + v * Math.cos(r);
        ring.push(toLonLat(Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))));
      }
      ring[ring.length - 1] = ring[0];
      return {
        type: 'Feature',
        properties: { name: e.name, moisture: e.moisture },
        geometry: { type: 'Polygon', coordinates: [ring] },
      };
    }),
  };

  const rivers: ScenarioData['rivers'] = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: cfg.river.name },
        geometry: { type: 'LineString', coordinates: cfg.river.pts.map(([x, y]) => toLonLat(x, y)) },
      },
    ],
  };

  return {
    slug: meta.slug,
    name: meta.name,
    province: meta.province,
    description: cfg.description,
    center: meta.center,
    bbox: [toLonLat(0, H)[0], toLonLat(0, H)[1], toLonLat(W, 0)[0], toLonLat(W, 0)[1]],
    grid,
    defaultWindMs: meta.defaultWindMs,
    defaultWindFromDeg: meta.defaultWindFromDeg,
    defaultSeed: DEFAULT_SEED,
    defaultDryness: cfg.dryness,
    fuelClass: fuel,
    elevation: elev,
    peatMoisture: peat,
    ignitions,
    villages,
    peatZones,
    rivers,
  };
}

function fallbackHotspots(cfg: Config, data: ScenarioData) {
  const rng = mulberry32(99 + data.ignitions[0]);
  const base = Date.parse(cfg.hotspotTime);
  const items: Record<string, unknown>[] = [];
  const [ix, iy] = cfg.ignition;
  const pts: [number, number, 'high' | 'nominal' | 'low'][] = [
    [ix, iy, 'high'],
    [ix + 1, iy - 1, 'high'],
    [ix - 1, iy + 1, 'nominal'],
  ];
  for (let k = 0; k < 6; k++) {
    pts.push([Math.floor(6 + rng() * 52), Math.floor(6 + rng() * 52), rng() < 0.5 ? 'low' : 'nominal']);
  }
  pts.forEach(([x, y, conf], k) => {
    const lon = round(data.grid.originLon + (x + 0.5) * data.grid.cellDegLon, 5);
    const lat = round(data.grid.originLat - (y + 0.5) * data.grid.cellDegLat, 5);
    items.push({
      id: `${data.slug}_fb_${k + 1}`,
      lat,
      lon,
      acquiredAt: new Date(base - k * 47 * 60000).toISOString(),
      confidence: conf,
      frp: round(conf === 'high' ? 14 + rng() * 20 : 2 + rng() * 9, 1),
      satellite: k % 2 === 0 ? 'VIIRS_SNPP' : 'VIIRS_NOAA20',
    });
  });
  return { source: 'fallback', fetchedAt: cfg.hotspotTime, stale: true, items };
}

function fallbackWeather(cfg: Config, data: ScenarioData) {
  return {
    source: 'fallback',
    fetchedAt: cfg.hotspotTime,
    stale: true,
    windMs: data.defaultWindMs,
    windFromDeg: data.defaultWindFromDeg,
    tempC: 33.5,
    rhPct: 52,
    rain7dMm: 4.2,
    rain14dMm: 18.6,
    dryness: data.defaultDryness,
  };
}

function sqlStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function seedSql(all: ScenarioData[]): string {
  const out: string[] = [
    '-- Dibuat oleh scripts/build-scenario-grid.ts. Data demo (ilustrasi, desa fiktif).',
    'set search_path = public, extensions;',
    '',
  ];
  for (const d of all) {
    const [w, s, e, n] = d.bbox;
    out.push(
      `insert into scenarios (slug, name, province, description, center, bbox, grid_w, grid_h, cell_size_m, origin_lon, origin_lat, default_wind_ms, default_wind_from_deg, default_seed, grid_url)
values (${sqlStr(d.slug)}, ${sqlStr(d.name)}, ${sqlStr(d.province)}, ${sqlStr(d.description)},
  ST_SetSRID(ST_MakePoint(${d.center[0]}, ${d.center[1]}), 4326)::geography,
  ST_MakeEnvelope(${w}, ${s}, ${e}, ${n}, 4326), ${d.grid.w}, ${d.grid.h}, ${d.grid.cellSizeM}, ${d.grid.originLon}, ${d.grid.originLat},
  ${d.defaultWindMs}, ${d.defaultWindFromDeg}, ${d.defaultSeed}, '/data/scenarios/${d.slug}.json')
on conflict (slug) do update set name = excluded.name, description = excluded.description, center = excluded.center,
  bbox = excluded.bbox, origin_lon = excluded.origin_lon, origin_lat = excluded.origin_lat,
  default_wind_ms = excluded.default_wind_ms, default_wind_from_deg = excluded.default_wind_from_deg;`,
    );
    const vals = d.villages
      .map((v) => `(${sqlStr(v.name)}, ${v.lon}, ${v.lat}, ${v.population})`)
      .join(',\n         ');
    out.push(
      `insert into villages (scenario_id, name, location, population_est)
select s.id, v.name, ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)::geography, v.pop
from scenarios s, (values ${vals}) as v(name, lon, lat, pop)
where s.slug = ${sqlStr(d.slug)}
on conflict (scenario_id, name) do update set location = excluded.location, population_est = excluded.population_est;`,
    );
    out.push(`delete from peat_zones where scenario_id = (select id from scenarios where slug = ${sqlStr(d.slug)});`);
    for (const f of d.peatZones.features) {
      out.push(
        `insert into peat_zones (scenario_id, name, geom, moisture_index)
select id, ${sqlStr(f.properties.name)}, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${sqlStr(JSON.stringify(f.geometry))}), 4326)), ${f.properties.moisture}
from scenarios where slug = ${sqlStr(d.slug)};`,
      );
    }
    out.push('');
  }
  return out.join('\n');
}

function main() {
  const dirs = ['public/data/scenarios', 'public/data/fallback', 'supabase'];
  for (const d of dirs) mkdirSync(join(ROOT, d), { recursive: true });
  const all: ScenarioData[] = [];
  for (const cfg of CONFIGS) {
    const data = build(cfg);
    all.push(data);
    writeFileSync(join(ROOT, `public/data/scenarios/${data.slug}.json`), JSON.stringify(data));
    writeFileSync(join(ROOT, `public/data/fallback/hotspots-${data.slug}.json`), JSON.stringify(fallbackHotspots(cfg, data), null, 2));
    writeFileSync(join(ROOT, `public/data/fallback/weather-${data.slug}.json`), JSON.stringify(fallbackWeather(cfg, data), null, 2));
    console.log(`✓ ${data.slug}: ${data.villages.map((v) => v.name).join(', ')}`);
  }
  writeFileSync(join(ROOT, 'supabase/seed.sql'), seedSql(all));
  console.log('✓ supabase/seed.sql');
}

main();
