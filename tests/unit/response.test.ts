import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_KINDS } from '@/lib/response/assets';
import { planFrame } from '@/lib/response/frame';
import { buildPlans, type PlanInput } from '@/lib/response/plan';
import type { ScenarioData } from '@/lib/scenario';
import { burnedByStep, cellsToKm2, runMonteCarlo } from '@/lib/sim/engine';
import { buildSimInput } from '@/lib/sim/input';
import { DEFAULT_SEED, STEP_MINUTES, STEPS_12H } from '@/lib/sim/params';
import { villageRisks } from '@/lib/sim/risk';

const load = (slug: string): ScenarioData =>
  JSON.parse(readFileSync(join(__dirname, `../../public/data/scenarios/${slug}.json`), 'utf8'));

function planInput(slug: string, over: Partial<PlanInput> = {}): PlanInput {
  const sc = load(slug);
  const input = buildSimInput(sc, { windMs: sc.defaultWindMs, windFromDeg: sc.defaultWindFromDeg });
  const mc = runMonteCarlo(input, DEFAULT_SEED, 8);
  const arrival = mc.representative.arrival;
  return {
    slug,
    center: sc.center,
    villages: sc.villages,
    rivers: sc.rivers,
    grid: sc.grid,
    fuelClass: sc.fuelClass,
    peatMoisture: sc.peatMoisture,
    ignitionCells: sc.ignitions,
    windMs: sc.defaultWindMs,
    windFromDeg: sc.defaultWindFromDeg,
    arrival,
    burnedKm2ByStep: burnedByStep(arrival, STEPS_12H).map((c) => cellsToKm2(c, sc.grid.cellSizeM)),
    stepMinutes: STEP_MINUTES,
    villageRisks: villageRisks(sc.grid, sc.villages, mc.prob, mc.meanArrival, STEP_MINUTES),
    radiusKm: 25,
    kinds: Object.fromEntries(ALL_KINDS.map((k) => [k, true])) as PlanInput['kinds'],
    edge: false,
    ...over,
  };
}

describe('rencana respons', () => {
  for (const slug of ['riau', 'kalteng', 'sumsel']) {
    it(`menyusun tiga rencana berskor untuk ${slug}`, () => {
      const set = buildPlans(planInput(slug));
      expect(set.plans).toHaveLength(3);
      for (const p of set.plans) {
        expect(p.score).toBeGreaterThanOrEqual(0);
        expect(p.score).toBeLessThanOrEqual(100);
        expect(p.unitsDeployed).toBeGreaterThan(0);
        expect(p.phases.length).toBeGreaterThanOrEqual(2);
        // Unit bertugas tidak pernah dikerahkan.
        const busy = new Set(set.units.filter((u) => u.status === 'bertugas').map((u) => u.id));
        expect(p.assignments.some((a) => busy.has(a.unitId))).toBe(false);
      }
      expect(set.recommended).not.toBeNull();
    });
  }

  it('tunda pengerahan tidak pernah mempercepat pengendalian', () => {
    const set = buildPlans(planInput('riau'));
    for (const p of set.plans) {
      let prev = -1;
      for (const r of p.sensitivity) {
        const v = r.containH ?? 999;
        expect(v).toBeGreaterThanOrEqual(prev - 1e-6);
        prev = v;
      }
    }
  });

  it('cakupan kecil mengerahkan lebih sedikit unit', () => {
    const wide = buildPlans(planInput('riau', { radiusKm: 50 }));
    const narrow = buildPlans(planInput('riau', { radiusKm: 10 }));
    expect(narrow.plans[1].unitsDeployed).toBeLessThan(wide.plans[1].unitsDeployed);
  });

  it('frame animasi: unit di pangkalan saat t=0 dan garis terbangun penuh setelah terkendali', () => {
    const set = buildPlans(planInput('riau'));
    const p = set.plans.find((x) => x.containH !== null)!;
    const ids = new Set(set.units.map((u) => u.id));
    const f0 = planFrame(p, set.units, 0, ids);
    for (const u of f0.units) expect(u.pos).toEqual(u.unit.base);
    const fEnd = planFrame(p, set.units, (p.containH ?? 0) + 0.5, ids);
    expect(fEnd.builtPct).toBeGreaterThanOrEqual(95);
  });
});

