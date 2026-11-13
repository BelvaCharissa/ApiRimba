import { scenarioMeta } from '../scenario';
import type { HotspotItem, HotspotsResponse, ScenarioSlug } from '../schemas';
import { fallbackHotspots, fetchWithTimeout } from './fallback';

const SOURCES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT'];

function parseCsv(csv: string, satellite: string): HotspotItem[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0].split(',');
  const col = (name: string) => head.indexOf(name);
  const iLat = col('latitude');
  const iLon = col('longitude');
  const iDate = col('acq_date');
  const iTime = col('acq_time');
  const iConf = col('confidence');
  const iFrp = col('frp');
  if (iLat < 0 || iLon < 0) return [];
  return lines.slice(1).map((line, k) => {
    const c = line.split(',');
    const t = (c[iTime] ?? '0000').padStart(4, '0');
    const raw = (c[iConf] ?? 'n').toLowerCase();
    const confidence: HotspotItem['confidence'] = raw.startsWith('h') ? 'high' : raw.startsWith('l') ? 'low' : 'nominal';
    return {
      id: `${satellite}_${c[iDate]}_${t}_${k}`,
      lat: Number(c[iLat]),
      lon: Number(c[iLon]),
      acquiredAt: `${c[iDate]}T${t.slice(0, 2)}:${t.slice(2)}:00Z`,
      confidence,
      frp: Number(c[iFrp] ?? 0),
      satellite: satellite.replace('_NRT', ''),
    };
  });
}

/**
 * Hotspot NASA FIRMS untuk bbox skenario. Butuh FIRMS_MAP_KEY di server.
 * Tanpa kunci, gagal, atau kosong -> data cadangan (ditandai stale).
 */
export async function getHotspots(slug: ScenarioSlug, days: number): Promise<HotspotsResponse> {
  const meta = scenarioMeta(slug);
  const key = process.env.FIRMS_MAP_KEY;
  if (!meta || !key) return fallbackHotspots(slug, 'Kunci FIRMS belum diatur. Menampilkan data contoh.', days);
  const area = meta.bbox.join(',');
  try {
    const results = await Promise.all(
      SOURCES.map(async (src) => {
        const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${src}/${area}/${days}`;
        const res = await fetchWithTimeout(url, { next: { revalidate: 1800 } });
        if (!res.ok) throw new Error(`firms ${res.status}`);
        return parseCsv(await res.text(), src);
      }),
    );
    const items = results.flat().filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon));
    if (items.length === 0) {
      return fallbackHotspots(slug, 'Tidak ada titik panas aktif di area ini saat ini. Menggunakan titik awal contoh.', days);
    }
    return { scenario: slug, source: 'nasa-firms', fetchedAt: new Date().toISOString(), stale: false, items };
  } catch {
    return fallbackHotspots(slug, 'Data langsung tidak tersedia. Menampilkan data cadangan.', days);
  }
}
