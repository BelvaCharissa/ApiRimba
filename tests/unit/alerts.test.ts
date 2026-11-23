import { describe, expect, it } from 'vitest';
import { alertLevel, alertMessage, villageAlerts, zoneOf } from '@/lib/alerts';

const base = { lat: 0.45, lon: 102, population: 800, fireProb: 0.8 };
// 23 Nov 2026 10.00 WIB
const NOW = Date.parse('2026-11-23T03:00:00Z');

describe('alertLevel (level peringatan desa)', () => {
  it('mengikuti jam tiba api: <4 Awas, 4-8 Siaga, 8-12 Waspada, >12 tidak ada', () => {
    expect(alertLevel({ ...base, name: 'A', fireEtaHours: 2 })).toBe('awas');
    expect(alertLevel({ ...base, name: 'A', fireEtaHours: 5 })).toBe('siaga');
    expect(alertLevel({ ...base, name: 'A', fireEtaHours: 10 })).toBe('waspada');
    expect(alertLevel({ ...base, name: 'A', fireEtaHours: null })).toBeNull();
  });

  it('asap ikut menaikkan level', () => {
    expect(alertLevel({ ...base, name: 'A', fireEtaHours: null, smokeUnhealthyHours: 9, smokePeak: 80 })).toBe('waspada');
    expect(alertLevel({ ...base, name: 'A', fireEtaHours: null, smokeUnhealthyHours: 5, smokePeak: 200 })).toBe('siaga');
    expect(alertLevel({ ...base, name: 'A', fireEtaHours: 10, smokeUnhealthyHours: 1, smokePeak: 900 })).toBe('awas');
  });
});

describe('villageAlerts', () => {
  it('hanya desa terancam, paling mendesak di atas', () => {
    const a = villageAlerts([
      { ...base, name: 'Aman', fireEtaHours: null },
      { ...base, name: 'Jauh', fireEtaHours: 10 },
      { ...base, name: 'Dekat', fireEtaHours: 2 },
      { ...base, name: 'Asap', fireEtaHours: null, smokeUnhealthyHours: 4, smokePeak: 70 },
    ]);
    expect(a.map((x) => x.village)).toEqual(['Dekat', 'Asap', 'Jauh']);
    expect(a.find((x) => x.village === 'Asap')!.kind).toBe('asap');
  });
});

describe('alertMessage (isi pesan WhatsApp)', () => {
  it('berisi jam tiba dalam zona waktu provinsi dan parameter satu baris', () => {
    const [a] = villageAlerts([{ ...base, name: 'Sungai Buluh', fireEtaHours: 5.5, smokeUnhealthyHours: 0.25, smokePeak: 4600 }]);
    const m = alertMessage(a, { province: 'Riau', nowMs: NOW, mapUrl: 'https://apirimba-ai.vercel.app/peta?lokasi=0.45,102' });
    expect(m.params[0]).toBe('AWAS KEBAKARAN & ASAP'); // asap berbahaya dalam 15 menit -> Awas
    expect(m.params[1]).toBe('Sungai Buluh');
    expect(m.params[2]).toContain('±5,5 jam');
    expect(m.params[2]).toContain('15.30 WIB');
    expect(m.params[2]).toContain('Berbahaya');
    for (const p of m.params) expect(p).not.toMatch(/[\n\t]| {4,}/);
    expect(m.text).toContain('*PERINGATAN DINI AWAS KEBAKARAN & ASAP*');
    expect(m.text).toContain('Desa *Sungai Buluh*');
  });

  it('memakai WITA untuk Kalimantan Timur', () => {
    expect(zoneOf('Kalimantan Timur').label).toBe('WITA');
    expect(zoneOf('Papua Barat').label).toBe('WIT');
    expect(zoneOf('Kalimantan Tengah').label).toBe('WIB');
    const [a] = villageAlerts([{ ...base, name: 'X', fireEtaHours: 1 }]);
    expect(alertMessage(a, { province: 'Kalimantan Timur', nowMs: NOW, mapUrl: 'u' }).params[2]).toContain('12.00 WITA');
  });
});
