'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNow } from '@/components/ui/useNow';
import type { NationalWeather } from '@/lib/pantau';
import { STEP_MINUTES, STEPS_12H } from '@/lib/sim/params';
import { buildSmoke, type SmokeTarget, type SmokeWind } from '@/lib/sim/smoke';
import { type FireResult, useSim } from '@/stores/simStore';

/** Kota dengan pemantauan udara (dari /api/pantau/cuaca), dimuat sekali per sesi. */
let citiesCache: Promise<{ city: string; lat: number; lon: number }[]> | null = null;
function loadCities() {
  citiesCache ??= fetch('/api/pantau/cuaca')
    .then((r) => (r.ok ? (r.json() as Promise<NationalWeather>) : Promise.reject(new Error('cuaca'))))
    .then((d) => d.air.map((c) => ({ city: c.city, lat: c.lat, lon: c.lon })))
    .catch(() => {
      citiesCache = null; // coba lagi lain kali (mis. setelah online)
      return [];
    });
  return citiesCache;
}

function km(aLon: number, aLat: number, bLon: number, bLat: number) {
  const x = (aLon - bLon) * 111.32 * Math.cos((((aLat + bLat) / 2) * Math.PI) / 180);
  const y = (aLat - bLat) * 110.57;
  return Math.hypot(x, y);
}

/**
 * Hitung prediksi asap dari hasil simulasi yang ditampilkan dan simpan ke store.
 * Angin: prakiraan per jam Open-Meteo bila simulasi sedang memakai cuaca sekarang; selain itu
 * angin simulasi (preset atau diatur pengguna) dianggap tetap 12 jam agar konsisten dengan api.
 */
export function useSmoke(result: FireResult | null) {
  const scenario = useSim((s) => s.scenario);
  const weather = useSim((s) => s.weather);
  const windMs = useSim((s) => s.windMs);
  const windFromDeg = useSim((s) => s.windFromDeg);
  // Jam mulai (dibulatkan ke jam) untuk siang/malam lapisan campur bila prakiraan tidak dipakai.
  const hourStart = Math.floor(useNow(10 * 60_000) / 3600_000) * 3600_000;
  const [cities, setCities] = useState<{ city: string; lat: number; lon: number }[]>([]);

  useEffect(() => {
    let alive = true;
    void loadCities().then((c) => alive && setCities(c));
    const retry = () => void loadCities().then((c) => alive && c.length && setCities(c));
    window.addEventListener('online', retry);
    return () => {
      alive = false;
      window.removeEventListener('online', retry);
    };
  }, []);

  const model = useMemo(() => {
    if (!scenario || !result) return null;
    const fc = weather && !weather.stale ? weather.forecast : undefined;
    const usingForecast =
      !!fc && fc.length > 1 && Math.abs(fc[0].windMs - windMs) < 0.05 && Math.round(fc[0].windFromDeg) === Math.round(windFromDeg);
    const winds: SmokeWind[] = usingForecast ? fc!.map((h) => ({ windMs: h.windMs, windFromDeg: h.windFromDeg })) : [{ windMs, windFromDeg }];
    const startMs = usingForecast ? Date.parse(fc![0].time) : hourStart;
    const [cLon, cLat] = scenario.center;
    const targets: SmokeTarget[] = [
      ...scenario.villages.map((v) => ({ name: v.name, lon: v.lon, lat: v.lat, kind: 'village' as const })),
      // Kota dalam radius 300 km (asap 12 jam bisa sejauh itu saat angin kencang).
      ...cities.filter((c) => km(c.lon, c.lat, cLon, cLat) <= 300).map((c) => ({ name: c.city, lon: c.lon, lat: c.lat, kind: 'city' as const })),
    ];
    return buildSmoke({
      grid: scenario.grid,
      fuelClass: scenario.fuelClass,
      arrival: result.arrival,
      burnUntil: result.burnUntil,
      steps: STEPS_12H,
      stepMinutes: STEP_MINUTES,
      winds,
      hourly: usingForecast,
      startMs,
      targets,
    });
  }, [scenario, result, weather, windMs, windFromDeg, cities, hourStart]);

  useEffect(() => {
    useSim.getState().set({ smokeModel: model });
  }, [model]);

  return model;
}
