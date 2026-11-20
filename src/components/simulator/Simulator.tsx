'use client';

import type { Map as MlMap } from 'maplibre-gl';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WindParticles from '@/components/map/WindParticles';
import { PlanLegend, PlanNarration, PlanScrubber } from '@/components/response/PlanHud';
import { useResponsePlans } from '@/components/response/useResponsePlans';
import { IconChevronLeft, IconChevronRight, IconClose, IconFlame, IconTarget } from '@/components/ui/icons';
import { Segmented, Spinner } from '@/components/ui/primitives';
import SiteHeader from '@/components/ui/SiteHeader';
import { compass, nf } from '@/lib/format';
import { BREAK_LABELS, ignitionCellsAt } from '@/lib/geo';
import { fireStepForArea, planFrame } from '@/lib/response/frame';
import { type HotspotsResponse, ScenarioSlug } from '@/lib/schemas';
import { useSim } from '@/stores/simStore';
import ControlPanel from './ControlPanel';
import LayersMenu from './LayersMenu';
import Legend from './Legend';
import ResultsPanel from './ResultsPanel';
import TimeScrubber from './TimeScrubber';
import { useSimRunner } from './useSimRunner';

const PlanOverlay = dynamic(() => import('@/components/response/PlanOverlay'), { ssr: false });

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => <div className="skeleton absolute inset-0" />,
});

function WindChip({ onClick }: { onClick: () => void }) {
  const windMs = useSim((s) => s.windMs);
  const from = useSim((s) => s.windFromDeg);
  const running = useSim((s) => s.running);
  return (
    <button
      onClick={onClick}
      title="Ubah angin di panel Kondisi"
      className="flex h-10 items-center gap-2 rounded-full border border-line-dark bg-bg-surface px-4 text-sm shadow-float transition-colors hover:bg-bg-elevated"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ transform: `rotate(${(from + 180) % 360}deg)` }} aria-hidden="true">
        <path d="M8 1 13 12 8 9.5 3 12z" fill="#0a6994" />
      </svg>
      <span className="num font-semibold">{nf(windMs)} m/s</span>
      <span className="text-text-secondary">dari {compass(from)}</span>
      <span className="hidden text-wind md:inline">· Ubah</span>
      {running && (
        <span className="ml-1 flex items-center gap-1.5 text-text-secondary" role="status">
          <Spinner size={14} /> Menghitung
        </span>
      )}
    </button>
  );
}

function PanelHeader({ title, onClose, side }: { title: string; onClose: () => void; side: 'left' | 'right' }) {
  return (
    <div className="sticky -top-4 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between border-b border-line-dark bg-bg-surface px-4 py-3">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <button
        onClick={onClose}
        className="flex h-8 items-center gap-1 rounded-full px-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
        aria-label={`Sembunyikan panel ${title}`}
      >
        {side === 'left' ? <IconChevronLeft size={16} /> : null}
        Sembunyikan
        {side === 'right' ? <IconChevronRight size={16} /> : null}
      </button>
    </div>
  );
}

type SheetTab = 'kondisi' | 'dampak' | 'sekat' | 'respons' | 'briefing';

function useWidth() {
  const [w, setW] = useState(1440);
  useEffect(() => {
    const up = () => setW(window.innerWidth);
    up();
    window.addEventListener('resize', up);
    return () => window.removeEventListener('resize', up);
  }, []);
  return w;
}

export default function Simulator() {
  const params = useSearchParams();
  const router = useRouter();
  const runner = useSimRunner();
  const s = useSim();
  const width = useWidth();
  const [map, setMap] = useState<MlMap | null>(null);
  const [mapB, setMapB] = useState<MlMap | null>(null);
  const [lowPower, setLowPower] = useState(false);
  const [sheet, setSheet] = useState<SheetTab>('dampak');
  const [sheetOpenRaw, setSheetOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const syncing = useRef(false);
  const [refreshingHot, setRefreshingHot] = useState(false);
  const planMode = s.tab === 'respons' && !s.compare;
  const { set: planSet, plan } = useResponsePlans(s.tab === 'respons');
  const siagaIds = useMemo(() => new Set((planSet?.units ?? []).filter((u) => u.status === 'siaga').map((u) => u.id)), [planSet]);
  const frame = useMemo(
    () => (planMode && plan && planSet ? planFrame(plan, planSet.units, Math.min(s.planTime, plan.endH), siagaIds) : null),
    [planMode, plan, planSet, s.planTime, siagaIds],
  );
  // Saat memilih titik api, lembar bawah otomatis tertutup agar peta bisa diklik.
  const sheetOpen = sheetOpenRaw && !s.pickIgnition;

  const desktopLeft = width >= 1024 && leftOpen && !s.compare;
  const desktopRight = width >= 1280 && rightOpen;
  const padding = useMemo(
    () =>
      width >= 1024
        ? { left: desktopLeft ? 352 : 16, right: desktopRight ? 412 : 16, top: 64, bottom: 110 }
        : { left: 0, right: 0, top: 48, bottom: 140 },
    [width, desktopLeft, desktopRight],
  );

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 5000);
  };

  // Muat skenario. Kembali dari laporan: bila hasil masih ada di memori, lanjutkan tanpa reset.
  // Tautan dengan parameter (angin, arah, kering, api, sekat) mengembalikan konfigurasi yang sama.
  useEffect(() => {
    const parsed = ScenarioSlug.safeParse(params.get('scenario') ?? 'riau');
    const slug = parsed.success ? parsed.data : 'riau';
    const st = useSim.getState();
    const lokasi = params.get('lokasi')?.split(',').map(Number);
    (async () => {
      try {
        // Area langsung: titik panas mana pun di Indonesia, dibangun dari data nyata.
        if (lokasi && lokasi.length === 2 && lokasi.every(Number.isFinite)) {
          const [lat, lon] = lokasi;
          const key = params.toString();
          if (st.slug === 'live' && st.liveKey === key && st.baseline) {
            await runner.resume();
            return;
          }
          const ignitions = (params.get('api') ?? `${lon},${lat}`)
            .split(';')
            .map((p) => p.split(',').map(Number) as [number, number])
            .filter((p) => p.length === 2 && p.every(Number.isFinite))
            .slice(0, 12);
          await runner.loadLiveArea({ key, lat, lon, ignitions, province: params.get('prov') ?? 'Indonesia' });
          if (useSim.getState().liveKey !== key) return;
          if (params.get('tab') === 'respons') useSim.getState().set({ tab: 'respons' });
          await runner.run();
          return;
        }
        if (st.scenario?.slug === slug && st.baseline) {
          await runner.resume();
          return;
        }
        await runner.loadScenario(slug);
        const sc = useSim.getState().scenario;
        const num = (k: string, min: number, max: number) => {
          const v = Number(params.get(k));
          return params.has(k) && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;
        };
        const patch: Partial<ReturnType<typeof useSim.getState>> = {};
        const windMs = num('angin', 0, 20);
        const windFromDeg = num('arah', 0, 359);
        const dryness = num('kering', 0, 1);
        if (windMs !== undefined) patch.windMs = windMs;
        if (windFromDeg !== undefined) patch.windFromDeg = windFromDeg;
        if (dryness !== undefined) patch.dryness = dryness;
        const api = params.get('api')?.split(',').map(Number);
        if (sc && api && api.length === 2 && api.every(Number.isFinite)) {
          const cells = ignitionCellsAt(sc.grid, sc.fuelClass, api[0], api[1]);
          if (cells) patch.ignitions = cells;
        }
        if (params.get('tab') === 'respons') patch.tab = 'respons';
        useSim.getState().set(patch);
        await runner.run();
        const rank = Number(params.get('sekat'));
        if (rank >= 1 && rank <= 3) {
          await runner.recommend();
          if (useSim.getState().recommendations.some((r) => r.rank === rank)) await runner.applyBreak(rank);
        }
      } catch {
        showToast('Simulasi gagal dimuat. Muat ulang halaman.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Mode rencana: animasi api biasa dijeda; animasi rencana berhenti saat keluar.
  useEffect(() => {
    if (planMode) useSim.getState().set({ playing: false });
    else useSim.getState().set({ planPlaying: false });
  }, [planMode]);

  const { areaHotspots } = runner;
  const refreshHotspots = useCallback(async () => {
    const st = useSim.getState();
    if (st.demoMode) return;
    setRefreshingHot(true);
    try {
      if (st.slug === 'live' && st.scenario) {
        const hot = await areaHotspots(st.scenario.bbox);
        if (hot && useSim.getState().slug === 'live') useSim.getState().set({ hotspots: hot });
        return;
      }
      const res = await fetch(`/api/hotspots?scenario=${st.slug}&days=1`, { cache: 'no-store' });
      if (res.ok) {
        const hot = (await res.json()) as HotspotsResponse;
        if (useSim.getState().slug === st.slug) useSim.getState().set({ hotspots: hot });
      }
    } catch {
      // tetap memakai data terakhir
    } finally {
      setRefreshingHot(false);
    }
  }, [areaHotspots]);

  // Pantau titik panas langsung tiap 10 menit selama tab Respons terbuka.
  useEffect(() => {
    if (!planMode) return;
    const id = setInterval(() => void refreshHotspots(), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [planMode, refreshHotspots]);

  // Offline: otomatis memakai data cadangan (tanpa saklar "Mode Demo" yang membingungkan).
  useEffect(() => {
    const up = () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) useSim.getState().set({ demoMode: true });
    };
    up();
    window.addEventListener('online', up);
    window.addEventListener('offline', up);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', up);
    };
  }, []);

  useEffect(() => {
    if (!s.pickIgnition) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && useSim.getState().set({ pickIgnition: false });
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [s.pickIgnition]);

  // Kamera dua peta tersinkron pada mode bandingkan.
  useEffect(() => {
    if (!map || !mapB || !s.compare) return;
    mapB.jumpTo({ center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() });
    const link = (from: MlMap, to: MlMap) => () => {
      if (syncing.current) return;
      syncing.current = true;
      to.jumpTo({ center: from.getCenter(), zoom: from.getZoom(), bearing: from.getBearing(), pitch: from.getPitch() });
      syncing.current = false;
    };
    const a = link(map, mapB);
    const b = link(mapB, map);
    map.on('move', a);
    mapB.on('move', b);
    return () => {
      map.off('move', a);
      mapB.off('move', b);
    };
  }, [map, mapB, s.compare]);

  const onScenario = (slug: ScenarioSlug) => {
    if (s.appliedRank !== null && !window.confirm('Sekat yang diterapkan belum disimpan. Ganti wilayah?')) return;
    useSim.getState().set({ scenario: null, baseline: null });
    router.replace(`/peta?scenario=${slug}`, { scroll: false });
  };

  const onWind = useCallback(
    (p: { windMs?: number; windFromDeg?: number; dryness?: number }) => {
      useSim.getState().set(p);
      runner.onWindChanged();
    },
    [runner],
  );

  const resetView = () => {
    if (!map || !s.scenario) return;
    map.flyTo({ center: s.scenario.center, zoom: 11.9, pitch: 50, bearing: -15, duration: 1200, padding });
  };

  const narrow = width < 1280;
  const flyToBreak = (rank: number) => {
    const r = useSim.getState().recommendations.find((x) => x.rank === rank);
    if (!map || !r) return;
    const [a, b] = r.line.coordinates;
    map.easeTo({ center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], zoom: 12.4, duration: 900, padding });
  };

  const onShowBreak = (rank: number) => {
    if (useSim.getState().appliedRank === null) useSim.getState().set({ activeRank: rank });
    if (narrow) setSheetOpen(false);
    flyToBreak(rank);
  };

  const onApply = async (rank: number | null) => {
    if (rank !== null) {
      useSim.getState().set({ activeRank: rank });
      if (narrow) setSheetOpen(false);
      flyToBreak(rank);
      showToast(`Sekat ${BREAK_LABELS[rank - 1]} diterapkan. Garis berwarna di peta menunjukkan lokasinya (titik ${BREAK_LABELS[rank - 1]}1 ke ${BREAK_LABELS[rank - 1]}2).`);
    }
    await runner.applyBreak(rank);
    if (rank !== null) document.getElementById(`sekat-card-${rank}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const onFocusVillage = (name: string) => {
    const v = s.scenario?.villages.find((x) => x.name === name);
    if (!map || !v) return;
    if (narrow) setSheetOpen(false);
    map.flyTo({ center: [v.lon, v.lat], zoom: 13, duration: 1000, padding });
  };

  const onPick = (lon: number, lat: number) => {
    const sc = useSim.getState().scenario;
    if (!sc) return;
    const cells = ignitionCellsAt(sc.grid, sc.fuelClass, lon, lat);
    if (!cells) {
      showToast('Pilih titik di dalam kotak area simulasi (garis putus-putus) dan bukan di sungai.');
      return;
    }
    useSim.getState().set({ ignitions: cells, pickIgnition: false });
    showToast('Titik awal api dipindah. Simulasi dijalankan ulang dari jam 0.');
    void runner.onIgnitionChanged();
  };

  const onResetIgnition = () => {
    useSim.getState().set({ ignitions: null, pickIgnition: false });
    void runner.onIgnitionChanged();
  };

  const onRecommend = async () => {
    useSim.getState().set({ tab: 'sekat' });
    await runner.recommend();
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const id = await runner.save();
      router.push(`/report/${id}?baru=1`);
    } catch {
      showToast('Laporan gagal disimpan. Periksa koneksi lalu coba lagi.');
      setSaving(false);
    }
  };

  const main = s.compare ? s.baseline : (s.withBreak ?? s.baseline);
  const planStep = planMode && frame && s.baseline ? fireStepForArea(s.baseline.burnedByStep, frame.areaKm2) : null;
  const mapCommon = {
    scenario: s.scenario,
    timeStep: planStep ?? s.timeStep,
    layers: s.layers,
    hotspots: s.hotspots?.items ?? [],
    recommendations: s.recommendations,
    activeRank: s.activeRank,
    ignitionCells: s.ignitions ?? undefined,
    ignitionCustom: s.ignitions !== null,
    pickMode: s.pickIgnition,
    onPick,
  };
  const resultsProps = {
    onRecommend,
    onApply,
    onShowBreak,
    onFocusVillage,
    onBriefing: runner.makeBriefing,
    onSave,
    saving,
    planSet,
    plan,
    onRefreshHotspots: () => void refreshHotspots(),
    refreshingHotspots: refreshingHot,
  };
  const particles = (m: MlMap | null) => (
    <WindParticles
      windMs={s.windMs}
      windFromDeg={s.windFromDeg}
      enabled={s.layers.particles}
      map={m}
      count={lowPower ? 400 : 700}
      onLowFps={() => {
        if (!lowPower) setLowPower(true);
      }}
    />
  );

  const leftEdge = desktopLeft ? 'lg:left-[352px]' : 'lg:left-4';
  const rightEdge = desktopRight ? 'xl:right-[412px]' : 'xl:right-4';

  return (
    <div className="theme-sim flex h-dvh flex-col overflow-hidden">
      <div className="border-b border-line bg-card">
        <SiteHeader />
      </div>
      {!online && (
        <div className="bg-bg-elevated px-4 py-2 text-center text-sm" role="status">
          Anda sedang offline. Simulasi tetap berjalan dengan data cadangan yang tersimpan di aplikasi.
        </div>
      )}
      <main className={`sim-map relative min-h-0 flex-1 ${desktopRight ? 'right-open' : ''}`}>
        {/* Peta */}
        <div className={`absolute inset-y-0 left-0 right-0 ${s.compare ? `grid grid-cols-2 gap-px bg-line-dark ${desktopRight ? 'xl:right-[412px]' : ''}` : ''}`}>
          <div className="relative h-full">
            <MapView
              {...mapCommon}
              result={planMode ? s.baseline : main}
              appliedRank={s.compare ? null : s.appliedRank}
              showBreaks={!s.compare}
              onMap={setMap}
              padding={s.compare ? undefined : padding}
            />
            {particles(map)}
            {planMode && planSet && plan && frame && <PlanOverlay map={map} set={planSet} plan={plan} frame={frame} padding={padding} />}
            {s.compare && (
              <p className="num absolute left-1/2 top-16 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-bg-surface px-4 py-2 text-sm font-semibold shadow-float">
                Tanpa sekat: {nf(s.baseline?.burnedKm2 ?? 0)} km²
              </p>
            )}
          </div>
          {s.compare && (
            <div className="relative h-full">
              <MapView {...mapCommon} result={s.withBreak} appliedRank={s.appliedRank} onMap={setMapB} showControls={false} autoFly={false} />
              {particles(mapB)}
              <p className="num absolute left-1/2 top-16 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-text-primary px-4 py-2 text-sm font-semibold text-bg-base shadow-float">
                Dengan Sekat {s.appliedRank ? BREAK_LABELS[s.appliedRank - 1] : ''}: {nf(s.withBreak?.burnedKm2 ?? 0)} km²
              </p>
            </div>
          )}
        </div>

        {/* Bar atas: angin, lapisan, tampilan awal (juga di mode bandingkan) */}
        <div className={`absolute left-4 right-4 top-4 z-20 flex flex-wrap items-start justify-center gap-2 ${leftEdge} ${rightEdge}`}>
          <div className="hidden sm:block">
            <WindChip
              onClick={() => {
                if (width >= 1024) {
                  setLeftOpen(true);
                  if (s.compare) s.set({ compare: false });
                } else {
                  setSheet('kondisi');
                  setSheetOpen(true);
                }
              }}
            />
          </div>
          <Link
            href="/peta"
            className="flex h-10 items-center gap-1.5 rounded-full border border-line-dark bg-bg-surface px-4 text-sm font-semibold shadow-float transition-colors hover:bg-bg-elevated"
            title="Kembali ke peta titik panas se-Indonesia"
          >
            <IconChevronLeft size={16} /> Peta nasional
          </Link>
          <LayersMenu />
          <button
            onClick={resetView}
            className="flex h-10 items-center gap-2 rounded-full border border-line-dark bg-bg-surface px-4 text-sm font-semibold shadow-float transition-colors hover:bg-bg-elevated"
            title="Kembali ke tampilan awal area simulasi"
          >
            <IconTarget size={18} /> <span className="hidden md:inline">Tampilan awal</span>
          </button>
          {s.compare && (
            <button
              onClick={() => s.set({ compare: false })}
              className="flex h-10 items-center gap-2 rounded-full bg-text-primary px-4 text-sm font-semibold text-bg-base shadow-float"
            >
              <IconClose size={16} /> Tutup perbandingan
            </button>
          )}
        </div>

        {/* Membangun area langsung */}
        {s.liveStep && (
          <div role="status" className="absolute left-1/2 top-1/2 z-40 w-[min(420px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-line-dark bg-bg-surface p-5 text-center shadow-float">
            <Spinner size={22} />
            <p className="mt-3 text-[15px] font-semibold">Menyiapkan simulasi di lokasi titik panas</p>
            <p className="mt-1 text-sm text-text-secondary">{s.liveStep}...</p>
          </div>
        )}

        {/* Mode pilih titik api */}
        {s.pickIgnition && (
          <div className="absolute left-1/2 top-[68px] z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#ffd43b] py-2 pl-4 pr-2 text-sm font-semibold text-[#1a1300] shadow-float">
            <IconFlame size={16} /> Klik lokasi di peta untuk memulai api
            <button onClick={() => s.set({ pickIgnition: false })} className="rounded-full bg-black/10 px-3 py-1 hover:bg-black/20">
              Batal
            </button>
          </div>
        )}

        {/* Panel kiri: kondisi */}
        {desktopLeft && (
          <aside
            aria-label="Kondisi simulasi"
            className="absolute bottom-[112px] left-4 top-4 z-20 hidden w-80 overflow-y-auto rounded-[24px] border border-line-dark bg-bg-surface p-4 shadow-float lg:block"
          >
            <PanelHeader title="Kondisi" side="left" onClose={() => setLeftOpen(false)} />
            <ControlPanel onScenario={onScenario} onWind={onWind} onResetIgnition={onResetIgnition} />
          </aside>
        )}
        {!desktopLeft && !s.compare && (
          <button
            onClick={() => setLeftOpen(true)}
            className="absolute left-4 top-4 z-20 hidden h-10 items-center gap-1.5 rounded-full border border-line-dark bg-bg-surface px-4 text-sm font-semibold shadow-float hover:bg-bg-elevated lg:flex"
          >
            Kondisi <IconChevronRight size={16} />
          </button>
        )}

        {/* Panel kanan: hasil */}
        {desktopRight && (
          <aside
            aria-label="Hasil simulasi"
            className="absolute bottom-[112px] right-4 top-4 z-20 hidden w-[380px] overflow-y-auto rounded-[24px] border border-line-dark bg-bg-surface p-4 shadow-float xl:block"
          >
            <PanelHeader title="Hasil" side="right" onClose={() => setRightOpen(false)} />
            <ResultsPanel {...resultsProps} />
          </aside>
        )}
        {!desktopRight && (
          <button
            onClick={() => setRightOpen(true)}
            className="absolute right-4 top-4 z-20 hidden h-10 items-center gap-1.5 rounded-full border border-line-dark bg-bg-surface px-4 text-sm font-semibold shadow-float hover:bg-bg-elevated xl:flex"
          >
            <IconChevronLeft size={16} /> Hasil
          </button>
        )}

        {/* Narasi rencana respons */}
        {planMode && plan && frame && (
          <div className={`absolute left-4 top-[68px] z-20 hidden md:block ${leftEdge}`}>
            <PlanNarration plan={plan} frame={frame} />
          </div>
        )}

        {/* Legenda */}
        <div className={`absolute bottom-[112px] left-4 z-10 hidden lg:block ${leftEdge}`}>
          {planMode ? <PlanLegend /> : <Legend />}
        </div>

        {/* Bilah waktu */}
        <div className={`absolute bottom-4 left-4 right-4 z-20 hidden rounded-[24px] border border-line-dark bg-bg-surface px-4 py-3 shadow-float lg:block ${leftEdge} ${rightEdge}`}>
          {planMode && plan ? <PlanScrubber plan={plan} /> : <TimeScrubber disabled={!s.baseline} />}
        </div>

        {/* Seluler & tablet: lembar bawah */}
        <div className="absolute inset-x-0 bottom-0 z-30 xl:hidden">
          <div className="mx-3 mb-2 rounded-[20px] border border-line-dark bg-bg-surface px-3 py-2 shadow-float lg:hidden">
            {planMode && plan ? <PlanScrubber plan={plan} /> : <TimeScrubber disabled={!s.baseline} />}
          </div>
          <div className="rounded-t-[20px] border-t border-line-dark bg-bg-surface px-3 pb-2 pt-3">
            <div className="flex items-center gap-2">
              <Segmented
                label="Bagian panel"
                value={sheet}
                onChange={(v) => {
                  setSheet(v);
                  setSheetOpen(true);
                  if (v !== 'kondisi') s.set({ tab: v });
                }}
                options={[
                  { value: 'kondisi' as const, label: 'Kondisi' },
                  { value: 'dampak' as const, label: 'Dampak' },
                  { value: 'sekat' as const, label: 'Sekat' },
                  { value: 'respons' as const, label: 'Respons' },
                  { value: 'briefing' as const, label: 'Brief' },
                ]}
                className="min-w-0 flex-1"
              />
              {sheetOpen && (
                <button
                  onClick={() => setSheetOpen(false)}
                  className="flex h-11 shrink-0 items-center gap-1 rounded-full bg-bg-elevated px-3 text-sm font-semibold"
                  aria-label="Tutup panel"
                >
                  <IconClose size={16} /> Tutup
                </button>
              )}
            </div>
            {!sheetOpen && <p className="py-1.5 text-center text-xs text-text-muted">Pilih tab di atas untuk membuka panel</p>}
            {sheetOpen && (
              <div className="mt-3 max-h-[50dvh] overflow-y-auto pb-4">
                {sheet === 'kondisi' ? (
                  <ControlPanel onScenario={onScenario} onWind={onWind} onResetIgnition={onResetIgnition} />
                ) : (
                  <ResultsPanel hideTabs {...resultsProps} />
                )}
              </div>
            )}
          </div>
        </div>

        {toast && (
          <div role="status" className="absolute bottom-32 left-1/2 z-50 w-[min(440px,calc(100%-32px))] -translate-x-1/2 rounded-[12px] bg-text-primary px-4 py-3 text-sm font-medium text-bg-base shadow-float">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}
