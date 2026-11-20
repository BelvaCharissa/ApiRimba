import provincesJson from '../../../public/data/provinces.json';
import { type CityAir, markPersistent, type NationalHotspots, type NationalWeather, type RawHotspot } from '../pantau';
import { SCENARIOS } from '../scenario';
import { fallbackHotspots, fetchWithTimeout } from './fallback';

/** Wilayah Indonesia (barat, selatan, timur, utara). */
const ID_BBOX = '94,-11.5,141.5,6.5';
const SOURCES = ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'VIIRS_SNPP_NRT', 'MODIS_NRT'];
const SAT_NAME: Record<string, string> = {
  VIIRS_NOAA20_NRT: 'NOAA-20 (VIIRS)',
  VIIRS_NOAA21_NRT: 'NOAA-21 (VIIRS)',
  VIIRS_SNPP_NRT: 'Suomi NPP (VIIRS)',
  MODIS_NRT: 'Terra/Aqua (MODIS)',
};

type Ring = number[][];
interface ProvFeature {
  properties: { name: string; bbox: number[] };
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
}
const PROVINCES = (provincesJson as unknown as { features: ProvFeature[] }).features;

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPoly(x: number, y: number, rings: Ring[]): boolean {
  if (!inRing(x, y, rings[0])) return false;
  for (let k = 1; k < rings.length; k++) if (inRing(x, y, rings[k])) return false;
  return true;
}

/** Nama provinsi untuk titik; null bila di luar daratan Indonesia (laut atau negara tetangga). */
export function provinceOf(lon: number, lat: number): string | null {
  // Toleransi 0,02° untuk garis pantai yang disederhanakan.
  const pad = 0.02;
  let near: { name: string; d: number } | null = null;
  for (const f of PROVINCES) {
    const [w, s, e, n] = f.properties.bbox;
    if (lon < w - pad || lon > e + pad || lat < s - pad || lat > n + pad) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of polys) {
      if (inPoly(lon, lat, p)) return f.properties.name;
    }
    for (const [dx, dy] of [
      [pad, 0],
      [-pad, 0],
      [0, pad],
      [0, -pad],
    ]) {
      for (const p of polys) {
        if (inPoly(lon + dx, lat + dy, p) && (!near || near.d > 1)) near = { name: f.properties.name, d: 1 };
      }
    }
  }
  return near?.name ?? null;
}

function parseCsv(csv: string, src: string): RawHotspot[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0].split(',');
  const col = (n: string) => head.indexOf(n);
  const iLat = col('latitude');
  const iLon = col('longitude');
  const iDate = col('acq_date');
  const iTime = col('acq_time');
  const iConf = col('confidence');
  const iFrp = col('frp');
  if (iLat < 0 || iLon < 0) return [];
  const out: RawHotspot[] = [];
  lines.slice(1).forEach((line, k) => {
    const c = line.split(',');
    const lat = Number(c[iLat]);
    const lon = Number(c[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const province = provinceOf(lon, lat);
    if (!province) return;
    const t = (c[iTime] ?? '0000').padStart(4, '0');
    const raw = (c[iConf] ?? 'n').toLowerCase();
    // MODIS memakai angka 0–100; VIIRS memakai l/n/h.
    const num = Number(raw);
    const confidence: RawHotspot['confidence'] = Number.isFinite(num)
      ? num >= 80
        ? 'high'
        : num >= 30
          ? 'nominal'
          : 'low'
      : raw.startsWith('h')
        ? 'high'
        : raw.startsWith('l')
          ? 'low'
          : 'nominal';
    out.push({
      id: `${src}_${c[iDate]}_${t}_${k}`,
      lat,
      lon,
      acquiredAt: `${c[iDate]}T${t.slice(0, 2)}:${t.slice(2)}:00Z`,
      confidence,
      frp: Number(c[iFrp] ?? 0) || 0,
      satellite: SAT_NAME[src] ?? src,
      province,
    });
  });
  return out;
}

function fallback(note: string): NationalHotspots {
  const items: RawHotspot[] = SCENARIOS.flatMap((s) =>
    fallbackHotspots(s.slug as 'riau' | 'kalteng' | 'sumsel', undefined, 3).items.map((h) => ({
      ...h,
      province: provinceOf(h.lon, h.lat) ?? s.province,
    })),
  );
  return { source: 'fallback', fetchedAt: new Date().toISOString(), stale: true, note, satellites: [], items };
}

/** Titik panas NASA FIRMS se-Indonesia, 3 hari terakhir (klien memfilter jendela waktu). */
export async function getNationalHotspots(): Promise<NationalHotspots> {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) return fallback('Kunci FIRMS belum diatur. Menampilkan data contoh.');
  const res = await Promise.allSettled(
    SOURCES.map(async (src) => {
      const r = await fetchWithTimeout(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${src}/${ID_BBOX}/3`, { next: { revalidate: 1800 } }, 12000);
      if (!r.ok) throw new Error(String(r.status));
      return { src, items: parseCsv(await r.text(), src) };
    }),
  );
  const ok = res.filter((r): r is PromiseFulfilledResult<{ src: string; items: RawHotspot[] }> => r.status === 'fulfilled');
  if (ok.length === 0) return fallback('Data satelit langsung tidak tersedia. Menampilkan data cadangan.');
  const items = markPersistent(ok.flatMap((r) => r.value.items));
  return {
    source: 'nasa-firms',
    fetchedAt: new Date().toISOString(),
    stale: false,
    note: ok.length < SOURCES.length ? 'Sebagian satelit tidak menjawab; data mungkin belum lengkap.' : undefined,
    satellites: ok.filter((r) => r.value.items.length > 0).map((r) => SAT_NAME[r.value.src]),
    items,
  };
}

/* ---------------- Cuaca nasional: angin & PM2.5 ---------------- */
export const CITIES: { city: string; province: string; lat: number; lon: number }[] = [
  { city: 'Banda Aceh', province: 'Aceh', lat: 5.55, lon: 95.32 },
  { city: 'Medan', province: 'Sumatera Utara', lat: 3.59, lon: 98.67 },
  { city: 'Padang', province: 'Sumatera Barat', lat: -0.95, lon: 100.35 },
  { city: 'Pekanbaru', province: 'Riau', lat: 0.51, lon: 101.45 },
  { city: 'Dumai', province: 'Riau', lat: 1.67, lon: 101.45 },
  { city: 'Tanjung Pinang', province: 'Kepulauan Riau', lat: 0.92, lon: 104.45 },
  { city: 'Jambi', province: 'Jambi', lat: -1.61, lon: 103.61 },
  { city: 'Palembang', province: 'Sumatera Selatan', lat: -2.98, lon: 104.76 },
  { city: 'Kayuagung', province: 'Sumatera Selatan', lat: -3.4, lon: 104.83 },
  { city: 'Pangkalpinang', province: 'Kepulauan Bangka Belitung', lat: -2.13, lon: 106.11 },
  { city: 'Bengkulu', province: 'Bengkulu', lat: -3.8, lon: 102.27 },
  { city: 'Bandar Lampung', province: 'Lampung', lat: -5.43, lon: 105.26 },
  { city: 'Serang', province: 'Banten', lat: -6.12, lon: 106.15 },
  { city: 'Jakarta', province: 'DKI Jakarta', lat: -6.2, lon: 106.85 },
  { city: 'Bandung', province: 'Jawa Barat', lat: -6.91, lon: 107.61 },
  { city: 'Semarang', province: 'Jawa Tengah', lat: -6.97, lon: 110.42 },
  { city: 'Yogyakarta', province: 'DI Yogyakarta', lat: -7.8, lon: 110.37 },
  { city: 'Surabaya', province: 'Jawa Timur', lat: -7.25, lon: 112.75 },
  { city: 'Denpasar', province: 'Bali', lat: -8.65, lon: 115.22 },
  { city: 'Mataram', province: 'Nusa Tenggara Barat', lat: -8.58, lon: 116.12 },
  { city: 'Kupang', province: 'Nusa Tenggara Timur', lat: -10.16, lon: 123.6 },
  { city: 'Pontianak', province: 'Kalimantan Barat', lat: -0.03, lon: 109.33 },
  { city: 'Ketapang', province: 'Kalimantan Barat', lat: -1.85, lon: 109.98 },
  { city: 'Palangka Raya', province: 'Kalimantan Tengah', lat: -2.21, lon: 113.92 },
  { city: 'Sampit', province: 'Kalimantan Tengah', lat: -2.53, lon: 112.95 },
  { city: 'Banjarbaru', province: 'Kalimantan Selatan', lat: -3.44, lon: 114.83 },
  { city: 'Samarinda', province: 'Kalimantan Timur', lat: -0.5, lon: 117.15 },
  { city: 'Tanjung Selor', province: 'Kalimantan Utara', lat: 2.84, lon: 117.37 },
  { city: 'Manado', province: 'Sulawesi Utara', lat: 1.47, lon: 124.84 },
  { city: 'Gorontalo', province: 'Gorontalo', lat: 0.54, lon: 123.06 },
  { city: 'Palu', province: 'Sulawesi Tengah', lat: -0.9, lon: 119.87 },
  { city: 'Mamuju', province: 'Sulawesi Barat', lat: -2.68, lon: 118.89 },
  { city: 'Makassar', province: 'Sulawesi Selatan', lat: -5.15, lon: 119.43 },
  { city: 'Kendari', province: 'Sulawesi Tenggara', lat: -3.99, lon: 122.51 },
  { city: 'Sofifi', province: 'Maluku Utara', lat: 0.74, lon: 127.56 },
  { city: 'Ambon', province: 'Maluku', lat: -3.7, lon: 128.18 },
  { city: 'Manokwari', province: 'Papua Barat', lat: -0.86, lon: 134.06 },
  { city: 'Jayapura', province: 'Papua', lat: -2.53, lon: 140.72 },
  { city: 'Merauke', province: 'Papua', lat: -8.49, lon: 140.4 },
];

const WIND_LONS = Array.from({ length: 17 }, (_, i) => 94 + i * 3);
const WIND_LATS = Array.from({ length: 10 }, (_, j) => -11 + j * 2);

export async function getNationalWeather(): Promise<NationalWeather> {
  const lats: number[] = [];
  const lons: number[] = [];
  for (const la of WIND_LATS) for (const lo of WIND_LONS) {
    lats.push(la);
    lons.push(lo);
  }
  const windUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lons.join(',')}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`;
  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${CITIES.map((c) => c.lat).join(',')}&longitude=${CITIES.map((c) => c.lon).join(',')}&current=pm2_5`;
  const [w, a] = await Promise.allSettled([
    fetchWithTimeout(windUrl, { next: { revalidate: 3600 } }, 10000).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetchWithTimeout(airUrl, { next: { revalidate: 3600 } }, 10000).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
  ]);
  type Cur = { current?: { wind_speed_10m?: number; wind_direction_10m?: number; pm2_5?: number } };
  let wind: NationalWeather['wind'] = null;
  if (w.status === 'fulfilled' && Array.isArray(w.value)) {
    const rows = w.value as Cur[];
    const u: number[] = [];
    const v: number[] = [];
    rows.forEach((r) => {
      const sp = r.current?.wind_speed_10m ?? 0;
      // Arah ASAL -> vektor TUJUAN.
      const to = (((r.current?.wind_direction_10m ?? 0) + 180) * Math.PI) / 180;
      u.push(Math.round(sp * Math.sin(to) * 100) / 100);
      v.push(Math.round(sp * Math.cos(to) * 100) / 100);
    });
    if (u.length === WIND_LONS.length * WIND_LATS.length) wind = { lons: WIND_LONS, lats: WIND_LATS, u, v };
  }
  let air: CityAir[] = [];
  if (a.status === 'fulfilled' && Array.isArray(a.value)) {
    const rows = a.value as Cur[];
    air = CITIES.map((c, k) => ({ ...c, pm25: rows[k]?.current?.pm2_5 ?? NaN })).filter((c) => Number.isFinite(c.pm25));
  }
  return { fetchedAt: new Date().toISOString(), stale: !wind || air.length === 0, wind, air };
}
