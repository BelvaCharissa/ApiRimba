import { alongLL, splitLL } from './geom';
import type { Assignment, LonLat, Phase, ResourceUnit, ResponsePlan } from './types';

export type UnitState = 'siaga' | 'menuju' | 'bekerja' | 'suplai' | 'kembali' | 'selesai' | 'bertugas' | 'cadangan';

export interface UnitFrame {
  unit: ResourceUnit;
  pos: LonLat;
  state: UnitState;
}

export interface PlanFrame {
  t: number;
  areaKm2: number;
  phase: Phase;
  units: UnitFrame[];
  built: LonLat[][];
  todo: LonLat[][];
  /** Persentase garis kendali yang sudah terbangun. */
  builtPct: number;
}

function legPos(legs: Assignment['legs'], t: number): LonLat | null {
  for (const l of legs) {
    if (t >= l.t0 && t <= l.t1) {
      const f = l.t1 > l.t0 ? (t - l.t0) / (l.t1 - l.t0) : 1;
      return [l.from[0] + (l.to[0] - l.from[0]) * f, l.from[1] + (l.to[1] - l.from[1]) * f];
    }
  }
  return null;
}

function workFrac(a: Assignment, t: number): number {
  if (t <= a.workT0) return 0;
  if (t >= a.workT1) return 1;
  return (t - a.workT0) / (a.workT1 - a.workT0);
}

export function phaseAt(plan: ResponsePlan, t: number): Phase {
  for (const p of plan.phases) if (t >= p.t0 && t < p.t1) return p;
  return t < (plan.phases[0]?.t0 ?? 0) ? plan.phases[0] : plan.phases[plan.phases.length - 1];
}

/** Keadaan rencana pada jam t: posisi unit, garis terbangun, luas api, fase. */
export function planFrame(plan: ResponsePlan, units: ResourceUnit[], t: number, deployable: Set<string>): PlanFrame {
  const byUnit = new Map(plan.assignments.map((a) => [a.unitId, a]));
  const q = Math.max(0, Math.min(plan.areaCurve.length - 1, Math.round(t * 4)));
  const out: UnitFrame[] = [];
  for (const u of units) {
    const a = byUnit.get(u.id);
    if (!a) {
      out.push({ unit: u, pos: u.base, state: u.status === 'bertugas' ? 'bertugas' : deployable.has(u.id) ? 'cadangan' : 'siaga' });
      continue;
    }
    const firstLeg = a.legs[0];
    const ret = a.returnLegs[0];
    if (firstLeg && t < firstLeg.t0) {
      out.push({ unit: u, pos: u.base, state: 'siaga' });
      continue;
    }
    const going = legPos(a.legs, t);
    if (going && t < a.onSceneH) {
      out.push({ unit: u, pos: going, state: 'menuju' });
      continue;
    }
    if (ret && t >= ret.t0) {
      const back = legPos(a.returnLegs, t);
      out.push({ unit: u, pos: back ?? u.base, state: back ? 'kembali' : 'selesai' });
      continue;
    }
    if (a.shuttle && t >= a.shuttle.t0 && t <= a.shuttle.t1) {
      const ph = ((t - a.shuttle.t0) / a.shuttle.cycleH) % 1;
      const f = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      out.push({ unit: u, pos: [a.shuttle.a[0] + (a.shuttle.b[0] - a.shuttle.a[0]) * f, a.shuttle.a[1] + (a.shuttle.b[1] - a.shuttle.a[1]) * f], state: 'suplai' });
      continue;
    }
    if (a.shuttle) {
      out.push({ unit: u, pos: t > a.shuttle.t1 ? a.shuttle.a : a.legs[a.legs.length - 1]?.to ?? u.base, state: 'siaga' });
      continue;
    }
    if (a.workPath.length) {
      out.push({ unit: u, pos: alongLL(a.workPath, workFrac(a, t)), state: t <= a.workT1 ? 'bekerja' : 'selesai' });
      continue;
    }
    out.push({ unit: u, pos: u.base, state: 'siaga' });
  }

  const built: LonLat[][] = [];
  const todo: LonLat[][] = [];
  let doneKm = 0;
  let allKm = 0;
  for (const sec of plan.sectors) {
    const a = sec.unitIds.map((id) => byUnit.get(id)).find(Boolean);
    const f = a ? workFrac(a, t) * (a.workPath.length && sec.path.length ? a.workPath.length / sec.path.length : 1) : 0;
    const sp = splitLL(sec.path, f);
    if (sp.done.length >= 2) built.push(sp.done);
    if (sp.todo.length >= 2) todo.push(sp.todo);
    if (sec.kind !== 'desa') {
      doneKm += sec.lengthKm * Math.min(1, f);
      allKm += sec.lengthKm;
    }
  }

  return {
    t,
    areaKm2: plan.areaCurve[q] ?? 0,
    phase: phaseAt(plan, t),
    units: out,
    built,
    todo,
    builtPct: allKm > 0 ? Math.round((doneKm / allKm) * 100) : 0,
  };
}

/** Langkah raster api (0..max) dengan luas terdekat dari bawah ke luas rencana. */
export function fireStepForArea(burnedKm2ByStep: number[], area: number): number {
  for (let s = 0; s < burnedKm2ByStep.length; s++) if (burnedKm2ByStep[s] >= area - 1e-6) return s;
  return burnedKm2ByStep.length - 1;
}
