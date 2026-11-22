'use client';

import {
  type GeoJSONSource,
  LngLatBounds,
  type MapGeoJSONFeature,
  Map as MlMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { type BantuanResponse, SERVICE_LABEL, WATER_LABEL } from '@/lib/bantuan';
import { AGE_BANDS, type CityAir, ISPU, type NatHotspot } from '@/lib/pantau';
import { SCENARIOS } from '@/lib/scenario';

setWorkerUrl('/vendor/maplibre-gl-worker.mjs');

export interface PantauLayers {
  base: 'peta' | 'satelit';
  hotspots: boolean;
  heat: boolean;
  wind: boolean;
  air: boolean;
  gibs: boolean;
  provinces: boolean;
  simAreas: boolean;
}

export type Selection =
  | { kind: 'hotspot'; id: string }
  | { kind: 'incident'; id: number }
  | { kind: 'city'; city: string }
  | { kind: 'province'; name: string }
  | null;

interface Props {
  items: NatHotspot[];
  cursor: number;
  air: CityAir[];
  provinceCounts: Map<string, number>;
  layers: PantauLayers;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onMap: (m: MlMap | null) => void;
  /** Sumber air dan layanan di sekitar titik terpilih. */
  aid?: BantuanResponse | null;
  /** Laporan warga berfoto. */
  reports?: { id: string; lat: number; lon: number; status: string }[];
}

const empty = { type: 'FeatureCollection' as const, features: [] };

/** Tanggal citra harian NASA GIBS: kemarin (UTC), karena citra hari ini belum lengkap. */
export function gibsDate(): string {
  return new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10);
}

export default function PantauMap({ items, cursor, air, provinceCounts, layers, selection, onSelect, onMap, aid = null, reports = [] }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const selectRef = useRef(onSelect);
  const onMapRef = useRef(onMap);
  useEffect(() => {
    selectRef.current = onSelect;
    onMapRef.current = onMap;
  });

  useEffect(() => {
    if (!ref.current) return;
    let map: MlMap;
    try {
      map = new MlMap({
        container: ref.current,
        style: process.env.NEXT_PUBLIC_MAP_STYLE_DARK || 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [117.5, -2.2],
        zoom: 4.1,
        minZoom: 3.2,
        maxZoom: 15,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: { compact: true },
      });
    } catch {
      return;
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');
    map.on('load', () => {
      const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
      map.addSource('esri', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 17,
        attribution: 'Citra © Esri, Maxar, Earthstar Geographics',
      });
      map.addLayer({ id: 'esri', type: 'raster', source: 'esri', layout: { visibility: 'none' } }, firstSymbol);
      map.addSource('gibs', {
        type: 'raster',
        tiles: [
          `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${gibsDate()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
        ],
        tileSize: 256,
        maxzoom: 9,
        attribution: 'Citra harian NASA GIBS (NOAA-20 VIIRS)',
      });
      map.addLayer({ id: 'gibs', type: 'raster', source: 'gibs', paint: { 'raster-opacity': 0.9 }, layout: { visibility: 'none' } }, firstSymbol);

      map.addSource('prov', { type: 'geojson', data: '/data/provinces.json', promoteId: 'name' });
      map.addLayer(
        {
          id: 'prov-fill',
          type: 'fill',
          source: 'prov',
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['coalesce', ['feature-state', 'count'], 0],
              0,
              'rgba(0,0,0,0)',
              1,
              '#fff1e6',
              20,
              '#ffc9a3',
              100,
              '#ff9a5c',
              300,
              '#e8590c',
            ],
            'fill-opacity': 0.55,
          },
        },
        firstSymbol,
      );
      map.addLayer(
        {
          id: 'prov-line',
          type: 'line',
          source: 'prov',
          paint: {
            'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#ffd24a', 'rgba(255,255,255,0.45)'],
            'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.4, 0.8],
            'line-opacity': 0.75,
          },
        },
        firstSymbol,
      );

      map.addSource('sim', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: SCENARIOS.map((s) => {
            const [w, so, e, n] = s.bbox;
            return {
              type: 'Feature' as const,
              properties: { name: `Area simulator ${s.province}` },
              geometry: {
                type: 'Polygon' as const,
                coordinates: [
                  [
                    [w, n],
                    [e, n],
                    [e, so],
                    [w, so],
                    [w, n],
                  ],
                ],
              },
            };
          }),
        },
      });
      map.addLayer({ id: 'sim-line', type: 'line', source: 'sim', paint: { 'line-color': '#ffd24a', 'line-width': 2, 'line-dasharray': [2, 1.5] } });
      map.addLayer({
        id: 'sim-label',
        type: 'symbol',
        source: 'sim',
        minzoom: 8,
        layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-font': ['Open Sans Bold', 'Noto Sans Bold'], 'text-anchor': 'top', 'text-offset': [0, 0.5] },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#0b1d15', 'text-halo-width': 1.6 },
      });

      map.addSource('hot', { type: 'geojson', data: empty });
      map.addLayer({
        id: 'hot-heat',
        type: 'heatmap',
        source: 'hot',
        maxzoom: 9,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'frp'], 0, 0.3, 50, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 9, 2],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 10, 9, 28],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0.75, 9, 0],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(255,220,120,0)',
            0.2,
            'rgba(255,212,59,0.55)',
            0.5,
            'rgba(253,126,20,0.75)',
            0.8,
            'rgba(224,49,49,0.85)',
            1,
            'rgba(134,14,14,0.9)',
          ],
        },
      });
      map.addLayer({
        id: 'hot-sel',
        type: 'circle',
        source: 'hot',
        filter: ['==', ['get', 'id'], ''],
        paint: { 'circle-radius': 14, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#ffd24a', 'circle-stroke-width': 3 },
      });
      map.addLayer({
        id: 'hot-dot',
        type: 'circle',
        source: 'hot',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, ['interpolate', ['linear'], ['get', 'frp'], 0, 2.5, 50, 5], 10, ['interpolate', ['linear'], ['get', 'frp'], 0, 6, 50, 13]],
          'circle-color': ['match', ['get', 'band'], 'baru', AGE_BANDS[0].color, 'hari', AGE_BANDS[1].color, AGE_BANDS[2].color],
          'circle-opacity': ['case', ['==', ['get', 'conf'], 'low'], 0.55, 0.95],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 9, 1.6],
        },
      });

      map.addSource('air', { type: 'geojson', data: empty });
      map.addLayer({
        id: 'air-circle',
        type: 'circle',
        source: 'air',
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 9, 8, 15],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'air-label',
        type: 'symbol',
        source: 'air',
        layout: {
          visibility: 'none',
          'text-field': ['get', 'pm'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 8, 12],
          'text-font': ['Open Sans Bold', 'Noto Sans Bold'],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': ['get', 'textColor'] },
      });

      // laporan warga: titik kuning (cocok satelit) atau putih bergaris kuning (menunggu)
      map.addSource('rep', { type: 'geojson', data: empty });
      map.addLayer({
        id: 'rep-dot',
        type: 'circle',
        source: 'rep',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 10, 8],
          'circle-color': ['match', ['get', 'status'], 'pending', '#ffffff', '#ffd24a'],
          'circle-stroke-color': ['match', ['get', 'status'], 'pending', '#ffd24a', '#0b1d15'],
          'circle-stroke-width': 2,
        },
      });

      // bantuan: sumber air (biru) dan layanan (putih) di sekitar titik terpilih
      map.addSource('aid', { type: 'geojson', data: empty });
      map.addLayer({
        id: 'aid-dot',
        type: 'circle',
        source: 'aid',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 12, 8],
          'circle-color': ['match', ['get', 'group'], 'air', '#4fb8f0', '#ffffff'],
          'circle-stroke-color': ['match', ['get', 'group'], 'air', '#ffffff', '#0b1d15'],
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'aid-label',
        type: 'symbol',
        source: 'aid',
        minzoom: 8.5,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-font': ['Open Sans Bold', 'Noto Sans Bold'],
          'text-anchor': 'left',
          'text-offset': [0.9, 0],
          'text-optional': true,
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#0b1d15', 'text-halo-width': 1.6 },
      });

      const pick = (f: MapGeoJSONFeature | undefined) => f?.properties;
      map.on('click', (e) => {
        const box: [[number, number], [number, number]] = [
          [e.point.x - 6, e.point.y - 6],
          [e.point.x + 6, e.point.y + 6],
        ];
        const air = pick(map.queryRenderedFeatures(box, { layers: map.getLayoutProperty('air-circle', 'visibility') === 'visible' ? ['air-circle'] : [] })[0]);
        if (air) return selectRef.current({ kind: 'city', city: String(air.city) });
        const hot = pick(map.queryRenderedFeatures(box, { layers: ['hot-dot'] })[0]);
        if (hot) return selectRef.current({ kind: 'hotspot', id: String(hot.id) });
        const prov = pick(map.queryRenderedFeatures(e.point, { layers: ['prov-fill'] })[0]);
        if (prov && map.getLayoutProperty('prov-fill', 'visibility') !== 'none') return selectRef.current({ kind: 'province', name: String(prov.name) });
        selectRef.current(null);
      });
      for (const id of ['hot-dot', 'air-circle']) {
        map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
      }
      // Seluruh Indonesia terlihat di luar panel kiri (desktop) atau lembar bawah (ponsel).
      const wideNow = window.innerWidth >= 1024;
      map.fitBounds(
        [
          [95, -11],
          [141, 6],
        ],
        { padding: wideNow ? { top: 40, bottom: 110, left: 430, right: 40 } : { top: 20, bottom: 230, left: 10, right: 10 }, duration: 0 },
      );
      setReady(true);
      onMapRef.current(map);
    });
    return () => {
      onMapRef.current(null);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Titik panas: warna menurut umur deteksi relatif terhadap waktu yang ditampilkan.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('hot') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: items.map((h) => {
        const ageH = (cursor - Date.parse(h.acquiredAt)) / 3600_000;
        return {
          type: 'Feature' as const,
          properties: {
            id: h.id,
            frp: h.frp,
            conf: h.confidence,
            band: ageH < 6 ? 'baru' : ageH < 24 ? 'hari' : 'lama',
          },
          geometry: { type: 'Point' as const, coordinates: [h.lon, h.lat] },
        };
      }),
    });
  }, [ready, items, cursor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('air') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: air.map((c) => {
        const cat = ISPU.find((x) => c.pm25 <= x.max) ?? ISPU[4];
        return {
          type: 'Feature' as const,
          properties: {
            city: c.city,
            pm: String(Math.round(c.pm25)),
            color: cat.color,
            textColor: cat.key === 'tidak_sehat' ? '#111a15' : '#ffffff',
          },
          geometry: { type: 'Point' as const, coordinates: [c.lon, c.lat] },
        };
      }),
    });
  }, [ready, air]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('aid') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: [
        ...(aid?.water ?? []).map((w) => ({
          type: 'Feature' as const,
          properties: { group: 'air', label: w.name || WATER_LABEL[w.kind] },
          geometry: { type: 'Point' as const, coordinates: [w.lon, w.lat] },
        })),
        ...(aid?.services ?? []).map((s) => ({
          type: 'Feature' as const,
          properties: { group: 'layanan', label: s.name || SERVICE_LABEL[s.kind] },
          geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
        })),
      ],
    });
  }, [ready, aid]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('rep') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: reports.map((r) => ({
        type: 'Feature' as const,
        properties: { id: r.id, status: r.status },
        geometry: { type: 'Point' as const, coordinates: [r.lon, r.lat] },
      })),
    });
  }, [ready, reports]);

  // Pewarnaan provinsi menurut jumlah titik panas (feature-state, tanpa memuat ulang geometri).
  const prevCounts = useRef<Set<string>>(new Set());
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const name of prevCounts.current) if (!provinceCounts.has(name)) map.setFeatureState({ source: 'prov', id: name }, { count: 0 });
    for (const [name, count] of provinceCounts) map.setFeatureState({ source: 'prov', id: name }, { count });
    prevCounts.current = new Set(provinceCounts.keys());
  }, [ready, provinceCounts]);

  const prevSel = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (prevSel.current) map.setFeatureState({ source: 'prov', id: prevSel.current }, { selected: false });
    prevSel.current = selection?.kind === 'province' ? selection.name : null;
    if (prevSel.current) map.setFeatureState({ source: 'prov', id: prevSel.current }, { selected: true });
    map.setFilter('hot-sel', ['==', ['get', 'id'], selection?.kind === 'hotspot' ? selection.id : '']);
  }, [ready, selection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const vis = (id: string, on: boolean) => map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    vis('esri', layers.base === 'satelit');
    vis('gibs', layers.gibs);
    vis('hot-dot', layers.hotspots);
    vis('hot-sel', layers.hotspots);
    vis('hot-heat', layers.heat);
    vis('air-circle', layers.air);
    vis('air-label', layers.air);
    vis('prov-fill', layers.provinces);
    vis('prov-line', layers.provinces || layers.base === 'peta');
    vis('sim-line', layers.simAreas);
    vis('sim-label', layers.simAreas);
    map.setPaintProperty('prov-line', 'line-color', layers.base === 'satelit' || layers.gibs ? '#ffffff' : ['case', ['boolean', ['feature-state', 'selected'], false], '#ffd24a', 'rgba(255,255,255,0.45)']);
  }, [ready, layers]);

  return <div ref={ref} className="h-full w-full" role="region" aria-label="Indonesia hotspot map" />;
}

/** Terbangkan peta ke batas provinsi. */
export function flyToBbox(map: MlMap, bbox: number[], padding: { top: number; bottom: number; left: number; right: number }) {
  const b = new LngLatBounds([bbox[0], bbox[1]], [bbox[2], bbox[3]]);
  map.fitBounds(b, { padding, duration: 1200, maxZoom: 9 });
}
