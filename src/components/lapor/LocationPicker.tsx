'use client';

import { Map as MlMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

setWorkerUrl('/vendor/maplibre-gl-worker.mjs');

export interface PickerPoint {
  lat: number;
  lon: number;
  kind?: 'report' | 'hotspot';
}

/** Peta citra satelit kecil: klik untuk memilih lokasi laporan. Titik lain (laporan, titik panas) ditampilkan sebagai konteks. */
export default function LocationPicker({
  value,
  onChange,
  points = [],
  height = 320,
}: {
  value: { lat: number; lon: number } | null;
  onChange?: (lat: number, lon: number) => void;
  points?: PickerPoint[];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const others = useRef<Marker[]>([]);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });

  useEffect(() => {
    if (!ref.current) return;
    let map: MlMap;
    try {
      map = new MlMap({
        container: ref.current,
        style: {
          version: 8,
          sources: {
            esri: {
              type: 'raster',
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256,
              maxzoom: 17,
              attribution: 'Citra © Esri, Maxar, Earthstar Geographics',
            },
          },
          layers: [
            { id: 'bg', type: 'background', paint: { 'background-color': '#0b1d15' } },
            { id: 'esri', type: 'raster', source: 'esri' },
          ],
        },
        center: value ? [value.lon, value.lat] : [113, -1.5],
        zoom: value ? 11 : 3.8,
        attributionControl: { compact: true },
        dragRotate: false,
        // hanya wilayah Indonesia yang bisa dilihat dan dipilih
        maxBounds: [
          [92, -13],
          [143.5, 8],
        ],
        minZoom: 3.2,
      });
    } catch {
      return;
    }
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('click', (e) => cb.current?.(e.lngLat.lat, e.lngLat.lng));
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // peta dibuat sekali; posisi diperbarui oleh efek di bawah
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.innerHTML =
        '<svg width="34" height="44" viewBox="0 0 34 44"><path d="M17 43C15 36 2 27 2 16a15 15 0 0 1 30 0c0 11-13 20-15 27z" fill="#e8431c" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg>';
      markerRef.current = new Marker({ element: el, anchor: 'bottom' }).setLngLat([value.lon, value.lat]).addTo(map);
    } else markerRef.current.setLngLat([value.lon, value.lat]);
    if (map.getZoom() < 9) map.flyTo({ center: [value.lon, value.lat], zoom: 12, duration: 900 });
  }, [value]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of others.current) m.remove();
    others.current = points.slice(0, 300).map((p) => {
      const el = document.createElement('span');
      el.style.cssText =
        p.kind === 'hotspot'
          ? 'display:block;width:9px;height:9px;border-radius:999px;background:#ff7a2f;border:1.5px solid #fff'
          : 'display:block;width:12px;height:12px;border-radius:999px;background:#ffd24a;border:2px solid #0b1d15';
      return new Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map);
    });
  }, [points]);

  return <div ref={ref} style={{ height }} className="w-full overflow-hidden rounded-[16px]" role="region" aria-label="Map" />;
}
