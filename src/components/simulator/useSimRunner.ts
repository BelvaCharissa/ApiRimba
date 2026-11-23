'use client';

import * as Comlink from 'comlink';
import { currentLang, t } from '@/lib/i18n';
import { useCallback, useEffect, useRef } from 'react';
import { bearingDeg, breakSentence, describeBreak, distanceKm, ignitionPoint, touchesEdge } from '@/lib/geo';
import { compass, fmtTimeWIB } from '@/lib/format';
import type { ScenarioData } from '@/lib/scenario';
import type { BriefingRequest, BriefingResponse, HotspotsResponse, ScenarioSlug, SimulationSave, WeatherResponse } from '@/lib/schemas';
import { buildLiveArea, gridBbox, liveGrid } from '@/lib/live/area';
import type { NationalHotspots } from '@/lib/pantau';
import { arrivalWeights, estimateCarbon } from '@/lib/sim/carbon';
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
      carbon: estimateCarbon(s.fuelClass, r.prob, s.grid.cellSizeM),
      villageRisks: villageRisks(s.grid, s.villages, r.prob, r.meanArrival, STEP_MINUTES),
      edge: touchesEdge(s.grid, r.arrival),
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
    carbon: estimateCarbon(s.fuelClass, arrivalWeights(r.arrival, STEPS_12H), s.grid.cellSizeM),
    villageRisks: villageRisksFromArrival(s.grid, s.villages, r.arrival, STEP_MINUTES),
    edge: touchesEdge(s.grid, r.arrival),
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
    void workerRef.current.setLang(currentLang());
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
      ignitions: s.ignitions ?? undefined,
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
      ignitions: null,
      pickIgnition: false,
      timeStep: 0,
      playing: false,
      approval: null,
      planId: null,
      planTime: 0,
      planPlaying: false,
    });
    const demo = useSim.getState().demoMode;
    useSim.getState().set({ liveKey: null, liveStep: null });
    const scenario = await getJson<ScenarioData>(`/data/scenarios/${slug}.json`);
    await workerRef.current?.setScenario(scenario);
    if (useSim.getState().slug !== slug) return;
    // Angin awal memakai preset skenario agar cerita demo konsisten; cuaca langsung dapat
    // dipakai lewat tombol "Pakai cuaca sekarang". Simulasi tidak menunggu data luar.
    set({
      scenario,
      hotspots: null,
      weather: null,
      windMs: scenario.defaultWindMs,
      windFromDeg: scenario.defaultWindFromDeg,
      windSource: 'preset',
      dryness: scenario.defaultDryness,
      loading: false,
    });
    const hotUrl = demo ? `/data/fallback/hotspots-${slug}.json` : `/api/hotspots?scenario=${slug}&days=1`;
    const weatherUrl = demo ? `/data/fallback/weather-${slug}.json` : `/api/weather?scenario=${slug}`;
    void getJson<HotspotsResponse>(hotUrl)
      .then((hot) => useSim.getState().slug === slug && set({ hotspots: demo ? { ...hot, scenario: slug, source: 'demo' } : hot }))
      .catch(() => undefined);
    void getJson<WeatherResponse>(weatherUrl)
      .then((w) => useSim.getState().slug === slug && set({ weather: demo ? { ...w, scenario: slug, source: 'demo' } : w }))
      .catch(() => undefined);
  }, []);

  /** Titik panas langsung di sekitar area (dari data nasional NASA FIRMS). */
  const areaHotspots = useCallback(async (bbox: [number, number, number, number]): Promise<HotspotsResponse | null> => {
    try {
      const n = await getJson<NationalHotspots>('/api/pantau/hotspots');
      const pad = 0.05;
      return {
        scenario: 'live',
        source: n.source,
        fetchedAt: n.fetchedAt,
        stale: n.stale,
        items: n.items
          .filter((h) => !h.persistent && h.lon >= bbox[0] - pad && h.lon <= bbox[2] + pad && h.lat >= bbox[1] - pad && h.lat <= bbox[3] + pad)
          .map((h) => ({ id: h.id, lat: h.lat, lon: h.lon, acquiredAt: h.acquiredAt, confidence: h.confidence, frp: h.frp, satellite: h.satellite })),
      };
    } catch {
      return null;
    }
  }, []);

  /**
   * Area langsung: bangun grid 16 x 16 km dari citra nyata di sekitar titik panas, pakai cuaca
   * langsung di lokasi itu, dan titik panas satelit di sekitarnya.
   */
  const loadLiveArea = useCallback(
    async (p: { key: string; lat: number; lon: number; ignitions: [number, number][]; province: string }) => {
      const set = useSim.getState().set;
      set({
        loading: true,
        slug: 'live',
        liveKey: p.key,
        liveStep: t('Fetching live weather at the location', 'Mengambil cuaca langsung di lokasi'),
        scenario: null,
        hotspots: null,
        weather: null,
        baseline: null,
        withBreak: null,
        hasRun: false,
        recommendations: [],
        recState: 'idle',
        appliedRank: null,
        activeRank: null,
        compare: false,
        briefing: null,
        ignitions: null,
        pickIgnition: false,
        timeStep: 0,
        playing: false,
        approval: null,
        planId: null,
        planTime: 0,
        planPlaying: false,
      });
      const weather = await getJson<WeatherResponse>(`/api/weather?lat=${p.lat.toFixed(3)}&lon=${p.lon.toFixed(3)}`).catch(() => null);
      if (useSim.getState().liveKey !== p.key) return;
      const area = await buildLiveArea({
        ...p,
        dryness: weather?.dryness ?? 0.7,
        windMs: weather?.windMs ?? 4,
        windFromDeg: weather?.windFromDeg ?? 135,
        onStep: (label) => useSim.getState().liveKey === p.key && set({ liveStep: label }),
      });
      if (useSim.getState().liveKey !== p.key) return;
      await workerRef.current?.setScenario(area);
      set({
        scenario: area,
        weather,
        windMs: area.defaultWindMs,
        windFromDeg: area.defaultWindFromDeg,
        windSource: weather ? 'cuaca' : 'preset',
        dryness: area.defaultDryness,
        loading: false,
        liveStep: null,
      });
      void areaHotspots(gridBbox(liveGrid(p.lat, p.lon))).then((hot) => hot && useSim.getState().liveKey === p.key && set({ hotspots: hot }));
    },
    [areaHotspots],
  );

  /** Kembali ke simulator tanpa mereset: muat ulang skenario ke worker baru, pertahankan semua hasil. */
  const resume = useCallback(async () => {
    const sc = useSim.getState().scenario;
    if (sc) await workerRef.current?.setScenario(sc);
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

  /** Titik api berubah: sekat lama tidak berlaku lagi, jalankan ulang dari jam 0. */
  const onIgnitionChanged = useCallback(async () => {
    useSim.getState().set({
      recState: 'idle',
      recommendations: [],
      appliedRank: null,
      activeRank: null,
      withBreak: null,
      compare: false,
      briefing: null,
    });
    const id = ++reqId.current;
    useSim.getState().set({ running: true, timeStep: 0, playing: true });
    await preview(id);
    await refine(id);
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
    s.set({
      appliedRank: rank,
      activeRank: rank,
      withBreak: null,
      briefing: null,
      compare: rank !== null,
      timeStep: 0,
      playing: rank !== null,
    });
    if (rank !== null) {
      const id = reqId.current;
      await computeBreak(id);
    }
  }, [computeBreak]);

  const briefingRequest = useCallback((): BriefingRequest | null => {
    const s = useSim.getState();
    if (!s.scenario || !s.baseline) return null;
    const sc = s.scenario;
    const ign = ignitionPoint(sc.grid, s.ignitions ?? sc.ignitions);
    const vin = new Map(sc.villages.map((v) => [v.name, v]));
    const hot = [...(s.hotspots?.items ?? [])].sort((a, b) => b.frp - a.frp)[0];
    return {
      scenarioName: sc.name,
      province: sc.province,
      windMs: s.windMs,
      windFromDeg: s.windFromDeg,
      dryness: s.dryness,
      burnedKm2: Math.round(s.baseline.burnedKm2 * 10) / 10,
      burnedKm2WithFirebreak: s.withBreak ? Math.round(s.withBreak.burnedKm2 * 10) / 10 : null,
      ignition: { lat: ign[1], lon: ign[0], custom: s.ignitions !== null },
      firstHotspot: hot ? { lat: hot.lat, lon: hot.lon, when: fmtTimeWIB(hot.acquiredAt), frp: hot.frp } : null,
      villages: (s.withBreak ?? s.baseline).villageRisks.map((v) => {
        const vi = vin.get(v.villageName);
        return {
          name: v.villageName,
          etaHours: v.etaHours,
          level: v.level,
          population: vi?.population ?? 0,
          ...(vi
            ? {
                lat: vi.lat,
                lon: vi.lon,
                distanceKm: Math.round(distanceKm(ign, [vi.lon, vi.lat]) * 10) / 10,
                direction: compass(bearingDeg(ign, [vi.lon, vi.lat])),
              }
            : {}),
        };
      }),
      recommendations: s.recommendations.map((r) => {
        const d = describeBreak(r.line.coordinates, ign, sc.villages);
        return {
          label: LABELS[r.rank - 1],
          score: r.score,
          reductionPct: r.reductionPct,
          marginHours: r.marginHours,
          lengthKm: r.lengthKm,
          peatBypassRisk: r.peatBypassRisk,
          from: { lat: d.from[1], lon: d.from[0] },
          to: { lat: d.to[1], lon: d.to[0] },
          position: breakSentence(d).slice(0, 200),
        };
      }),
      appliedFirebreak: s.appliedRank ? LABELS[s.appliedRank - 1] : null,
      emptyReason: s.recState === 'done' ? s.recEmptyReason : null,
    };
  }, []);

  const makeBriefing = useCallback(async () => {
    const body = briefingRequest();
    if (!body) return;
    body.lang = currentLang();
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
    if (s.slug === 'live') throw new Error('Area langsung belum bisa disimpan');
    const main = s.withBreak ?? s.baseline;
    const payload: SimulationSave = {
      scenarioSlug: s.slug as ScenarioSlug,
      label: `${s.scenario.name}, angin ${s.windMs} m/s`,
      windMs: s.windMs,
      windFromDeg: Math.round(s.windFromDeg) % 360,
      seed: DEFAULT_SEED,
      steps: STEPS_12H,
      stepMinutes: STEP_MINUTES,
      ignitions: (s.ignitions ?? s.scenario.ignitions).map((c) => {
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

  return { loadScenario, loadLiveArea, areaHotspots, resume, run, onWindChanged, onIgnitionChanged, recommend, applyBreak, makeBriefing, save };
}
