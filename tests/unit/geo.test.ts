import { describe, expect, it } from 'vitest';
import { fallbackBriefing } from '@/lib/briefing';
import { describeBreak, fmtCoord, ignitionCellsAt, touchesEdge } from '@/lib/geo';
import { buildSimInput } from '@/lib/sim/input';
import { Fuel, type GridSpec } from '@/lib/sim/types';

const grid: GridSpec = { w: 10, h: 10, cellSizeM: 250, originLon: 102, originLat: 0.5, cellDegLon: 0.00225, cellDegLat: 0.00225 };

describe('geo', () => {
  it('format koordinat lapangan', () => {
    expect(fmtCoord(101.98765, 0.45612)).toBe('0,4561° LU, 101,9877° BT');
    expect(fmtCoord(113.9, -2.3)).toContain('LS');
  });

  it('titik api dari klik: sel + tetangga, tolak air dan luar area', () => {
    const fuel = new Array(100).fill(Fuel.PEAT);
    fuel[55] = Fuel.WATER;
    const lon = grid.originLon + 3.5 * grid.cellDegLon;
    const lat = grid.originLat - 3.5 * grid.cellDegLat;
    expect(ignitionCellsAt(grid, fuel, lon, lat)).toEqual([33, 34, 43]);
    expect(ignitionCellsAt(grid, fuel, grid.originLon + 5.5 * grid.cellDegLon, grid.originLat - 5.5 * grid.cellDegLat)).toBeNull();
    expect(ignitionCellsAt(grid, fuel, 90, 0)).toBeNull();
  });

  it('deskripsi posisi sekat', () => {
    const d = describeBreak(
      [
        [102.02, 0.49],
        [102.02, 0.47],
      ],
      [102.0, 0.48],
      [{ name: 'Desa X', lon: 102.03, lat: 0.48, cell: 0, population: 100 }],
    );
    expect(d.direction).toBe('timur');
    expect(d.orientation).toBe('utara–selatan');
    expect(d.nearestVillage?.name).toBe('Desa X');
    expect(d.distKm).toBeGreaterThan(2);
  });

  it('api menyentuh tepi grid terdeteksi', () => {
    const arr = new Int16Array(100).fill(-1);
    arr[55] = 3;
    expect(touchesEdge(grid, arr)).toBe(false);
    arr[9] = 10;
    expect(touchesEdge(grid, arr)).toBe(true);
  });
});

describe('input titik api kustom', () => {
  it('memakai titik api pilihan bila ada', () => {
    const data = {
      grid,
      fuelClass: new Array(100).fill(Fuel.PEAT),
      elevation: new Array(100).fill(0),
      peatMoisture: new Array(100).fill(-1),
      ignitions: [1],
      defaultDryness: 0.5,
    } as unknown as Parameters<typeof buildSimInput>[0];
    expect(buildSimInput(data, { windMs: 5, windFromDeg: 0 }).ignitions).toEqual([1]);
    expect(buildSimInput(data, { windMs: 5, windFromDeg: 0, ignitions: [42] }).ignitions).toEqual([42]);
  });
});

describe('briefing cadangan', () => {
  it('menyebut koordinat titik api dan sekat, serta luas tanpa sekat', () => {
    const text = fallbackBriefing({
      scenarioName: 'Riau',
      province: 'Riau',
      windMs: 6,
      windFromDeg: 225,
      dryness: 0.8,
      burnedKm2: 12.5,
      burnedKm2WithFirebreak: null,
      ignition: { lat: 0.45, lon: 101.99, custom: false },
      villages: [{ name: 'Sungai Buluh', etaHours: 3.5, level: 'awas', population: 900, lat: 0.4556, lon: 102.0079 }],
      recommendations: [
        { label: 'A', score: 60, reductionPct: 20, marginHours: 2, lengthKm: 4, peatBypassRisk: true, from: { lat: 0.46, lon: 102.01 }, to: { lat: 0.44, lon: 102.02 } },
      ],
      appliedFirebreak: null,
      emptyReason: null,
    });
    expect(text).toContain('0,4500° LU, 101,9900° BT');
    expect(text).toContain('tanpa sekat 12,5 km2');
    expect(text).toContain('Sekat A dari 0,4600° LU');
    expect(text).toContain('Sungai Buluh');
  });
});
