import hotKalteng from '../../../public/data/fallback/hotspots-kalteng.json';
import hotRiau from '../../../public/data/fallback/hotspots-riau.json';
import hotSumsel from '../../../public/data/fallback/hotspots-sumsel.json';
import wKalteng from '../../../public/data/fallback/weather-kalteng.json';
import wRiau from '../../../public/data/fallback/weather-riau.json';
import wSumsel from '../../../public/data/fallback/weather-sumsel.json';
import type { HotspotsResponse, ScenarioSlug, WeatherResponse } from '../schemas';

const HOT = { riau: hotRiau, kalteng: hotKalteng, sumsel: hotSumsel } as const;
const WEATHER = { riau: wRiau, kalteng: wKalteng, sumsel: wSumsel } as const;

/**
 * Data cadangan hotspot (dibundel bersama aplikasi, tanpa jaringan). Waktu deteksi contoh disebar
 * relatif terhadap sekarang selama 72 jam agar filter 24/48/72 jam tetap bermakna.
 */
export function fallbackHotspots(slug: ScenarioSlug, note?: string, days = 3): HotspotsResponse {
  const d = HOT[slug];
  const now = Date.now();
  const n = d.items.length;
  const items = d.items
    .map((h, k) => ({
      ...h,
      confidence: h.confidence as 'low' | 'nominal' | 'high',
      acquiredAt: new Date(now - (0.7 + (k * 70) / Math.max(1, n)) * 3600_000).toISOString(),
    }))
    .filter((h) => now - Date.parse(h.acquiredAt) <= days * 24 * 3600_000);
  return { scenario: slug, source: 'fallback', fetchedAt: new Date(now).toISOString(), stale: true, note, items };
}

export function fallbackWeather(slug: ScenarioSlug): WeatherResponse {
  return { scenario: slug, ...WEATHER[slug], source: 'fallback', stale: true };
}

/** fetch dengan batas waktu (default 5 detik, sesuai TRD). */
export async function fetchWithTimeout(url: string, init: RequestInit & { next?: { revalidate?: number } } = {}, ms = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}
