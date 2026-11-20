'use client';

import { useEffect, useMemo } from 'react';
import { buildPlans } from '@/lib/response/plan';
import type { PlanSet, ResponsePlan } from '@/lib/response/types';
import { STEP_MINUTES } from '@/lib/sim/params';
import { useSim } from '@/stores/simStore';

/** Hitung rencana respons dari hasil simulasi tanpa sekat (dihitung ulang bila masukan berubah). */
export function useResponsePlans(active: boolean): { set: PlanSet | null; plan: ResponsePlan | null } {
  const scenario = useSim((s) => s.scenario);
  const baseline = useSim((s) => s.baseline);
  const ignitions = useSim((s) => s.ignitions);
  const windMs = useSim((s) => s.windMs);
  const windFromDeg = useSim((s) => s.windFromDeg);
  const radius = useSim((s) => s.planRadius);
  const kinds = useSim((s) => s.planKinds);
  const planId = useSim((s) => s.planId);

  const refined = baseline?.quality === 'refined';
  const set = useMemo(() => {
    if (!active || !scenario || !baseline || !refined) return null;
    return buildPlans({
      slug: scenario.slug,
      center: scenario.center,
      villages: scenario.villages,
      rivers: scenario.rivers,
      waterPoints: scenario.waterPoints,
      grid: scenario.grid,
      fuelClass: scenario.fuelClass,
      peatMoisture: scenario.peatMoisture,
      ignitionCells: ignitions ?? scenario.ignitions,
      windMs,
      windFromDeg,
      arrival: baseline.arrival,
      burnedKm2ByStep: baseline.burnedByStep,
      stepMinutes: STEP_MINUTES,
      villageRisks: baseline.villageRisks,
      radiusKm: radius,
      kinds,
      edge: baseline.edge,
    });
  }, [active, scenario, baseline, refined, ignitions, windMs, windFromDeg, radius, kinds]);

  // Pilih rencana rekomendasi bila belum ada pilihan yang valid.
  useEffect(() => {
    if (!set) return;
    const st = useSim.getState();
    if (!st.planId || !set.plans.some((p) => p.id === st.planId)) {
      st.set({ planId: set.recommended ?? set.plans[0]?.id ?? null, planTime: 0, planPlaying: false });
    }
  }, [set]);

  // Persetujuan gugur bila kondisi berubah (rencana yang disetujui tidak lagi sama).
  useEffect(() => {
    const st = useSim.getState();
    if (set && st.approval && st.approval.signature !== set.signature) st.set({ approval: null });
  }, [set]);

  const plan = set?.plans.find((p) => p.id === planId) ?? null;
  return { set, plan };
}
