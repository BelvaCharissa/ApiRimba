import type { WeatherHour } from './schemas';

/** Selisih dua arah (derajat), 0..180. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

export interface WeatherAlert {
  kind: 'shift' | 'stronger' | 'rain';
  hour: WeatherHour;
  /** Jam dari sekarang. */
  inHours: number;
}

/**
 * Peringatan dari prakiraan per jam dibanding angin yang sedang disimulasikan (1-12 jam ke depan):
 * angin berbelok >= 45° (dengan angin >= 1,5 m/s), angin menguat >= 3 m/s, atau hujan (>= 1 mm / peluang >= 60%).
 */
export function weatherAlerts(forecast: WeatherHour[], windMs: number, windFromDeg: number, nowMs: number): WeatherAlert[] {
  const ahead = forecast
    .map((h) => ({ h, inHours: Math.round((Date.parse(h.time) - nowMs) / 3600_000) }))
    .filter((x) => x.inHours >= 1 && x.inHours <= 12);
  const out: WeatherAlert[] = [];
  const shift = ahead.find((x) => x.h.windMs >= 1.5 && angleDiff(x.h.windFromDeg, windFromDeg) >= 45);
  if (shift) out.push({ kind: 'shift', hour: shift.h, inHours: shift.inHours });
  const strong = ahead.find((x) => x.h.windMs >= windMs + 3);
  if (strong) out.push({ kind: 'stronger', hour: strong.h, inHours: strong.inHours });
  const rain = ahead.find((x) => x.h.rainMm >= 1 || (x.h.rainProb ?? 0) >= 60);
  if (rain) out.push({ kind: 'rain', hour: rain.h, inHours: rain.inHours });
  return out;
}
