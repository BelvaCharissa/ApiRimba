'use client';

import { type GeoJSONSource, Map as MlMap, NavigationControl, Popup, setWorkerUrl } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { fmtTimeWIB, nf } from '@/lib/format';
import { SCENARIOS } from '@/lib/scenario';
import type { HotspotItem } from '@/lib/schemas';

setWorkerUrl('/vendor/maplibre-gl-worker.mjs');

export type DashHotspot = HotspotItem & { scenario: string };

export default function DashboardMap({ items, focus }: { items: DashHotspot[]; focus: DashHotspot | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    let map: MlMap;
    try {
      map = new MlMap({
        container: ref.current,
        style: process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT || 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [108.5, -1.6],
        zoom: 4.3,
        attributionControl: { compact: true },
      });
    } catch {
      return;
    }
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      map.addSource('areas', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: SCENARIOS.map((s) => {
            const [w, so, e, n] = s.bbox;
            return {
              type: 'Feature',
              properties: { name: s.province },
              geometry: {
                type: 'Polygon',
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
      map.addLayer({ id: 'areas-fill', type: 'fill', source: 'areas', paint: { 'fill-color': '#2f7a57', 'fill-opacity': 0.08 } });
      map.addLayer({
        id: 'areas-line',
        type: 'line',
        source: 'areas',
        paint: { 'line-color': '#2f7a57', 'line-width': 1.5, 'line-dasharray': [2, 2] },
      });
      map.addSource('hot', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'hot-halo',
        type: 'circle',
        source: 'hot',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 7, 11, 16],
          'circle-color': '#ff6a3d',
          'circle-opacity': 0.18,
        },
      });
      map.addLayer({
        id: 'hot-dot',
        type: 'circle',
        source: 'hot',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3.5, 11, 7],
          'circle-color': ['match', ['get', 'confidence'], 'high', '#e5482a', 'nominal', '#ff9f1c', '#f2c94c'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.2,
        },
      });
      setReady(true);
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('hot') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: items.map((h) => ({
        type: 'Feature',
        properties: { id: h.id, confidence: h.confidence },
        geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
      })),
    });
  }, [ready, items]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    map.flyTo({ center: [focus.lon, focus.lat], zoom: 11, duration: 1400 });
    popupRef.current?.remove();
    popupRef.current = new Popup({ offset: 12, closeButton: true })
      .setLngLat([focus.lon, focus.lat])
      .setHTML(
        `<div style="font:13px/1.5 var(--font-sans);color:#14201a">
          <b>Titik panas ${focus.satellite}</b><br/>
          <span style="font-family:var(--font-mono);font-size:12px">${focus.lat.toFixed(4)}, ${focus.lon.toFixed(4)}</span><br/>
          ${fmtTimeWIB(focus.acquiredAt)}<br/>
          Keyakinan: ${({ high: 'tinggi', nominal: 'nominal', low: 'rendah' } as const)[focus.confidence]} · FRP ${nf(focus.frp)} MW
        </div>`,
      )
      .addTo(map);
  }, [ready, focus]);

  return <div ref={ref} className="h-full w-full" role="region" aria-label="Peta ringkasan titik panas" />;
}
