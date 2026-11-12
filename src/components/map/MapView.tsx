'use client';

import {
  type GeoJSONSource,
  type ImageSource,
  Map as MlMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type StyleSpecification,
} from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { etaText, fmtTimeWIB, LEVEL_COLOR, LEVEL_LABEL, nf } from '@/lib/format';
import { paintFire } from '@/lib/render';
import type { ScenarioData } from '@/lib/scenario';
import type { HotspotItem } from '@/lib/schemas';
import type { FirebreakRecommendation, VillageRisk } from '@/lib/sim/types';
import type { FireResult, Layers } from '@/stores/simStore';

export interface MapViewProps {
  scenario: ScenarioData | null;
  result: FireResult | null;
  timeStep: number;
  layers: Layers;
  hotspots: HotspotItem[];
  recommendations: FirebreakRecommendation[];
  activeRank: number | null;
  appliedRank: number | null;
  theme?: 'dark' | 'light';
  /** Dipanggil saat peta siap (untuk sinkron kamera mode bandingkan & partikel angin). */
  onMap?: (map: MlMap | null) => void;
  onVillageClick?: (name: string) => void;
  showControls?: boolean;
  initialPitch?: number;
  /** false untuk peta kedua di mode bandingkan (kamera mengikuti peta utama). */
  autoFly?: boolean;
  /** Ruang kosong untuk panel melayang agar area api tidak tertutup. */
  padding?: { left: number; right: number; top: number; bottom: number };
}

// Worker MapLibre disalin ke public/ (scripts/copy-maplibre-worker.mjs) agar bundler tidak perlu memprosesnya.
setWorkerUrl('/vendor/maplibre-gl-worker.mjs');

const MINIMAL_DARK: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0e141c' } }],
};
const MINIMAL_LIGHT: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eef1ec' } }],
};

async function loadStyle(theme: 'dark' | 'light'): Promise<StyleSpecification | string> {
  const url =
    theme === 'dark'
      ? process.env.NEXT_PUBLIC_MAP_STYLE_DARK || 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT || 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error();
    return (await res.json()) as StyleSpecification;
  } catch {
    return theme === 'dark' ? MINIMAL_DARK : MINIMAL_LIGHT;
  }
}

function hatchImage(color: string): ImageData {
  const size = 10;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.lineTo(size, 0);
  ctx.moveTo(-size / 2, size / 2);
  ctx.lineTo(size / 2, -size / 2);
  ctx.moveTo(size / 2, size + size / 2);
  ctx.lineTo(size + size / 2, size / 2);
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

function corners(s: ScenarioData): [[number, number], [number, number], [number, number], [number, number]] {
  const { originLon: w, originLat: n, cellDegLon, cellDegLat, w: gw, h: gh } = s.grid;
  const e = w + gw * cellDegLon;
  const so = n - gh * cellDegLat;
  return [
    [w, n],
    [e, n],
    [e, so],
    [w, so],
  ];
}

function breakFeatures(recs: FirebreakRecommendation[], activeRank: number | null, appliedRank: number | null) {
  const labels = ['A', 'B', 'C'];
  return {
    type: 'FeatureCollection' as const,
    features: recs.map((r) => ({
      type: 'Feature' as const,
      properties: {
        rank: r.rank,
        label: `Sekat ${labels[r.rank - 1]} · skor ${nf(r.score, 0)}`,
        state: appliedRank === r.rank ? 'applied' : activeRank === r.rank ? 'active' : 'idle',
      },
      geometry: r.line,
    })),
  };
}

export default function MapView(props: MapViewProps) {
  const {
    scenario,
    result,
    timeStep,
    layers,
    hotspots,
    recommendations,
    activeRank,
    appliedRank,
    theme = 'dark',
    onMap,
    onVillageClick,
    showControls = true,
    initialPitch = 55,
    autoFly = true,
    padding,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const villageMarkers = useRef<Map<string, { marker: Marker; el: HTMLDivElement }>>(new Map());
  const hotspotMarkers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const loadedSlug = useRef<string | null>(null);
  const onMapRef = useRef(onMap);
  const onVillageRef = useRef(onVillageClick);
  useEffect(() => {
    onMapRef.current = onMap;
    onVillageRef.current = onVillageClick;
  });

  // Inisialisasi peta sekali.
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    const villages = villageMarkers.current;
    (async () => {
      const style = await loadStyle(theme);
      if (cancelled || !containerRef.current) return;
      try {
        map = new MlMap({
          container: containerRef.current,
          style,
          center: [102, 0.45],
          zoom: 11.3,
          pitch: initialPitch,
          bearing: -20,
          maxPitch: 70,
          attributionControl: { compact: true },
        });
      } catch {
        setWebglError(true);
        return;
      }
      mapRef.current = map;
      if (process.env.NODE_ENV !== 'production') (window as unknown as { __maps?: MlMap[] }).__maps = [map];
      if (showControls) map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
      map.on('load', () => {
        if (!map) return;
        try {
          map.addSource('dem', {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 14,
          });
          map.addSource('dem-shade', {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 14,
          });
          map.addLayer({
            id: 'hillshade',
            type: 'hillshade',
            source: 'dem-shade',
            paint: {
              'hillshade-exaggeration': 0.35,
              'hillshade-shadow-color': theme === 'dark' ? '#000000' : '#5a6b60',
              'hillshade-highlight-color': theme === 'dark' ? '#2a3546' : '#ffffff',
            },
          });
          map.setTerrain({ source: 'dem', exaggeration: 1.5 });
        } catch {
          // tanpa terrain: peta datar
        }
        map.addImage('hatch', hatchImage(theme === 'dark' ? 'rgba(214,150,80,0.75)' : 'rgba(150,95,40,0.7)'));
        map.addSource('peat', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('river', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('breaks', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: 'peat-fill',
          type: 'fill',
          source: 'peat',
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['get', 'moisture'],
              0.15,
              '#b8793e',
              0.6,
              '#3f6f5e',
            ],
            'fill-opacity': theme === 'dark' ? 0.16 : 0.2,
          },
        });
        map.addLayer({ id: 'peat-hatch', type: 'fill', source: 'peat', paint: { 'fill-pattern': 'hatch', 'fill-opacity': 0.55 } });
        map.addLayer({
          id: 'peat-line',
          type: 'line',
          source: 'peat',
          paint: { 'line-color': '#b8793e', 'line-width': 1.2, 'line-dasharray': [3, 2], 'line-opacity': 0.8 },
        });
        map.addLayer({
          id: 'river-line',
          type: 'line',
          source: 'river',
          paint: { 'line-color': theme === 'dark' ? '#2b6e9a' : '#7fb6d6', 'line-width': 4, 'line-opacity': 0.9 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        });

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        canvasRef.current = canvas;
        map.addSource('fire', {
          type: 'image',
          url: canvas.toDataURL(),
          coordinates: [
            [101.928, 0.522],
            [102.072, 0.522],
            [102.072, 0.378],
            [101.928, 0.378],
          ],
        });
        map.addLayer({
          id: 'fire',
          type: 'raster',
          source: 'fire',
          paint: { 'raster-opacity': 0.92, 'raster-resampling': 'linear', 'raster-fade-duration': 0 },
        });

        map.addLayer({
          id: 'breaks-casing',
          type: 'line',
          source: 'breaks',
          paint: {
            'line-color': '#05130d',
            'line-width': ['match', ['get', 'state'], 'idle', 6, 10],
            'line-opacity': ['match', ['get', 'state'], 'idle', 0.35, 0.9],
          },
          layout: { 'line-cap': 'round' },
        });
        map.addLayer({
          id: 'breaks-line',
          type: 'line',
          source: 'breaks',
          paint: {
            'line-color': '#3ddc97',
            'line-width': ['match', ['get', 'state'], 'idle', 3, 6],
            'line-opacity': ['match', ['get', 'state'], 'idle', 0.45, 1],
          },
          layout: { 'line-cap': 'round' },
        });
        map.addLayer({
          id: 'breaks-label',
          type: 'symbol',
          source: 'breaks',
          layout: {
            'symbol-placement': 'line-center',
            'text-field': ['get', 'label'],
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Noto Sans Bold'],
            'text-offset': [0, -1.2],
          },
          paint: {
            'text-color': '#3ddc97',
            'text-halo-color': '#05130d',
            'text-halo-width': 1.6,
            'text-opacity': ['match', ['get', 'state'], 'idle', 0, 1],
          },
        });
        setReady(true);
        onMapRef.current?.(map);
      });
    })();
    return () => {
      cancelled = true;
      onMapRef.current?.(null);
      villages.forEach(({ marker }) => marker.remove());
      villages.clear();
      hotspotMarkers.current.forEach((m) => m.remove());
      hotspotMarkers.current = [];
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Skenario: terbang ke area, perbarui gambut, sungai, desa.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !scenario) return;
    (map.getSource('peat') as GeoJSONSource).setData(scenario.peatZones);
    (map.getSource('river') as GeoJSONSource).setData(scenario.rivers);
    if (loadedSlug.current !== scenario.slug) {
      loadedSlug.current = scenario.slug;
      (map.getSource('fire') as ImageSource).setCoordinates(corners(scenario));
      if (autoFly) {
        map.flyTo({
          center: scenario.center,
          zoom: 11.9,
          pitch: initialPitch,
          bearing: -20,
          duration: 2000,
          essential: true,
          padding: padding ?? { left: 0, right: 0, top: 0, bottom: 0 },
        });
      }

      villageMarkers.current.forEach(({ marker }) => marker.remove());
      villageMarkers.current.clear();
      for (const v of scenario.villages) {
        const el = document.createElement('div');
        el.className = 'village-marker';
        el.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;';
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.addEventListener('click', () => onVillageRef.current?.(v.name));
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') onVillageRef.current?.(v.name);
        });
        const marker = new Marker({ element: el, anchor: 'left', offset: [-8, 0] }).setLngLat([v.lon, v.lat]).addTo(map);
        villageMarkers.current.set(v.name, { marker, el });
      }
    }
  }, [ready, scenario, initialPitch, autoFly, padding]);

  // Status desa dan label estimasi tiba.
  useEffect(() => {
    if (!ready) return;
    const risks = new Map<string, VillageRisk>((result?.villageRisks ?? []).map((r) => [r.villageName, r]));
    const dark = theme === 'dark';
    villageMarkers.current.forEach(({ el }, name) => {
      const r = risks.get(name);
      const level = r?.level ?? 'aman';
      const color = r ? LEVEL_COLOR[level] : dark ? '#9aa7b8' : '#4a5a52';
      const label = r ? `${LEVEL_LABEL[level]} · ${etaText(r.etaHours)}` : 'Belum disimulasikan';
      el.style.display = layers.villages ? 'flex' : 'none';
      el.setAttribute('aria-label', `Desa ${name}: ${label}`);
      el.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">
          <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="${color}" stroke="${dark ? '#0b0f14' : '#ffffff'}" stroke-width="1.5"/>
        </svg>
        <span style="background:${dark ? 'rgba(26,34,48,.92)' : 'rgba(255,255,255,.95)'};color:${dark ? '#e8edf4' : '#14201a'};border:1px solid ${
          dark ? '#263041' : '#e3e8e2'
        };border-left:3px solid ${color};border-radius:6px;padding:2px 7px;font:500 11px/1.35 var(--font-sans);white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25)">
          <b style="font-weight:600">${name}</b><br/><span style="font-family:var(--font-mono);font-size:10.5px">${label}</span>
        </span>`;
    });
  }, [ready, result, layers.villages, theme]);

  // Hotspot berdenyut.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    hotspotMarkers.current.forEach((m) => m.remove());
    hotspotMarkers.current = [];
    if (!layers.hotspots) return;
    for (const h of hotspots) {
      const el = document.createElement('div');
      const size = h.frp > 12 ? 11 : h.frp > 5 ? 9 : 7;
      el.title = `Titik panas ${h.satellite}, keyakinan ${h.confidence}, FRP ${nf(h.frp)} MW, ${fmtTimeWIB(h.acquiredAt)}`;
      el.style.cssText = `position:relative;width:${size}px;height:${size}px;`;
      el.innerHTML = `<span style="position:absolute;inset:-6px;border-radius:999px;border:2px solid #ffd24a;animation:pulse-ring 1.6s ease-out infinite"></span>
        <span style="position:absolute;inset:0;border-radius:999px;background:#ffd24a;${
          h.confidence === 'high' ? 'box-shadow:0 0 0 1.5px #fff;' : ''
        }"></span>`;
      hotspotMarkers.current.push(new Marker({ element: el }).setLngLat([h.lon, h.lat]).addTo(map));
    }
  }, [ready, hotspots, layers.hotspots]);

  // Lapisan api pada waktu t.
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!ready || !map || !canvas || !scenario) return;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(scenario.grid.w, scenario.grid.h);
    if (result) {
      paintFire(img, result, timeStep, { showProbability: layers.probability && result.prob !== null });
    }
    ctx.putImageData(img, 0, 0);
    (map.getSource('fire') as ImageSource | undefined)?.updateImage({ image: canvas });
  }, [ready, result, timeStep, layers.probability, scenario]);

  // Lapisan gambut on/off.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const id of ['peat-fill', 'peat-hatch', 'peat-line']) {
      map.setLayoutProperty(id, 'visibility', layers.peat ? 'visible' : 'none');
    }
  }, [ready, layers.peat]);

  // Garis sekat bakar.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const shown = layers.firebreaks ? recommendations : [];
    (map.getSource('breaks') as GeoJSONSource).setData(breakFeatures(shown, activeRank, appliedRank));
  }, [ready, recommendations, activeRank, appliedRank, layers.firebreaks]);

  // Fokus ke sekat aktif.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || activeRank === null) return;
    const r = recommendations.find((x) => x.rank === activeRank);
    if (!r) return;
    const [a, b] = r.line.coordinates;
    map.easeTo({ center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], zoom: 11.8, duration: 900 });
  }, [ready, activeRank, recommendations]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" aria-label="Peta simulasi sebaran api" role="region" />
      {webglError && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-text-secondary">
          Peta 3D tidak dapat dimuat di perangkat ini (WebGL tidak tersedia). Hasil simulasi tetap dapat dibaca di panel.
        </div>
      )}
    </div>
  );
}
