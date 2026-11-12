'use client';

import type { Map as MlMap } from 'maplibre-gl';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import WindParticles from '@/components/map/WindParticles';
import { Segmented, Spinner, Switch } from '@/components/ui/primitives';
import SiteHeader from '@/components/ui/SiteHeader';
import { compass, nf } from '@/lib/format';
import { ScenarioSlug } from '@/lib/schemas';
import { useSim } from '@/stores/simStore';
import ControlPanel from './ControlPanel';
import LayersMenu from './LayersMenu';
import Legend from './Legend';
import ResultsPanel from './ResultsPanel';
import TimeScrubber from './TimeScrubber';
import { useSimRunner } from './useSimRunner';

function panelPadding() {
  if (typeof window === 'undefined') return undefined;
  const w = window.innerWidth;
  if (w >= 1280) return { left: 340, right: 400, top: 60, bottom: 110 };
  if (w >= 1024) return { left: 340, right: 0, top: 60, bottom: 110 };
  return { left: 0, right: 0, top: 40, bottom: 120 };
}

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => <div className="skeleton absolute inset-0" />,
});

function StatusChip() {
  const windMs = useSim((s) => s.windMs);
  const from = useSim((s) => s.windFromDeg);
  const running = useSim((s) => s.running);
  return (
    <div className="flex h-10 items-center gap-2 rounded-full border border-line-dark bg-bg-surface px-4 text-sm shadow-float">
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ transform: `rotate(${(from + 180) % 360}deg)` }} aria-hidden="true">
        <path d="M8 1 13 12 8 9.5 3 12z" fill="#4fc3f7" />
      </svg>
      <span className="num font-semibold">{nf(windMs)} m/s</span>
      <span className="text-text-secondary">dari {compass(from)}</span>
      {running && (
        <span className="ml-1 flex items-center gap-1.5 text-text-secondary" role="status">
          <Spinner size={14} /> Menghitung
        </span>
      )}
    </div>
  );
}

type SheetTab = 'kondisi' | 'dampak' | 'sekat' | 'briefing';

export default function Simulator() {
  const params = useSearchParams();
  const router = useRouter();
  const runner = useSimRunner();
  const s = useSim();
  const [map, setMap] = useState<MlMap | null>(null);
  const [mapB, setMapB] = useState<MlMap | null>(null);
  const [lowPower, setLowPower] = useState(false);
  const [sheet, setSheet] = useState<SheetTab>('dampak');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const syncing = useRef(false);
  const [padding] = useState(panelPadding);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 5000);
  };

  // Muat skenario dari URL lalu langsung jalankan simulasi (tanpa tombol "Jalankan").
  useEffect(() => {
    const parsed = ScenarioSlug.safeParse(params.get('scenario') ?? 'riau');
    const slug = parsed.success ? parsed.data : 'riau';
    (async () => {
      try {
        await runner.loadScenario(slug);
        await runner.run();
      } catch {
        showToast('Simulasi gagal dimuat. Muat ulang halaman atau aktifkan Mode Demo.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, s.demoMode]);

  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    up();
    window.addEventListener('online', up);
    window.addEventListener('offline', up);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', up);
    };
  }, []);

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
    router.replace(`/simulator?scenario=${slug}`, { scroll: false });
  };

  const onWind = useCallback(
    (p: { windMs?: number; windFromDeg?: number; dryness?: number }) => {
      useSim.getState().set(p);
      runner.onWindChanged();
    },
    [runner],
  );

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
  const mapCommon = {
    scenario: s.scenario,
    timeStep: s.timeStep,
    layers: s.layers,
    hotspots: s.hotspots?.items ?? [],
    recommendations: s.recommendations,
    activeRank: s.activeRank,
  };
  const results = (
    <ResultsPanel onRecommend={onRecommend} onApply={runner.applyBreak} onBriefing={runner.makeBriefing} onSave={onSave} saving={saving} />
  );

  return (
    <div className="theme-dark flex h-dvh flex-col overflow-hidden">
      <SiteHeader
        dark
        right={
          <div className="hidden w-44 sm:block">
            <Switch
              checked={s.demoMode}
              onChange={(v) => s.set({ demoMode: v })}
              label={<span className="font-semibold">Mode Demo</span>}
              hint={s.demoMode ? 'Data lokal, tanpa internet' : undefined}
            />
          </div>
        }
      />
      {!online && !s.demoMode && (
        <div className="flex items-center justify-center gap-3 bg-bg-elevated px-4 py-2 text-sm" role="status">
          Anda sedang offline.
          <button className="font-semibold text-wind underline-offset-4 hover:underline" onClick={() => s.set({ demoMode: true })}>
            Aktifkan Mode Demo
          </button>
        </div>
      )}
      <main className="sim-map relative min-h-0 flex-1">
        {/* Peta */}
        <div className={`absolute inset-y-0 left-0 ${s.compare ? 'right-0 grid grid-cols-2 gap-px bg-line-dark xl:right-[412px]' : 'right-0'}`}>
          <div className="relative h-full">
            <MapView {...mapCommon} result={main} appliedRank={s.compare ? null : s.appliedRank} onMap={setMap} padding={padding} />
            <WindParticles
              windMs={s.windMs}
              windFromDeg={s.windFromDeg}
              enabled={s.layers.particles}
              map={map}
              count={lowPower ? 1200 : 2500}
              onLowFps={() => {
                if (!lowPower) {
                  setLowPower(true);
                  showToast('Mode ringan aktif: partikel angin dikurangi agar peta tetap lancar.');
                }
              }}
            />
            {s.compare && (
              <p className="num absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-bg-surface px-4 py-2 text-sm font-semibold shadow-float">
                Tanpa sekat: {nf(s.baseline?.burnedKm2 ?? 0)} km²
              </p>
            )}
          </div>
          {s.compare && (
            <div className="relative h-full">
              <MapView {...mapCommon} result={s.withBreak} appliedRank={s.appliedRank} onMap={setMapB} showControls={false} autoFly={false} />
              <p className="num absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-text-primary px-4 py-2 text-sm font-semibold text-bg-base shadow-float">
                Dengan sekat: {nf(s.withBreak?.burnedKm2 ?? 0)} km²
              </p>
            </div>
          )}
        </div>

        {/* Status angin + lapisan */}
        {!s.compare && (
          <div className="absolute left-4 right-4 top-4 z-20 flex items-start justify-center gap-2 lg:left-[352px] xl:right-[428px]">
            <div className="hidden sm:block">
              <StatusChip />
            </div>
            <LayersMenu />
          </div>
        )}

        {/* Panel kiri: kondisi */}
        <aside
          aria-label="Kondisi simulasi"
          className={`absolute bottom-[112px] left-4 top-4 z-20 hidden w-80 overflow-y-auto rounded-[24px] border border-line-dark bg-bg-surface p-4 shadow-float ${
            s.compare ? '' : 'lg:block'
          }`}
        >
          <ControlPanel onScenario={onScenario} onWind={onWind} />
        </aside>

        {/* Panel kanan: hasil */}
        <aside
          aria-label="Hasil simulasi"
          className="absolute bottom-[112px] right-4 top-4 z-20 hidden w-[380px] overflow-y-auto rounded-[24px] border border-line-dark bg-bg-surface p-4 shadow-float xl:block"
        >
          {results}
        </aside>

        {/* Legenda */}
        {!s.compare && (
          <div className="absolute bottom-[112px] left-4 z-10 hidden lg:left-[352px] lg:block">
            <Legend />
          </div>
        )}

        {/* Bilah waktu */}
        <div
          className={`absolute bottom-4 left-4 right-4 z-20 hidden rounded-[24px] border border-line-dark bg-bg-surface px-4 py-3 shadow-float lg:block xl:right-[412px] ${
            s.compare ? '' : 'lg:left-[352px]'
          }`}
        >
          <TimeScrubber disabled={!s.baseline} />
        </div>

        {/* Seluler & tablet: lembar bawah */}
        <div className="absolute inset-x-0 bottom-0 z-30 xl:hidden">
          <div className="mx-3 mb-2 rounded-[20px] border border-line-dark bg-bg-surface px-3 py-2 shadow-float lg:hidden">
            <TimeScrubber disabled={!s.baseline} />
          </div>
          <div className="rounded-t-[20px] border-t border-line-dark bg-bg-surface px-3 pt-3">
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
                { value: 'briefing' as const, label: 'Briefing' },
              ]}
            />
            <button
              onClick={() => setSheetOpen(!sheetOpen)}
              className="mx-auto my-1 block h-6 w-full text-xs font-semibold text-text-muted"
              aria-expanded={sheetOpen}
            >
              {sheetOpen ? 'Tutup panel' : 'Buka panel'}
            </button>
            {sheetOpen && (
              <div className="max-h-[50dvh] overflow-y-auto pb-4">
                {sheet === 'kondisi' ? (
                  <ControlPanel onScenario={onScenario} onWind={onWind} />
                ) : (
                  <ResultsPanel
                    hideTabs
                    onRecommend={onRecommend}
                    onApply={runner.applyBreak}
                    onBriefing={runner.makeBriefing}
                    onSave={onSave}
                    saving={saving}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {toast && (
          <div role="status" className="absolute bottom-32 left-1/2 z-50 w-[min(420px,calc(100%-32px))] -translate-x-1/2 rounded-[12px] bg-text-primary px-4 py-3 text-sm font-medium text-bg-base shadow-float">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}
