import { describe, expect, it } from 'vitest';
import { buildSmoke, concentrationAt, mixingHeight, plumeReach, smokeField, toLocal } from '@/lib/sim/smoke';
import { Fuel, type GridSpec } from '@/lib/sim/types';

const grid: GridSpec = { w: 64, h: 64, cellSizeM: 250, originLon: 102, originLat: 0.5, cellDegLon: 0.00224585, cellDegLat: 0.00224578 };
const N = grid.w * grid.h;
const STEPS = 48;

/** Api gambut sederhana: lingkaran yang melebar dari tengah grid, tiap sel membara 12 langkah. */
function fire() {
  const arrival = new Int16Array(N).fill(-1);
  const burnUntil = new Int16Array(N).fill(-1);
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const d = Math.hypot(x - 32, y - 32);
      const a = Math.round(d * 2);
      if (a < STEPS) {
        arrival[y * grid.w + x] = a;
        burnUntil[y * grid.w + x] = a + 12;
      }
    }
  }
  return { arrival, burnUntil, fuelClass: new Uint8Array(N).fill(Fuel.PEAT) };
}

// Ke arah barat daya dari pusat (angin dari timur laut membawa asap ke barat daya).
const center: [number, number] = [102 + 32 * grid.cellDegLon, 0.5 - 32 * grid.cellDegLat];
const downwind = { name: 'Hilir', lon: center[0] - 0.25, lat: center[1] - 0.25, kind: 'city' as const };
const upwind = { name: 'Hulu', lon: center[0] + 0.25, lat: center[1] + 0.25, kind: 'city' as const };

function model(winds = [{ windMs: 5, windFromDeg: 45 }]) {
  return buildSmoke({
    grid,
    ...fire(),
    steps: STEPS,
    stepMinutes: 15,
    winds,
    hourly: winds.length > 1,
    startMs: Date.parse('2026-11-23T03:00:00Z'),
    targets: [downwind, upwind],
  });
}

describe('buildSmoke (prediksi asap)', () => {
  it('asap terbawa ke arah hilir angin, bukan ke hulu', () => {
    const m = model();
    const [hilir, hulu] = m.targets;
    expect(hilir.peak).toBeGreaterThan(55);
    expect(hilir.unhealthyStep).not.toBeNull();
    expect(hulu.peak).toBeLessThan(1);
    expect(hulu.noticeableStep).toBeNull();
  });

  it('konsentrasi di pusat api tinggi dan bertambah seiring api membesar', () => {
    const m = model();
    expect(concentrationAt(m, 0, 0, 2)).toBeGreaterThan(0);
    expect(concentrationAt(m, 0, 0, 40)).toBeGreaterThan(concentrationAt(m, 0, 0, 2));
    expect(m.totalTonnes).toBeGreaterThan(0);
  });

  it('memakai angin per jam: arah asap ikut berbelok', () => {
    // 6 jam pertama dari timur laut, lalu dari barat daya -> asap balik ke timur laut.
    const winds = [...Array(6).fill({ windMs: 5, windFromDeg: 45 }), ...Array(7).fill({ windMs: 5, windFromDeg: 225 })];
    const m = model(winds);
    const early = plumeReach(m, 20);
    const late = plumeReach(m, 47);
    expect(early).not.toBeNull();
    expect(late).not.toBeNull();
    // Awal: ke barat daya (~225°). Akhir: gumpalan terbaru ke timur laut.
    expect(Math.abs(early!.towardDeg - 225)).toBeLessThan(40);
    const [hx, hy] = toLocal(m, upwind.lon, upwind.lat);
    expect(concentrationAt(m, hx, hy, 47)).toBeGreaterThan(concentrationAt(m, hx, hy, 20));
  });

  it('raster asap berisi nilai dan kotak batas yang valid', () => {
    const f = smokeField(model(), 30);
    expect(f).not.toBeNull();
    const [w, s, e, n] = f!.bbox;
    expect(e).toBeGreaterThan(w);
    expect(n).toBeGreaterThan(s);
    expect(Math.max(...f!.values)).toBeGreaterThan(55);
  });

  it('tanpa api tidak ada asap', () => {
    const m = buildSmoke({
      grid,
      fuelClass: new Uint8Array(N).fill(Fuel.PEAT),
      arrival: new Int16Array(N).fill(-1),
      burnUntil: new Int16Array(N).fill(-1),
      steps: STEPS,
      stepMinutes: 15,
      winds: [{ windMs: 5, windFromDeg: 90 }],
      hourly: false,
      startMs: Date.now(),
      targets: [downwind],
    });
    expect(m.puffs.length).toBe(0);
    expect(smokeField(m, 47)).toBeNull();
    expect(m.targets[0].peak).toBe(0);
  });

  it('lapisan campur malam lebih rendah dari siang', () => {
    expect(mixingHeight(2)).toBeLessThan(mixingHeight(13));
    expect(mixingHeight(26)).toBe(mixingHeight(2));
  });
});
