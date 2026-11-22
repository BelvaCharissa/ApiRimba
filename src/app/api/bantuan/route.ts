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
/** Radius pencarian: air ±10 km, layanan ±30 km. */
const WATER_DEG = 0.09;
const SERVICE_DEG = 0.27;

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

/**
 * Sumber air dan layanan terdekat dari OpenStreetMap untuk satu titik api.
 * GET /api/bantuan?lat=0.45&lon=102.0
 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lon = Number(req.nextUrl.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 15 || lon < 90 || lon > 145) {
    return apiError('bad_request', 'Parameter lat/lon tidak valid.', 400);
  }
  // dibulatkan ±1 km agar hasil bisa di-cache bersama
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

  const requests = MIRRORS.map(async (m) => {
    const res = await fetchWithTimeout(
      m,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ApiRimbaAI/1.0 (simulasi karhutla)' },
        body: `data=${encodeURIComponent(q)}`,
        next: { revalidate: 604800 },
      },
      7000,
    );
    if (!res.ok) throw new Error(`overpass ${res.status}`);
    return (await res.json()) as { elements?: OsmEl[] };
  });

  const replies = await Promise.allSettled(requests);
  for (const reply of replies) {
    if (reply.status !== 'fulfilled') continue;
    try {
      const json = reply.value;
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
            distanceKm: Math.round(p.d * 10) / 10,
            phone: t.phone ?? t['contact:phone'] ?? t['phone:mobile'] ?? null,
          });
        } else if (wk) {
          water.push({ id, kind: wk, name: t.name ?? '', lat: p.lat, lon: p.lon, distanceKm: Math.round(p.d * 10) / 10 });
        }
      }

      // air: terdekat dulu, satu entri per nama (sungai panjang terpecah jadi banyak ruas)
      water.sort((a, b) => a.distanceKm - b.distanceKm);
      const seen = new Set<string>();
      const waterTop = water
        .filter((w) => {
          const key = w.name ? `${w.kind}:${w.name}` : w.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 6);

      // layanan: dua terdekat per jenis, yang bernama didahulukan
      services.sort((a, b) => a.distanceKm - b.distanceKm);
      const per = new Map<ServiceKind, number>();
      const serviceTop = services.filter((s) => {
        const n = per.get(s.kind) ?? 0;
        if (n >= 2) return false;
        per.set(s.kind, n + 1);
        return true;
      });

      const body: BantuanResponse = { source: 'osm', lat, lon, water: waterTop, services: serviceTop };
      return Response.json(body, { headers: { 'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400' } });
    } catch {
      // coba server berikutnya
    }
  }
  const body: BantuanResponse = {
    source: 'none',
    lat,
    lon,
    water: [],
    services: [],
    note: 'Server OpenStreetMap sedang penuh. Nomor darurat di bawah tetap bisa dipakai.',
  };
  return Response.json(body, { headers: { 'Cache-Control': 'public, s-maxage=300' } });
}
