import { describe, expect, it } from 'vitest';
import { provinceOf } from '@/lib/data/national';
import { clusterIncidents, ispuOf, windAt, type RawHotspot } from '@/lib/pantau';

describe('peta pantau', () => {
  it('menentukan provinsi dari koordinat', () => {
    expect(provinceOf(101.45, 0.51)).toBe('Riau');
    expect(provinceOf(113.92, -2.21)).toBe('Kalimantan Tengah');
    expect(provinceOf(104.76, -2.98)).toBe('Sumatera Selatan');
    // Laut Jawa & Malaysia bukan wilayah daratan Indonesia.
    expect(provinceOf(110.5, -5.0)).toBeNull();
    expect(provinceOf(101.7, 3.15)).toBeNull();
  });

  it('mengelompokkan titik berdekatan menjadi satu kejadian', () => {
    const base = { acquiredAt: '2026-11-15T03:00:00Z', confidence: 'high' as const, frp: 10, satellite: 'x', province: 'Riau' };
    const pts: RawHotspot[] = [
      { ...base, id: 'a', lat: 0.5, lon: 101.5 },
      { ...base, id: 'b', lat: 0.51, lon: 101.5 },
      { ...base, id: 'c', lat: 0.52, lon: 101.51 },
      { ...base, id: 'd', lat: 1.5, lon: 102.5 },
    ];
    const { incidents, items } = clusterIncidents(pts);
    expect(incidents).toHaveLength(2);
    expect(items[0].incident).toBe(items[2].incident);
    expect(items[3].incident).not.toBe(items[0].incident);
  });

  it('kategori ISPU PM2.5', () => {
    expect(ispuOf(10).label).toBe('Baik');
    expect(ispuOf(40).label).toBe('Sedang');
    expect(ispuOf(120).label).toBe('Tidak sehat');
    expect(ispuOf(300).label).toBe('Berbahaya');
  });

  it('interpolasi angin bilinear', () => {
    const g = { lons: [0, 1], lats: [0, 1], u: [0, 2, 0, 2], v: [1, 1, 1, 1] };
    expect(windAt(g, 0.5, 0.5)).toEqual({ u: 1, v: 1 });
    expect(windAt(g, 2, 0)).toBeNull();
  });
});

describe('sumber panas tetap', () => {
  it('menandai titik yang muncul di lokasi sama tiga hari, bukan api yang berpindah', async () => {
    const { markPersistent } = await import('@/lib/pantau');
    const base = { confidence: 'high' as const, frp: 20, satellite: 'x', province: 'Kalimantan Timur' };
    const flare = ['2026-11-13', '2026-11-14', '2026-11-15'].map((d, k) => ({ ...base, id: `f${k}`, lat: -1, lon: 117, acquiredAt: `${d}T05:00:00Z` }));
    const fire = ['2026-11-13', '2026-11-14', '2026-11-15'].map((d, k) => ({ ...base, id: `p${k}`, lat: -2 - k * 0.03, lon: 114, acquiredAt: `${d}T05:00:00Z` }));
    const out = markPersistent([...flare, ...fire]);
    expect(out.filter((h) => h.persistent).map((h) => h.id).sort()).toEqual(['f0', 'f1', 'f2']);
  });
});
