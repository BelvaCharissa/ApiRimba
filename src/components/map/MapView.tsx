'use client';

import { locale } from '@/lib/i18n';
import {
  type GeoJSONSource,
  type ImageSource,
  type MapMouseEvent,
  Map as MlMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type StyleSpecification,
} from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { fmtTimeWIB, LEVEL_COLOR, LEVEL_LABEL, nf, stepToClock } from '@/lib/format';
import { BREAK_COLORS, BREAK_LABELS, decCoord, fmtCoord, ignitionPoint } from '@/lib/geo';
import { paintFire, paintLandSim } from '@/lib/render';
import type { ScenarioData } from '@/lib/scenario';
import type { HotspotItem } from '@/lib/schemas';
import { STEP_MINUTES } from '@/lib/sim/params';
import type { FirebreakRecommendation, VillageRisk } from '@/lib/sim/types';
import type { FireResult, Layers } from '@/stores/simStore';
import { t } from '@/lib/i18n';

export interface MapViewProps {
  scenario: ScenarioData | null;
  result: FireResult | null;
  timeStep: number;
  layers: Layers;
  hotspots: HotspotItem[];
  recommendations: FirebreakRecommendation[];
  activeRank: number | null;
  appliedRank: number | null;
  /** Sel titik awal api yang sedang dipakai. */
  ignitionCells?: number[];
  ignitionCustom?: boolean;
  /** false = jangan gambar sekat sama sekali (peta "tanpa sekat" di mode bandingkan). */
  showBreaks?: boolean;
  /** Mode memilih titik api: kursor silang, klik peta memanggil onPick. */
  pickMode?: boolean;
  onPick?: (lon: number, lat: number) => void;
  theme?: 'dark' | 'light';
  onMap?: (map: MlMap | null) => void;
  showControls?: boolean;
  initialPitch?: number;
  autoFly?: boolean;
  padding?: { left: number; right: number; top: number; bottom: number };
  /** Lokasi yang sedang disiapkan (lon, lat): peta langsung ke sana selagi area dibangun. */
  focus?: [number, number] | null;
}

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
  const size = 9;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
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
  // Bila satu sekat diterapkan, hanya sekat itu yang digambar (menghindari "sekat A masih ada" saat B dipilih).
  const shown = appliedRank !== null ? recs.filter((r) => r.rank === appliedRank) : recs;
  const lines = shown.map((r) => ({
    type: 'Feature' as const,
    properties: {
      rank: r.rank,
      color: BREAK_COLORS[r.rank - 1],
      label: `Sekat ${BREAK_LABELS[r.rank - 1]} · ${nf(r.lengthKm)} km`,
      state: appliedRank === r.rank ? 'applied' : activeRank === r.rank ? 'active' : 'idle',
    },
    geometry: r.line,
  }));
  const ends = shown
    .filter((r) => appliedRank === r.rank || activeRank === r.rank)
    .flatMap((r) =>
      r.line.coordinates.map((c, k) => ({
        type: 'Feature' as const,
        properties: { color: BREAK_COLORS[r.rank - 1], label: `${BREAK_LABELS[r.rank - 1]}${k + 1}` },
        geometry: { type: 'Point' as const, coordinates: c },
      })),
    );
  return {
    lines: { type: 'FeatureCollection' as const, features: lines },
    ends: { type: 'FeatureCollection' as const, features: ends },
  };
}

const HOUSE = (fill: string, stroke: string) =>
  `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style="filter:drop-shadow(0 1px 2px rgba(17,26,21,.35))"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="${fill}" stroke="${stroke}" stroke-width="2"/></svg>`;

/** Status desa PADA waktu simulasi t: warna baru berubah ketika api benar-benar tiba. */
function villageNow(r: VillageRisk | undefined, nowH: number) {
  if (!r) return { state: 'loading' as const, text: t('Calculating...', 'Menghitung...') };
  if (r.etaHours === null) return { state: 'safe' as const, text: t('Not reached in 12 h', 'Tidak terjangkau 12 jam') };
  if (r.etaHours <= nowH) return { state: 'hit' as const, text: t(`Fire arrived ${stepToClock((r.etaHours * 60) / STEP_MINUTES)}`, `Api tiba ${stepToClock((r.etaHours * 60) / STEP_MINUTES)}`) };
  return { state: 'coming' as const, text: t(`Fire in ±${nf(r.etaHours - nowH)} h`, `Api ±${nf(r.etaHours - nowH)} jam lagi`) };
}

function popupHtml(rows: [string, string][], title: string, sub?: string) {
  return `<div style="font:13px/1.45 var(--font-sans);color:#f3f6ef;min-width:210px">
    <p style="font-weight:700;font-size:14px;margin:0">${title}</p>
    ${sub ? `<p style="margin:2px 0 6px;color:#8ea196">${sub}</p>` : '<div style="height:6px"></div>'}
    <table style="width:100%;border-collapse:collapse">${rows
      .map(
        ([k, v]) =>
          `<tr><td style="color:#8ea196;padding:2px 10px 2px 0;vertical-align:top;white-space:nowrap">${k}</td><td style="font-weight:600;font-variant-numeric:tabular-nums">${v}</td></tr>`,
      )
      .join('')}</table></div>`;
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
    ignitionCells,
    ignitionCustom = false,
    showBreaks = true,
    pickMode = false,
    onPick,
    theme = 'dark',
    onMap,
    showControls = true,
    initialPitch = 50,
    autoFly = true,
    padding,
    focus = null,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const villageMarkers = useRef<Map<string, { marker: Marker; el: HTMLDivElement }>>(new Map());
  const hotspotMarkers = useRef<Marker[]>([]);
  const ignitionMarker = useRef<Marker | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [ready, setReady] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const loadedSlug = useRef<string | null>(null);
  const onMapRef = useRef(onMap);
  const onPickRef = useRef(onPick);
  const pickRef = useRef(pickMode);
  // Data terkini untuk popup desa (popup dibuat saat diklik, isinya selalu mengikuti waktu simulasi).
  const live = useRef({ result, timeStep, scenario });
  useEffect(() => {
    onMapRef.current = onMap;
    onPickRef.current = onPick;
    pickRef.current = pickMode;
    live.current = { result, timeStep, scenario };
  });

  const openVillagePopup = (name: string) => {
    const map = mapRef.current;
    const sc = live.current.scenario;
    if (!map || !sc) return;
    const v = sc.villages.find((x) => x.name === name);
    if (!v) return;
    const r = live.current.result?.villageRisks.find((x) => x.villageName === name);
    const nowH = (live.current.timeStep * STEP_MINUTES) / 60;
    const st = villageNow(r, nowH);
    const rows: [string, string][] = [
      [t('Coordinates', 'Koordinat'), fmtCoord(v.lon, v.lat)],
      ['GPS', `<span style="font-family:var(--font-mono);font-size:12px">${decCoord(v.lon, v.lat)}</span>`],
      [t('Population', 'Penduduk'), t(`±${v.population.toLocaleString(locale())} people`, `±${v.population.toLocaleString(locale())} jiwa`)],
      [t('Status at ', 'Status pada ') + stepToClock(live.current.timeStep), st.text],
    ];
    if (r) {
      rows.push([t('Expected arrival', 'Perkiraan tiba'), r.etaHours === null ? t('Not within 12 h', 'Tidak dalam 12 jam') : t(`${nf(r.etaHours)} h from now`, `${nf(r.etaHours)} jam dari sekarang`)]);
      rows.push([t('Chance of burning', 'Peluang terbakar'), `${Math.round(r.burnProbability * 100)}%`]);
      rows.push([
        t('Level', 'Level'),
        `<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:9px;background:${LEVEL_COLOR[r.level]}"></span>${LEVEL_LABEL[r.level]}</span>`,
      ]);
    }
    popupRef.current?.remove();
    popupRef.current = new Popup({ offset: 16, maxWidth: '300px' })
      .setLngLat([v.lon, v.lat])
      .setHTML(popupHtml(rows, t(`${v.name} village`, `Desa ${v.name}`), t('Level comes from the expected fire arrival time.', 'Level dihitung dari perkiraan jam tiba api.')))
      .addTo(map);
  };
  const openVillageRef = useRef(openVillagePopup);
  useEffect(() => {
    openVillageRef.current = openVillagePopup;
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
          zoom: 7,
          pitch: 0,
          bearing: 0,
          maxPitch: 70,
          attributionControl: { compact: true },
        });
      } catch {
        setWebglError(true);
        return;
      }
      mapRef.current = map;
      // Serahkan peta segera (sinkron kamera mode bandingkan tidak perlu menunggu semua tile termuat).
      onMapRef.current?.(map);
      if (process.env.NODE_ENV !== 'production') (window as unknown as { __maps?: MlMap[] }).__maps = [map];
      if (showControls) map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
      map.on('click', (e: MapMouseEvent) => {
        if (pickRef.current) onPickRef.current?.(e.lngLat.lng, e.lngLat.lat);
      });
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
          map.setTerrain({ source: 'dem', exaggeration: 1.3 });
        } catch {
          // tanpa terrain: peta datar
        }
        // Citra satelit Esri, sama dengan foto beranda; diletakkan tepat di atas latar.
        const styleLayers = map.getStyle().layers;
        map.addSource('esri', {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          maxzoom: 17,
          attribution: 'Citra © Esri, Maxar, Earthstar Geographics',
        });
        map.addLayer(
          { id: 'esri', type: 'raster', source: 'esri', paint: { 'raster-brightness-max': 0.85 } },
          styleLayers.find((l) => l.type !== 'background')?.id,
        );
        map.addImage('hatch', hatchImage(theme === 'dark' ? 'rgba(232,170,100,0.95)' : 'rgba(150,95,40,0.85)'));
        const empty = { type: 'FeatureCollection' as const, features: [] };
        map.addSource('peat', { type: 'geojson', data: empty });
        map.addSource('river', { type: 'geojson', data: empty });
        map.addSource('bounds', { type: 'geojson', data: empty });
        map.addSource('breaks', { type: 'geojson', data: empty });
        map.addSource('break-ends', { type: 'geojson', data: empty });

        // Tutupan lahan (agar area yang tidak terbakar tetap terbaca, bukan hanya garis abu-abu).
        const land = document.createElement('canvas');
        land.width = 64;
        land.height = 64;
        map.addSource('land', {
          type: 'image',
          url: land.toDataURL(),
          coordinates: [
            [101.928, 0.522],
            [102.072, 0.522],
            [102.072, 0.378],
            [101.928, 0.378],
          ],
        });
        map.addLayer({
          id: 'land',
          type: 'raster',
          source: 'land',
          paint: { 'raster-opacity': 0.85, 'raster-resampling': 'linear', 'raster-fade-duration': 0 },
        });
        map.addLayer({ id: 'peat-hatch', type: 'fill', source: 'peat', paint: { 'fill-pattern': 'hatch', 'fill-opacity': 0.55 } });
        map.addLayer({
          id: 'peat-line',
          type: 'line',
          source: 'peat',
          paint: { 'line-color': '#a8662a', 'line-width': 1.6, 'line-dasharray': [3, 2], 'line-opacity': 0.9 },
        });
        map.addLayer({
          id: 'river-line',
          type: 'line',
          source: 'river',
          paint: { 'line-color': theme === 'dark' ? '#4a9fd8' : '#4f93c4', 'line-width': 4, 'line-opacity': 0.95 },
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
          paint: { 'raster-opacity': 1, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 },
        });

        // Batas area simulasi: menjelaskan kenapa api "terpotong" di tepi.
        map.addLayer({
          id: 'bounds-line',
          type: 'line',
          source: 'bounds',
          paint: { 'line-color': '#ffffff', 'line-width': 1.4, 'line-dasharray': [4, 3], 'line-opacity': 0.8 },
        });
        map.addLayer({
          id: 'bounds-label',
          type: 'symbol',
          source: 'bounds',
          layout: {
            'symbol-placement': 'line',
            'text-field': t('Simulation area edge 16 x 16 km', 'Batas area simulasi 16 x 16 km'),
            'text-size': 11,
            'text-font': ['Open Sans Regular', 'Noto Sans Regular'],
            'symbol-spacing': 600,
            'text-offset': [0, -0.8],
          },
          paint: { 'text-color': '#ffffff', 'text-halo-color': '#0b1d15', 'text-halo-width': 1.6 },
        });

        map.addLayer({
          id: 'breaks-casing',
          type: 'line',
          source: 'breaks',
          paint: {
            'line-color': '#ffffff',
            'line-width': ['match', ['get', 'state'], 'idle', 7, 12],
            'line-opacity': 0.9,
          },
          layout: { 'line-cap': 'round' },
        });
        map.addLayer({
          id: 'breaks-line',
          type: 'line',
          source: 'breaks',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['match', ['get', 'state'], 'idle', 4, 7],
            'line-opacity': ['match', ['get', 'state'], 'idle', 0.75, 1],
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
            'text-size': 13,
            'text-font': ['Open Sans Bold', 'Noto Sans Bold'],
            'text-offset': [0, -1.3],
            'text-allow-overlap': true,
          },
          paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#ffffff', 'text-halo-width': 2.2 },
        });
        map.addLayer({
          id: 'break-ends',
          type: 'circle',
          source: 'break-ends',
          paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 3 },
        });
        map.addLayer({
          id: 'break-ends-label',
          type: 'symbol',
          source: 'break-ends',
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 11,
            'text-font': ['Open Sans Bold', 'Noto Sans Bold'],
            'text-offset': [0, 1.3],
            'text-allow-overlap': true,
          },
          paint: { 'text-color': '#111a15', 'text-halo-color': '#ffffff', 'text-halo-width': 1.8 },
        });
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      onMapRef.current?.(null);
      villages.forEach(({ marker }) => marker.remove());
      villages.clear();
      hotspotMarkers.current.forEach((m) => m.remove());
      hotspotMarkers.current = [];
      ignitionMarker.current?.remove();
      popupRef.current?.remove();
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Kursor silang saat memilih titik api.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getCanvas().style.cursor = pickMode ? 'crosshair' : '';
  }, [ready, pickMode]);

  // Selagi area titik panas disiapkan, peta sudah menunjuk lokasinya (bukan area bawaan Riau).
  const focusKey = focus ? `${focus[0].toFixed(5)},${focus[1].toFixed(5)}` : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus || scenario) return;
    map.jumpTo({ center: focus, zoom: 9.5, pitch: 0, bearing: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focusKey, scenario]);

  // Skenario: mulai dari tampilan provinsi, lalu terbang ke area; perbarui gambut, sungai, desa.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !scenario) return;
    (map.getSource('peat') as GeoJSONSource).setData(scenario.peatZones);
    (map.getSource('river') as GeoJSONSource).setData(scenario.rivers);
    // Kunci area = slug + pusat. Area langsung selalu ber-slug 'live', jadi pusatnya ikut dibandingkan
    // agar lapisan api, tutupan lahan, dan batas area ikut pindah ke titik panas yang baru.
    const areaKey = `${scenario.slug}:${scenario.center[0].toFixed(5)},${scenario.center[1].toFixed(5)}`;
    if (loadedSlug.current !== areaKey) {
      loadedSlug.current = areaKey;
      const cs = corners(scenario);
      (map.getSource('fire') as ImageSource).setCoordinates(cs);
      (map.getSource('land') as ImageSource).setCoordinates(cs);
      const lc = document.createElement('canvas');
      lc.width = scenario.grid.w;
      lc.height = scenario.grid.h;
      const lctx = lc.getContext('2d')!;
      const limg = lctx.createImageData(scenario.grid.w, scenario.grid.h);
      paintLandSim(limg, scenario.fuelClass);
      lctx.putImageData(limg, 0, 0);
      (map.getSource('land') as ImageSource).updateImage({ url: lc.toDataURL(), coordinates: cs });
      (map.getSource('bounds') as GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [...cs, cs[0]] },
      });
      if (autoFly) {
        map.jumpTo({ center: scenario.center, zoom: 7.2, pitch: 0, bearing: 0 });
        map.flyTo({
          center: scenario.center,
          zoom: 11.9,
          pitch: initialPitch,
          bearing: -15,
          duration: 2600,
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
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          openVillageRef.current(v.name);
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') openVillageRef.current(v.name);
        });
        const marker = new Marker({ element: el, anchor: 'left', offset: [-11, 0] }).setLngLat([v.lon, v.lat]).addTo(map);
        villageMarkers.current.set(v.name, { marker, el });
      }
    }
  }, [ready, scenario, initialPitch, autoFly, padding]);

  // Penanda titik awal api.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !scenario) return;
    ignitionMarker.current?.remove();
    const cells = ignitionCells && ignitionCells.length ? ignitionCells : scenario.ignitions;
    // Penanda diletakkan di sel titik api yang paling dekat ke pusatnya, sehingga selalu jatuh tepat
    // di salah satu titik panas (bukan di tengah-tengah beberapa titik panas yang berjauhan).
    const [cx, cy] = ignitionPoint(scenario.grid, cells);
    const [lon, lat] = cells
      .map((c) => ignitionPoint(scenario.grid, [c]))
      .reduce((best, p) => (Math.hypot(p[0] - cx, p[1] - cy) < Math.hypot(best[0] - cx, best[1] - cy) ? p : best));
    const el = document.createElement('div');
    el.style.cssText = 'position:relative;width:26px;height:26px;cursor:pointer;';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', t('Ignition point', 'Titik awal api'));
    el.innerHTML = `<span style="position:absolute;inset:-4px;border-radius:999px;border:2px solid #f08c00;animation:pulse-ring 1.8s ease-out infinite"></span>
      <span style="position:absolute;inset:0;border-radius:999px;background:#ffffff;border:2px solid #f08c00;display:grid;place-items:center;box-shadow:0 1px 4px rgba(17,26,21,.3)">
        <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2c1 3 4 4.5 4 8.5A4 4 0 0 1 6 10.5c0-1.6.8-2.6 1.6-3.4.2 1.2.9 2 1.7 2.2C9 7 9.2 4.6 10 2z" fill="#f08c00"/></svg>
      </span>
      <span style="position:absolute;left:32px;top:50%;transform:translateY(-50%);white-space:nowrap;background:#ffd43b;color:#1a1300;border-radius:6px;padding:2px 7px;font:700 11px/1.4 var(--font-sans)">${t('Ignition point', 'Titik awal api')}</span>`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      popupRef.current?.remove();
      popupRef.current = new Popup({ offset: 18, maxWidth: '300px' })
        .setLngLat([lon, lat])
        .setHTML(
          popupHtml(
            [
              [t('Coordinates', 'Koordinat'), fmtCoord(lon, lat)],
              ['GPS', `<span style="font-family:var(--font-mono);font-size:12px">${decCoord(lon, lat)}</span>`],
              [t('Source', 'Asal'), ignitionCustom ? t('Picked on the map', 'Dipilih di peta') : scenario.slug === 'live' ? t('NASA satellite hotspot', 'Titik panas satelit NASA') : t('Scenario hotspot', 'Titik panas skenario')],
            ],
            t('Ignition point', 'Titik awal api'),
            t('The simulation spreads from this point.', 'Simulasi menjalar dari titik ini.'),
          ),
        )
        .addTo(map);
    });
    ignitionMarker.current = new Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
  }, [ready, scenario, ignitionCells, ignitionCustom]);

  // Status desa mengikuti waktu simulasi: warna dan teks baru berubah saat api tiba.
  useEffect(() => {
    if (!ready) return;
    const risks = new Map<string, VillageRisk>((result?.villageRisks ?? []).map((r) => [r.villageName, r]));
    const nowH = (timeStep * STEP_MINUTES) / 60;
    villageMarkers.current.forEach(({ el }, name) => {
      const st = villageNow(risks.get(name), nowH);
      const hit = st.state === 'hit';
      el.style.display = layers.villages ? 'flex' : 'none';
      el.setAttribute('aria-label', t(`${name} village: ${st.text}. Click for details.`, `Desa ${name}: ${st.text}. Klik untuk detail.`));
      const bg = hit ? '#c92a2a' : '#ffffff';
      const fg = hit ? '#ffffff' : '#111a15';
      const sub = hit ? '#ffe3e3' : '#3e4c44';
      el.innerHTML = `${HOUSE(hit ? '#ee4b4b' : '#ffffff', hit ? '#ffffff' : '#111a15')}
        <span style="background:${bg};color:${fg};border-radius:8px;padding:4px 8px;font:600 12px/1.3 var(--font-sans);white-space:nowrap;box-shadow:0 2px 8px rgba(17,26,21,.18);font-variant-numeric:tabular-nums">
          ${name}<br/><span style="font-weight:500;color:${sub}">${st.text}</span>
        </span>`;
    });
  }, [ready, result, timeStep, layers.villages]);

  // Titik panas satelit: klik untuk detail.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    hotspotMarkers.current.forEach((m) => m.remove());
    hotspotMarkers.current = [];
    if (!layers.hotspots) return;
    for (const h of hotspots) {
      const el = document.createElement('div');
      el.style.cssText = 'position:relative;width:9px;height:9px;cursor:pointer;';
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', t('Satellite hotspot', 'Titik panas satelit'));
      el.innerHTML = `<span style="position:absolute;inset:0;border-radius:999px;background:#ff6a1a;box-shadow:0 0 0 2px #ffffff,0 1px 3px rgba(17,26,21,.4)"></span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        popupRef.current?.remove();
        popupRef.current = new Popup({ offset: 10, maxWidth: '300px' })
          .setLngLat([h.lon, h.lat])
          .setHTML(
            popupHtml(
              [
                [t('Coordinates', 'Koordinat'), fmtCoord(h.lon, h.lat)],
                [t('Detected', 'Terdeteksi'), fmtTimeWIB(h.acquiredAt)],
                [t('Satellite', 'Satelit'), h.satellite.replace('_', ' ')],
                [t('Confidence', 'Keyakinan'), { high: t('High', 'Tinggi'), nominal: t('Medium', 'Sedang'), low: t('Low', 'Rendah') }[h.confidence]],
                [t('Fire strength', 'Kekuatan api'), `${nf(h.frp)} MW`],
              ],
              t('Satellite hotspot', 'Titik panas satelit'),
              t('NASA FIRMS heat detection.', 'Deteksi panas NASA FIRMS.'),
            ),
          )
          .addTo(map);
      });
      hotspotMarkers.current.push(new Marker({ element: el }).setLngLat([h.lon, h.lat]).addTo(map));
    }
  }, [ready, hotspots, layers.hotspots]);

  // Lapisan api pada waktu t.
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!ready || !map || !canvas || !scenario) return;
    canvas.width = scenario.grid.w;
    canvas.height = scenario.grid.h;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(scenario.grid.w, scenario.grid.h);
    if (result) paintFire(img, result, timeStep, { showProbability: layers.probability && result.prob !== null });
    ctx.putImageData(img, 0, 0);
    (map.getSource('fire') as ImageSource | undefined)?.updateImage({ image: canvas });
  }, [ready, result, timeStep, layers.probability, scenario]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const id of ['peat-hatch', 'peat-line']) map.setLayoutProperty(id, 'visibility', layers.peat ? 'visible' : 'none');
    map.setLayoutProperty('land', 'visibility', layers.landcover ? 'visible' : 'none');
    if (map.getLayer('esri')) map.setLayoutProperty('esri', 'visibility', layers.satellite ? 'visible' : 'none');
  }, [ready, layers.peat, layers.landcover, layers.satellite]);

  // Garis sekat bakar.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const shown = layers.firebreaks && showBreaks ? recommendations : [];
    const f = breakFeatures(shown, activeRank, appliedRank);
    (map.getSource('breaks') as GeoJSONSource).setData(f.lines);
    (map.getSource('break-ends') as GeoJSONSource).setData(f.ends);
  }, [ready, recommendations, activeRank, appliedRank, layers.firebreaks, showBreaks]);

  // Fokus ke sekat aktif / diterapkan: peta langsung menuju sekat (memakai ruang di luar panel).
  const focusRank = appliedRank ?? activeRank;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || focusRank === null || !autoFly) return;
    const r = recommendations.find((x) => x.rank === focusRank);
    if (!r) return;
    const [a, b] = r.line.coordinates;
    map.easeTo({
      center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      zoom: 12.4,
      duration: 900,
      padding: padding ?? { left: 0, right: 0, top: 0, bottom: 0 },
    });
  }, [ready, focusRank, recommendations, autoFly, padding]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" aria-label={t('Fire spread simulation map', 'Peta simulasi sebaran api')} role="region" />
      {webglError && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-text-secondary">
          {t('The 3D map cannot load on this device (WebGL unavailable). Results can still be read in the panels.', 'Peta 3D tidak dapat dimuat di perangkat ini (WebGL tidak tersedia). Hasil simulasi tetap dapat dibaca di panel.')}
        </div>
      )}
    </div>
  );
}
