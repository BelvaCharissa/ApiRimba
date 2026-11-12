/**
 * Indeks kekeringan D (0..1) dari kelembapan udara dan hujan 7 hari.
 * Proksi sederhana: separuh dari defisit kelembapan, separuh dari kurangnya hujan.
 */
export function drynessIndex(rhPct: number, rain7dMm: number): number {
  const fromRh = clamp01((100 - rhPct) / 60);
  const fromRain = clamp01(1 - rain7dMm / 50);
  return Math.round((0.5 * fromRh + 0.5 * fromRain) * 100) / 100;
}

/** Indeks kelembapan gambut m dari hujan 14 hari (TRD: m = min(hujan14 / 150, 1)). */
export function peatMoistureFromRain(rain14dMm: number): number {
  return Math.min(1, Math.max(0, rain14dMm / 150));
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
