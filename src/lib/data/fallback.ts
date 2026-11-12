import hotKalteng from '../../../public/data/fallback/hotspots-kalteng.json';
import hotRiau from '../../../public/data/fallback/hotspots-riau.json';
import hotSumsel from '../../../public/data/fallback/hotspots-sumsel.json';
import wKalteng from '../../../public/data/fallback/weather-kalteng.json';
import wRiau from '../../../public/data/fallback/weather-riau.json';
import wSumsel from '../../../public/data/fallback/weather-sumsel.json';
import type { HotspotsResponse, ScenarioSlug, WeatherResponse } from '../schemas';

const HOT = { riau: hotRiau, kalteng: hotKalteng, sumsel: hotSumsel } as const;
const WEATHER = { riau: wRiau, kalteng: wKalteng, sumsel: wSumsel } as const;

/** Data cadangan hotspot (dibundel bersama aplikasi, tanpa jaringan). */
export function fallbackHotspots(slug: ScenarioSlug, note?: string): HotspotsResponse {
  const d = HOT[slug];
  return {
    scenario: slug,
    source: 'fallback',
    fetchedAt: d.fetchedAt,
    stale: true,
    note,
    items: d.items.map((h) => ({ ...h, confidence: h.confidence as 'low' | 'nominal' | 'high' })),
  };
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
