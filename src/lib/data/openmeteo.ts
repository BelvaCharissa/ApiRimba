import { scenarioMeta } from '../scenario';
import type { ScenarioSlug, WeatherResponse } from '../schemas';
import { drynessIndex } from '../sim/dryness';
import { fallbackWeather, fetchWithTimeout } from './fallback';

interface OpenMeteoHourly {
  time: string[];
  wind_speed_10m: (number | null)[];
  wind_direction_10m: (number | null)[];
  temperature_2m: (number | null)[];
  relative_humidity_2m: (number | null)[];
  precipitation: (number | null)[];
}

/** Ambil cuaca dari Open-Meteo (tanpa kunci). Gagal -> data cadangan. */
export async function getWeather(slug: ScenarioSlug): Promise<WeatherResponse> {
  const meta = scenarioMeta(slug);
  if (!meta) return fallbackWeather(slug);
  const [lon, lat] = meta.center;
  return (await getWeatherAt(lat, lon, slug, meta.defaultWindMs, meta.defaultWindFromDeg)) ?? fallbackWeather(slug);
}

/** Cuaca di koordinat sembarang (area langsung). null bila Open-Meteo gagal. */
export async function getWeatherAt(
  lat: number,
  lon: number,
  tag: WeatherResponse['scenario'] = 'live',
  defWind = 4,
  defFrom = 135,
): Promise<WeatherResponse | null> {
  const meta = { defaultWindMs: defWind, defaultWindFromDeg: defFrom };
  const slug = tag;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m,precipitation' +
    '&wind_speed_unit=ms&past_days=14&forecast_days=2&timezone=UTC';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { next: { revalidate: 3600 } });
      if (!res.ok) throw new Error(`open-meteo ${res.status}`);
      const json = (await res.json()) as { hourly: OpenMeteoHourly };
      const h = json.hourly;
      const now = Date.now();
      let idx = 0;
      for (let i = 0; i < h.time.length; i++) {
        if (Date.parse(`${h.time[i]}Z`) <= now) idx = i;
      }
      const sumBack = (hours: number) => {
        let s = 0;
        for (let i = Math.max(0, idx - hours + 1); i <= idx; i++) s += h.precipitation[i] ?? 0;
        return Math.round(s * 10) / 10;
      };
      const rh = h.relative_humidity_2m[idx] ?? 60;
      const rain7 = sumBack(24 * 7);
      return {
        scenario: slug,
        source: 'open-meteo',
        fetchedAt: new Date().toISOString(),
        stale: false,
        windMs: Math.min(20, Math.round((h.wind_speed_10m[idx] ?? meta.defaultWindMs) * 10) / 10),
        windFromDeg: Math.round(h.wind_direction_10m[idx] ?? meta.defaultWindFromDeg) % 360,
        tempC: Math.round((h.temperature_2m[idx] ?? 30) * 10) / 10,
        rhPct: Math.round(rh),
        rain7dMm: rain7,
        rain14dMm: sumBack(24 * 14),
        dryness: drynessIndex(rh, rain7),
      };
    } catch {
      // coba sekali lagi
    }
  }
  return null;
}
