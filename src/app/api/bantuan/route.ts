import type { NextRequest } from 'next/server';
import { type BantuanResponse, km, type ServiceKind, type ServicePoint, type WaterKind, type WaterPoint } from '@/lib/bantuan';
import { fetchWithTimeout } from '@/lib/data/fallback';
import { apiError } from '@/lib/schemas';

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const ESRI = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
const UA = 'ApiRimbaAI/1.0 (simulasi karhutla)';

/** Radius pencarian: air ±10 km, layanan ±30 km. */
const WATER_DEG = 0.09;
const SERVICE_DEG = 0.27;
const WATER_KM = 10;
const SERVICE_KM = 30;
/** Overpass ditunggu paling lama sekian; lewat dari itu dipakai hasil Esri yang berjalan paralel. */
const OVERPASS_DEADLINE_MS = 6500;

interface OsmEl {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
  members?: { geometry?: { lat: number; lon: number }[] }[];
  tags?: Record<string, string>;
}

interface Found {
  water: WaterPoint[];
  services: ServicePoint[];
}

function waterKind(t: Record<string, string>): WaterKind | null {
  if (t.waterway === 'river') return 'sungai';
  if (t.waterway === 'canal' || t.waterway === 'drain' || t.waterway === 'ditch') return 'kanal';
  if (t.emergency === 'fire_hydrant' || t.emergency === 'suction_point' || t.emergency === 'water_tank') return 'hidran';
  if (t.man_made === 'water_well' || t.man_made === 'water_tower' || t.man_made === 'reservoir_covered') return 'sumur';
  if (t.natural === 'water') return 'danau';
  return null;
}

function serviceKind(t: Record<string, string>): ServiceKind | null {
  switch (t.amenity) {
    case 'fire_station':
      return 'damkar';
    case 'police':
      return 'polisi';
    case 'hospital':
      return 'rumah_sakit';
    case 'clinic':
    case 'doctors':
      return 'puskesmas';
    case 'townhall':
      return 'kantor_desa';
    default:
      return null;
  }
}

/** Titik terdekat dari sebuah fitur ke (lat, lon), memakai simpul geometrinya. */
function nearest(el: OsmEl, lat: number, lon: number): { lat: number; lon: number; d: number } | null {
  const pts = el.geometry ?? el.members?.flatMap((m) => m.geometry ?? []) ?? [];
  const cand = pts.length ? pts : el.lat !== undefined && el.lon !== undefined ? [{ lat: el.lat, lon: el.lon }] : el.center ? [el.center] : [];
  let best: { lat: number; lon: number; d: number } | null = null;
  for (const p of cand) {
    const d = km(lat, lon, p.lat, p.lon);
    if (!best || d < best.d) best = { lat: p.lat, lon: p.lon, d };
  }
  return best;
}

const round = (v: number, step = 0.01) => Math.round(v / step) * step;
const km1 = (d: number) => Math.round(d * 10) / 10;

/** Air: terdekat dulu, satu entri per nama (sungai panjang terpecah jadi banyak ruas). Layanan: dua terdekat per jenis. */
function tidy({ water, services }: Found): Found {
  water.sort((a, b) => a.distanceKm - b.distanceKm);
  const seen = new Set<string>();
  const waterTop = water
    .filter((w) => {
      const key = w.name ? `${w.kind}:${w.name.toLowerCase()}` : w.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
  services.sort((a, b) => a.distanceKm - b.distanceKm);
  const per = new Map<ServiceKind, number>();
  const serviceTop = services.filter((s) => {
    const n = per.get(s.kind) ?? 0;
    if (n >= 2) return false;
    per.set(s.kind, n + 1);
    return true;
  });
  return { water: waterTop, services: serviceTop };
}

/** OpenStreetMap lewat Overpass: paling lengkap (hidran, kanal, sumur), tetapi server publiknya sering penuh. */
async function fromOverpass(lat: number, lon: number): Promise<Found> {
  const la = round(lat);
  const lo = round(lon);
  const wb = `${la - WATER_DEG},${lo - WATER_DEG},${la + WATER_DEG},${lo + WATER_DEG}`;
  const sb = `${la - SERVICE_DEG},${lo - SERVICE_DEG},${la + SERVICE_DEG},${lo + SERVICE_DEG}`;
  const q = `[out:json][timeout:20];
(
  way["waterway"~"^(river|canal|drain|ditch)$"](${wb});
  nwr["natural"="water"](${wb});
  nwr["man_made"~"^(water_well|water_tower|reservoir_covered)$"](${wb});
  node["emergency"~"^(fire_hydrant|suction_point|water_tank)$"](${wb});
)->.w;
.w out geom(${wb}) 400;
nwr["amenity"~"^(fire_station|police|hospital|clinic|doctors|townhall)$"](${sb});
out center tags 300;`;

  const json = await Promise.any(
    MIRRORS.map(async (m) => {
      const res = await fetchWithTimeout(
        m,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
          body: `data=${encodeURIComponent(q)}`,
          next: { revalidate: 604800 },
        },
        OVERPASS_DEADLINE_MS,
      );
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      const body = (await res.json()) as { elements?: OsmEl[] };
      if (!Array.isArray(body.elements)) throw new Error('overpass: no elements');
      return body;
    }),
  );

  const water: WaterPoint[] = [];
  const services: ServicePoint[] = [];
  for (const el of json.elements ?? []) {
    const t = el.tags ?? {};
    const sk = serviceKind(t);
    const wk = sk ? null : waterKind(t);
    if (!sk && !wk) continue;
    const p = nearest(el, lat, lon);
    if (!p) continue;
    const id = `${el.type[0]}${el.id}`;
    if (sk) {
      services.push({
        id,
        kind: sk,
        name: t.name ?? t['name:id'] ?? '',
        lat: p.lat,
        lon: p.lon,
        distanceKm: km1(p.d),
        phone: t.phone ?? t['contact:phone'] ?? t['phone:mobile'] ?? null,
      });
    } else if (wk) {
      water.push({ id, kind: wk, name: t.name ?? '', lat: p.lat, lon: p.lon, distanceKm: km1(p.d) });
    }
  }
  return tidy({ water, services });
}

interface EsriCandidate {
  location?: { x: number; y: number };
  attributes?: { PlaceName?: string; Type?: string; Phone?: string };
}

/** Jenis air dari kategori Esri; laut/teluk dibuang karena tidak bisa dipakai memadamkan api gambut. */
function esriWaterKind(type: string): WaterKind | null {
  if (/sea|ocean|bay|strait|gulf|harbor|harbour|waterfall/i.test(type)) return null;
  if (/canal|ditch|drain/i.test(type)) return 'kanal';
  if (/lake|reservoir|pond|lagoon|swamp|marsh/i.test(type)) return 'danau';
  if (/well|spring/i.test(type)) return 'sumur';
  return 'sungai';
}

/**
 * Cadangan: ArcGIS World Geocoder (Esri), pencarian kategori di sekitar titik. Cepat (sekitar 1 detik)
 * dan berisi sungai bernama, pemadam kebakaran, rumah sakit, dan polisi. Tidak butuh kunci untuk pencarian.
 */
async function fromEsri(lat: number, lon: number): Promise<Found> {
  const cats: { category: string; kind: WaterKind | ServiceKind | 'water'; max: number }[] = [
    { category: 'Water Features', kind: 'water', max: 20 },
    { category: 'Fire Station', kind: 'damkar', max: 6 },
    { category: 'Hospital', kind: 'rumah_sakit', max: 6 },
    { category: 'Police Station', kind: 'polisi', max: 6 },
  ];
  const replies = await Promise.allSettled(
    cats.map(async (c) => {
      const url = `${ESRI}?f=json&category=${encodeURIComponent(c.category)}&location=${lon},${lat}&maxLocations=${c.max}&outFields=PlaceName,Type,Phone&langCode=id`;
      const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA }, next: { revalidate: 86400 } }, 6000);
      if (!res.ok) throw new Error(`esri ${res.status}`);
      const body = (await res.json()) as { candidates?: EsriCandidate[]; error?: unknown };
      if (body.error) throw new Error('esri error');
      return body.candidates ?? [];
    }),
  );
  const water: WaterPoint[] = [];
  const services: ServicePoint[] = [];
  replies.forEach((reply, i) => {
    if (reply.status !== 'fulfilled') return;
    const c = cats[i];
    reply.value.forEach((cand, k) => {
      const pLon = cand.location?.x;
      const pLat = cand.location?.y;
      if (typeof pLat !== 'number' || typeof pLon !== 'number') return;
      const d = km(lat, lon, pLat, pLon);
      const name = cand.attributes?.PlaceName ?? '';
      const id = `e${i}-${k}`;
      if (c.kind === 'water') {
        const wk = esriWaterKind(cand.attributes?.Type ?? '');
        if (wk && d <= WATER_KM) water.push({ id, kind: wk, name, lat: pLat, lon: pLon, distanceKm: km1(d) });
      } else if (d <= SERVICE_KM) {
        services.push({ id, kind: c.kind as ServiceKind, name, lat: pLat, lon: pLon, distanceKm: km1(d), phone: cand.attributes?.Phone || null });
      }
    });
  });
  if (replies.every((r) => r.status === 'rejected')) throw new Error('esri unavailable');
  return tidy({ water, services });
}

/** Menunggu janji paling lama `ms`; null bila gagal atau terlambat. */
function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

/**
 * Sumber air dan layanan terdekat untuk satu titik api.
 * GET /api/bantuan?lat=0.45&lon=102.0
 * Overpass (OpenStreetMap) dan Esri dijalankan paralel. Overpass diutamakan bila menjawab tepat waktu;
 * bagian yang kosong atau gagal diisi dari Esri, sehingga pengguna tetap mendapat hasil saat Overpass penuh.
 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lon = Number(req.nextUrl.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 15 || lon < 90 || lon > 145) {
    return apiError('bad_request', 'Parameter lat/lon tidak valid.', 400);
  }

  const overpass = fromOverpass(lat, lon);
  const esri = fromEsri(lat, lon);
  const [osm, alt] = await Promise.all([within(overpass, OVERPASS_DEADLINE_MS + 500), within(esri, 7000)]);

  if (osm || alt) {
    const water = osm?.water.length ? osm.water : (alt?.water ?? []);
    const services = osm?.services.length ? osm.services : (alt?.services ?? []);
    const usedOsm = Boolean(osm && (osm.water.length || osm.services.length)) || !alt;
    const body: BantuanResponse = { source: usedOsm ? 'osm' : 'esri', lat, lon, water, services };
    // Hasil OSM boleh disimpan seminggu; hasil Esri cukup sehari.
    const maxAge = usedOsm ? 604800 : 86400;
    return Response.json(body, { headers: { 'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=86400` } });
  }

  const body: BantuanResponse = {
    source: 'none',
    lat,
    lon,
    water: [],
    services: [],
    note: 'Layanan peta sedang penuh. Nomor darurat di bawah tetap bisa dipakai.',
  };
  return Response.json(body, { headers: { 'Cache-Control': 'public, s-maxage=300' } });
}
