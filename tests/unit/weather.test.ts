import { describe, expect, it } from 'vitest';
import type { WeatherHour } from '@/lib/schemas';
import { angleDiff, weatherAlerts } from '@/lib/weather';

const T0 = Date.parse('2026-11-23T03:00:00Z');
const hour = (k: number, p: Partial<WeatherHour> = {}): WeatherHour => ({
  time: new Date(T0 + k * 3600_000).toISOString(),
  windMs: 4,
  windFromDeg: 135,
  tempC: 31,
  rhPct: 60,
  rainMm: 0,
  rainProb: 10,
  ...p,
});

describe('weatherAlerts (peringatan prakiraan cuaca)', () => {
  it('tidak ada peringatan bila angin stabil dan kering', () => {
    const fc = Array.from({ length: 13 }, (_, k) => hour(k));
    expect(weatherAlerts(fc, 4, 135, T0)).toEqual([]);
  });

  it('mendeteksi angin berbelok, menguat, dan hujan pada jam pertama kejadian', () => {
    const fc = Array.from({ length: 13 }, (_, k) =>
      hour(k, {
        windFromDeg: k >= 5 ? 250 : 135,
        windMs: k >= 8 ? 8 : 4,
        rainProb: k === 10 ? 70 : 10,
      }),
    );
    const a = weatherAlerts(fc, 4, 135, T0);
    expect(a.map((x) => [x.kind, x.inHours])).toEqual([
      ['shift', 5],
      ['stronger', 8],
      ['rain', 10],
    ]);
  });

  it('mengabaikan perubahan arah saat angin hampir tenang', () => {
    const fc = Array.from({ length: 13 }, (_, k) => hour(k, { windFromDeg: k >= 3 ? 300 : 135, windMs: k >= 3 ? 0.8 : 4 }));
    expect(weatherAlerts(fc, 4, 135, T0).some((x) => x.kind === 'shift')).toBe(false);
  });

  it('selisih arah melewati utara dihitung benar', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(90, 270)).toBe(180);
  });
});
