'use client';

import type { Map as MlMap } from 'maplibre-gl';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import WindParticles from '@/components/map/WindParticles';
import SiteHeader from '@/components/ui/SiteHeader';
import { compass, nf } from '@/lib/format';
import { ScenarioSlug } from '@/lib/schemas';
import { useSim } from '@/stores/simStore';
import ControlPanel from './ControlPanel';
import Legend from './Legend';
import ResultsPanel from './ResultsPanel';
import TimeScrubber from './TimeScrubber';
import { useSimRunner } from './useSimRunner';

function panelPadding() {
  if (typeof window === 'undefined') return undefined;
  const w = window.innerWidth;
  if (w >= 1280) return { left: 340, right: 380, top: 20, bottom: 100 };
  if (w >= 1024) return { left: 340, right: 0, top: 20, bottom: 100 };
  return { left: 0, right: 0, top: 0, bottom: 160 };
}

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => <div className="skeleton absolute inset-0" />,
});

function WindBadge() {
  const windMs = useSim((s) => s.windMs);
  const from = useSim((s) => s.windFromDeg);
  return (
    <div className="pointer-events-none flex items-center gap-2 rounded-full border border-border-dark bg-bg-surface/90 px-3 py-1.5 text-xs shadow-panel">
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ transform: `rotate(${(from + 180) % 360}deg)` }} aria-hidden="true">
        <path d="M8 1 13 12 8 9.5 3 12z" fill="#4fc3f7" />
      </svg>
      <span className="font-mono tabular">{nf(windMs)} m/s</span>
      <span className="text-text-secondary">dari {compass(from)}</span>
    </div>
  );
}

export default function Simulator() {
  const params = useSearchParams();
  const router = useRouter();
  const runner = useSimRunner();
  const s = useSim();
  const [map, setMap] = useState<MlMap | null>(null);
  const [mapB, setMapB] = useState<MlMap | null>(null);
  const [lowPower, setLowPower] = useState(false);
  const [sheet, setSheet] = useState<'kontrol' | 'hasil' | null>('kontrol');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const syncing = useRef(false);
  const [padding] = useState(panelPadding);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 5000);
  };

  // Muat skenario dari URL (?scenario=riau).
  useEffect(() => {
    const parsed = ScenarioSlug.safeParse(params.get('scenario') ?? 'riau');
    const slug = parsed.success ? parsed.data : 'riau';
    void runner.loadScenario(slug);
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

  // Sinkron kamera dua peta pada mode bandingkan.
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
    if (s.appliedRank !== null && !window.confirm('Sekat yang diterapkan belum disimpan. Ganti skenario?')) return;
    router.replace(`/simulator?scenario=${slug}`, { scroll: false });
  };

  const onWind = useCallback(
    (p: { windMs?: number; windFromDeg?: number; dryness?: number }) => {
      useSim.getState().set({ ...p, ...(p.windMs !== undefined || p.windFromDeg !== undefined ? { windSource: 'manual' as const } : {}) });
      runner.onWindChanged();
    },
    [runner],
  );

  const onRun = async () => {
    try {
      await runner.run();
      setSheet('hasil');
    } catch {
      showToast('Simulasi gagal dijalankan. Coba lagi, atau aktifkan Mode Demo.');
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const id = await runner.save();
      router.push(`/report/${id}`);
    } catch {
      showToast('Gagal menyimpan laporan. Periksa koneksi lalu coba lagi.');
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

  const demoToggle = (
    <button
      onClick={() => s.set({ demoMode: !s.demoMode })}
      aria-pressed={s.demoMode}
      title={s.demoMode ? 'Mode Demo aktif: memakai data lokal tanpa internet.' : 'Aktifkan Mode Demo (data lokal)'}
      className="flex items-center gap-2 rounded-full border border-border-dark px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
    >
      <span className={`size-2 rounded-full ${s.demoMode ? 'bg-firebreak' : 'bg-text-muted'}`} />
      Mode Demo{s.demoMode ? ': data lokal' : ''}
    </button>
  );

  return (
    <div className="theme-dark flex h-dvh flex-col overflow-hidden">
      <SiteHeader dark right={demoToggle} />
      {!online && !s.demoMode && (
        <div className="flex items-center justify-center gap-3 bg-warn/15 px-4 py-2 text-sm text-warn" role="status">
          Anda sedang offline.
          <button className="font-semibold underline" onClick={() => s.set({ demoMode: true })}>
            Aktifkan Mode Demo
          </button>
        </div>
      )}
      <main className="relative min-h-0 flex-1">
        {/* Peta */}
        <div
          className={`absolute inset-y-0 left-0 ${
            s.compare ? 'right-0 grid grid-cols-2 gap-px bg-border-dark xl:right-[392px]' : 'right-0'
          }`}
        >
          <div className="relative h-full">
            <MapView
              {...mapCommon}
              result={main}
              appliedRank={s.compare ? null : s.appliedRank}
              onMap={setMap}
              padding={padding}
              onVillageClick={() => setSheet('hasil')}
            />
            <WindParticles
              windMs={s.windMs}
              windFromDeg={s.windFromDeg}
              enabled={s.layers.particles}
              map={map}
              count={lowPower ? 1200 : 2500}
              onLowFps={() => {
                if (!lowPower) {
                  setLowPower(true);
                  showToast('Mode ringan aktif: jumlah partikel angin dikurangi.');
                }
              }}
            />
            {s.compare && (
              <span className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-bg-surface/95 px-3 py-1 text-xs font-semibold">
                Tanpa sekat · {nf(s.baseline?.burnedKm2 ?? 0)} km²
              </span>
            )}
          </div>
          {s.compare && (
            <div className="relative h-full">
              <MapView
                {...mapCommon}
                result={s.withBreak}
                appliedRank={s.appliedRank}
                onMap={setMapB}
                showControls={false}
                autoFly={false}
              />
              <span className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-firebreak px-3 py-1 text-xs font-semibold text-bg-base">
                Dengan sekat · {nf(s.withBreak?.burnedKm2 ?? 0)} km²
              </span>
            </div>
          )}
        </div>

        {/* Label model + angin */}
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 hidden -translate-x-1/2 items-center gap-2 lg:flex">
          {!s.compare && <WindBadge />}
          {s.hasRun && !s.compare && (
            <span className="rounded-full border border-fire-mid/40 bg-bg-surface/90 px-3 py-1.5 text-xs text-fire-mid">
              Prediksi simulasi
            </span>
          )}
        </div>

        {/* Panel kiri (desktop) */}
        <aside
          aria-label="Kontrol simulasi"
          className={`absolute bottom-[104px] left-4 top-4 z-20 hidden w-80 overflow-y-auto ${s.compare ? '' : 'lg:block'} rounded-panel border border-border-dark bg-bg-surface/95 p-5 shadow-panel backdrop-blur`}
        >
          <ControlPanel onScenario={onScenario} onWind={onWind} onRun={onRun} />
          <div className="mt-6">
            <Legend />
          </div>
        </aside>

        {/* Panel kanan (desktop) */}
        <aside
          aria-label="Hasil simulasi"
          className="absolute bottom-[104px] right-4 top-4 z-20 hidden w-[360px] overflow-y-auto rounded-panel border border-border-dark bg-bg-surface/95 p-5 shadow-panel backdrop-blur xl:block"
        >
          <ResultsPanel
            onRecommend={runner.recommend}
            onApply={runner.applyBreak}
            onBriefing={runner.makeBriefing}
            onSave={onSave}
            saving={saving}
          />
        </aside>

        {/* Bilah waktu */}
        <div className={`absolute bottom-4 left-4 right-4 z-20 hidden rounded-panel border border-border-dark bg-bg-surface/95 px-4 py-3 shadow-panel backdrop-blur lg:block xl:right-[392px] ${s.compare ? '' : 'lg:left-[352px]'}`}>
          <TimeScrubber disabled={!s.baseline} />
        </div>

        {/* Seluler & tablet: bottom sheet */}
        <div className="absolute inset-x-0 bottom-0 z-20 xl:hidden">
          <div className="mx-3 mb-2 rounded-panel border border-border-dark bg-bg-surface/95 px-3 py-2 shadow-panel backdrop-blur lg:hidden">
            <TimeScrubber disabled={!s.baseline} />
          </div>
          <div className="border-t border-border-dark bg-bg-surface">
            <div className="flex" role="tablist">
              {(
                [
                  ['kontrol', 'Kontrol', 'lg:hidden'],
                  ['hasil', 'Hasil dan sekat', ''],
                ] as const
              ).map(([k, label, cls]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={sheet === k}
                  onClick={() => setSheet(sheet === k ? null : k)}
                  className={`flex-1 py-3 text-sm font-medium ${cls} ${
                    sheet === k ? 'border-b-2 border-cta text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {sheet && (
              <div className="max-h-[48dvh] overflow-y-auto p-4">
                {sheet === 'kontrol' ? (
                  <div className="lg:hidden">
                    <ControlPanel onScenario={onScenario} onWind={onWind} onRun={onRun} />
                  </div>
                ) : (
                  <ResultsPanel
                    onRecommend={runner.recommend}
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
          <div role="status" className="absolute bottom-28 right-4 z-50 max-w-sm rounded-card border border-border-dark bg-bg-elevated px-4 py-3 text-sm shadow-panel">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}
