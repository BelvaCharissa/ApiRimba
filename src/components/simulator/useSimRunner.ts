'use client';

import * as Comlink from 'comlink';
import { useCallback, useEffect, useRef } from 'react';
import type { ScenarioData } from '@/lib/scenario';
import type { BriefingRequest, BriefingResponse, HotspotsResponse, SimulationSave, WeatherResponse } from '@/lib/schemas';
import { burnedByStep, cellsToKm2, expectedBurnedKm2 } from '@/lib/sim/engine';
import { cellCenter, int16ToBase64 } from '@/lib/sim/grid';
import { DEFAULT_PARAMS, DEFAULT_SEED, STEP_MINUTES, STEPS_12H } from '@/lib/sim/params';
import { villageRisks, villageRisksFromArrival } from '@/lib/sim/risk';
import { type FireResult, useSim } from '@/stores/simStore';
import type { PreviewResult, RefineResult, RunArgs, SimWorkerApi } from '@/workers/sim.worker';

const LABELS = ['A', 'B', 'C'];

function toResult(s: ScenarioData, r: PreviewResult | RefineResult, quality: FireResult['quality']): FireResult {
  const steps = burnedByStep(r.arrival, STEPS_12H);
  if ('prob' in r) {
    return {
      arrival: r.arrival,
      burnUntil: r.burnUntil,
      prob: r.prob,
      meanArrival: r.meanArrival,
      quality,
      burnedKm2: expectedBurnedKm2(r.prob, s.grid.cellSizeM),
      burnedByStep: steps.map((c) => cellsToKm2(c, s.grid.cellSizeM)),
      villageRisks: villageRisks(s.grid, s.villages, r.prob, r.meanArrival, STEP_MINUTES),
      ms: r.ms,
    };
  }
  return {
    arrival: r.arrival,
    burnUntil: r.burnUntil,
    prob: null,
    meanArrival: null,
    quality,
    burnedKm2: cellsToKm2(steps[STEPS_12H], s.grid.cellSizeM),
    burnedByStep: steps.map((c) => cellsToKm2(c, s.grid.cellSizeM)),
    villageRisks: villageRisksFromArrival(s.grid, s.villages, r.arrival, STEP_MINUTES),
    ms: r.ms,
  };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  return (await res.json()) as T;
}

/** Mengatur worker simulasi, pemuatan data, dan semua aksi simulator. */
export function useSimRunner() {
  const workerRef = useRef<Comlink.Remote<SimWorkerApi> | null>(null);
  const rawWorker = useRef<Worker | null>(null);
  const reqId = useRef(0);
  const timers = useRef<{ preview?: ReturnType<typeof setTimeout>; refine?: ReturnType<typeof setTimeout> }>({});

  useEffect(() => {
    const w = new Worker(new URL('../../workers/sim.worker.ts', import.meta.url), { type: 'module' });
    rawWorker.current = w;
    workerRef.current = Comlink.wrap<SimWorkerApi>(w);
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  const args = useCallback((firebreak = false): RunArgs => {
    const s = useSim.getState();
    const rec = firebreak ? s.recommendations.find((r) => r.rank === s.appliedRank) : undefined;
    return {
      windMs: s.windMs,
      windFromDeg: s.windFromDeg,
      dryness: s.dryness,
      seed: DEFAULT_SEED,
      firebreakCells: rec?.cells ?? [],
    };
  }, []);

  /** Muat skenario, hotspot, dan cuaca. */
  const loadScenario = useCallback(async (slug: ScenarioData['slug']) => {
    const set = useSim.getState().set;
    set({
      loading: true,
      slug: slug as never,
      baseline: null,
      withBreak: null,
      hasRun: false,
      recommendations: [],
      recState: 'idle',
      appliedRank: null,
      activeRank: null,
      compare: false,
      briefing: null,
      timeStep: 0,
      playing: false,
    });
    const demo = useSim.getState().demoMode;
    const scenario = await getJson<ScenarioData>(`/data/scenarios/${slug}.json`);
    const [hot, weather] = await Promise.all([
      (demo
        ? getJson<Omit<HotspotsResponse, 'scenario'>>(`/data/fallback/hotspots-${slug}.json`).then((d) => ({ ...d, source: 'demo' }))
        : getJson<HotspotsResponse>(`/api/hotspots?scenario=${slug}&days=1`)
      ).catch(() => null),
      (demo
        ? getJson<Omit<WeatherResponse, 'scenario'>>(`/data/fallback/weather-${slug}.json`).then((d) => ({ ...d, source: 'demo' }))
        : getJson<WeatherResponse>(`/api/weather?scenario=${slug}`)
      ).catch(() => null),
    ]);
    await workerRef.current?.setScenario(scenario);
    if (useSim.getState().slug !== slug) return;
    // Angin awal memakai preset skenario agar cerita demo konsisten; angin cuaca terkini
    // dapat dipakai lewat tombol "Pakai angin terkini" di panel kontrol.
    set({
      scenario,
      hotspots: hot as HotspotsResponse | null,
      weather: weather as WeatherResponse | null,
      windMs: scenario.defaultWindMs,
      windFromDeg: scenario.defaultWindFromDeg,
      windSource: 'preset',
      dryness: scenario.defaultDryness,
      loading: false,
    });
  }, []);

  const computeBreak = useCallback(async (id: number) => {
    const s = useSim.getState();
    if (!s.scenario || s.appliedRank === null || !workerRef.current) return;
    const r = await workerRef.current.refine(args(true));
    if (id !== reqId.current) return;
    useSim.getState().set({ withBreak: toResult(s.scenario, r, 'refined') });
  }, [args]);

  const refine = useCallback(async (id: number) => {
    const s = useSim.getState();
    if (!s.scenario || !workerRef.current) return;
    const r = await workerRef.current.refine(args(false));
    if (id !== reqId.current) return;
    useSim.getState().set({ baseline: toResult(s.scenario, r, 'refined'), running: false });
    if (useSim.getState().appliedRank !== null) await computeBreak(id);
  }, [args, computeBreak]);

  const preview = useCallback(async (id: number) => {
    const s = useSim.getState();
    if (!s.scenario || !workerRef.current) return;
    const r = await workerRef.current.preview(args(false));
    if (id !== reqId.current) return;
    useSim.getState().set({ baseline: toResult(s.scenario, r, 'preview') });
  }, [args]);

  /** Tombol Jalankan: pratinjau cepat, lalu hasil halus, lalu animasi dari jam 0. */
  const run = useCallback(async () => {
    const id = ++reqId.current;
    useSim.getState().set({ running: true, hasRun: true, timeStep: 0, playing: true });
    await preview(id);
    await refine(id);
  }, [preview, refine]);

  /** Dipanggil saat angin berubah: pratinjau setelah 120 ms, hasil halus 300 ms setelah berhenti. */
  const onWindChanged = useCallback(() => {
    const s = useSim.getState();
    if (!s.hasRun) return;
    if (s.recState === 'done') s.set({ recState: 'stale' });
    s.set({ briefing: null });
    const id = ++reqId.current;
    clearTimeout(timers.current.preview);
    clearTimeout(timers.current.refine);
    timers.current.preview = setTimeout(() => void preview(id), 120);
    timers.current.refine = setTimeout(() => void refine(id), 420);
  }, [preview, refine]);

  const recommend = useCallback(async () => {
    const s = useSim.getState();
    if (!workerRef.current || !s.baseline) return;
    s.set({ recState: 'running', recProgress: 0, appliedRank: null, withBreak: null, compare: false, activeRank: null, briefing: null });
    const res = await workerRef.current.recommend(
      args(false),
      Comlink.proxy((done: number, total: number) => useSim.getState().set({ recProgress: done / total })),
    );
    useSim.getState().set({
      recState: 'done',
      recommendations: res.recommendations,
      recEmptyReason: res.emptyReason,
      recCandidates: res.candidatesTested,
      activeRank: res.recommendations[0]?.rank ?? null,
    });
  }, [args]);

  const applyBreak = useCallback(async (rank: number | null) => {
    const s = useSim.getState();
    s.set({ appliedRank: rank, withBreak: null, briefing: null, compare: rank === null ? false : s.compare });
    if (rank !== null) {
      const id = reqId.current;
      await computeBreak(id);
    }
  }, [computeBreak]);

  const briefingRequest = useCallback((): BriefingRequest | null => {
    const s = useSim.getState();
    if (!s.scenario || !s.baseline) return null;
    const pop = new Map(s.scenario.villages.map((v) => [v.name, v.population]));
    return {
      scenarioName: s.scenario.name,
      province: s.scenario.province,
      windMs: s.windMs,
      windFromDeg: s.windFromDeg,
      dryness: s.dryness,
      burnedKm2: Math.round(s.baseline.burnedKm2 * 10) / 10,
      burnedKm2WithFirebreak: s.withBreak ? Math.round(s.withBreak.burnedKm2 * 10) / 10 : null,
      villages: (s.withBreak ?? s.baseline).villageRisks.map((v) => ({
        name: v.villageName,
        etaHours: v.etaHours,
        level: v.level,
        population: pop.get(v.villageName) ?? 0,
      })),
      recommendations: s.recommendations.map((r) => ({
        label: LABELS[r.rank - 1],
        score: r.score,
        reductionPct: r.reductionPct,
        marginHours: r.marginHours,
        lengthKm: r.lengthKm,
        peatBypassRisk: r.peatBypassRisk,
      })),
      appliedFirebreak: s.appliedRank ? LABELS[s.appliedRank - 1] : null,
      emptyReason: s.recState === 'done' ? s.recEmptyReason : null,
    };
  }, []);

  const makeBriefing = useCallback(async () => {
    const body = briefingRequest();
    if (!body) return;
    useSim.getState().set({ briefingState: 'loading' });
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      useSim.getState().set({ briefing: (await res.json()) as BriefingResponse, briefingState: 'idle' });
    } catch {
      useSim.getState().set({ briefingState: 'error' });
    }
  }, [briefingRequest]);

  /** Simpan ke Supabase lalu kembalikan id laporan. */
  const save = useCallback(async (): Promise<string> => {
    const s = useSim.getState();
    if (!s.scenario || !s.baseline) throw new Error('Belum ada simulasi');
    const main = s.withBreak ?? s.baseline;
    const payload: SimulationSave = {
      scenarioSlug: s.slug,
      label: `${s.scenario.name}, angin ${s.windMs} m/s`,
      windMs: s.windMs,
      windFromDeg: Math.round(s.windFromDeg) % 360,
      seed: DEFAULT_SEED,
      steps: STEPS_12H,
      stepMinutes: STEP_MINUTES,
      ignitions: s.scenario.ignitions.map((c) => {
        const [lon, lat] = cellCenter(s.scenario!.grid, c);
        return { lon, lat };
      }),
      params: { ...DEFAULT_PARAMS },
      dataSource: s.demoMode ? 'demo' : s.weather?.stale ? 'fallback' : 'live',
      summary: {
        burnedKm2By12h: Math.round(s.baseline.burnedKm2 * 10) / 10,
        burnedKm2WithFirebreak: s.withBreak ? Math.round(s.withBreak.burnedKm2 * 10) / 10 : null,
        burnedCellsByStep: burnedByStep(main.arrival, STEPS_12H),
        dryness: s.dryness,
        maxProb: main.prob ? Math.max(...main.prob) : 1,
      },
      arrivalB64: int16ToBase64(main.arrival),
      firebreakApplied: s.appliedRank !== null,
      aiBriefing: s.briefing?.text,
      recommendations: s.recommendations.map((r) => ({
        rank: r.rank,
        line: r.line,
        widthM: r.widthM,
        lengthKm: r.lengthKm,
        score: r.score,
        reductionPct: r.reductionPct,
        marginHours: Math.max(-99, Math.min(99, r.marginHours)),
        villagesSaved: r.villagesSaved,
        peatBypassRisk: r.peatBypassRisk,
        note: r.note.slice(0, 400),
        applied: r.rank === s.appliedRank,
      })),
      villageRisks: [
        ...s.baseline.villageRisks.map((v) => ({ ...v, variant: 'baseline' as const })),
        ...(s.withBreak?.villageRisks ?? []).map((v) => ({ ...v, variant: 'with_firebreak' as const })),
      ],
    };
    const res = await fetch('/api/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Gagal menyimpan');
    const { id } = (await res.json()) as { id: string };
    return id;
  }, []);

  return { loadScenario, run, onWindChanged, recommend, applyBreak, makeBriefing, save };
}
