'use client';

import { type GeoJSONSource, type Map as MlMap, LngLatBounds, Marker, Popup } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KIND_COLOR, KIND_LABEL } from '@/lib/response/assets';
import { type PlanFrame, type UnitState } from '@/lib/response/frame';
import { circleLL, distKm } from '@/lib/response/geom';
import { fmtH } from '@/lib/response/plan';
import type { LonLat, PlanSet, ResponsePlan } from '@/lib/response/types';
import { nf } from '@/lib/format';

const SRC = ['plan-radius', 'plan-routes', 'plan-supply', 'plan-logistics', 'plan-todo', 'plan-done', 'plan-water'] as const;
const LAYERS = [
  'plan-radius-line',
  'plan-radius-label',
  'plan-routes-line',
  'plan-logistics-line',
  'plan-supply-line',
  'plan-todo-line',
  'plan-done-casing',
  'plan-done-line',
  'plan-water-circle',
  'plan-water-label',
] as const;

const empty = { type: 'FeatureCollection' as const, features: [] };
const line = (coordinates: LonLat[], properties: Record<string, string | number> = {}) => ({
  type: 'Feature' as const,
  properties,
  geometry: { type: 'LineString' as const, coordinates },
});

const STATE_TEXT: Record<UnitState, string> = {
  siaga: 'Siaga di pangkalan',
  menuju: 'Menuju lokasi',
  bekerja: 'Membangun garis kendali',
  suplai: 'Memasok air',
  kembali: 'Kembali ke pangkalan',
  selesai: 'Tugas selesai',
  bertugas: 'Bertugas di kejadian lain',
  cadangan: 'Cadangan (tidak dikerahkan)',
};

const SHORT: Record<string, string> = {
  regu_ma: 'MA',
  regu_tni: 'TNI',
  regu_polri: 'POL',
  regu_mpa: 'MPA',
  alat_berat: 'EKS',
  tangki: 'TK',
  perahu: 'PRH',
  heli: 'H',
};

function pinEl(label: string, color: string, sub?: string) {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;align-items:center;gap:6px;pointer-events:none;';
  el.innerHTML = `<span style="display:grid;place-items:center;width:24px;height:24px;border-radius:6px;background:${color};color:#fff;font:800 10px/1 var(--font-sans);box-shadow:0 0 0 2px #fff,0 2px 6px rgba(17,26,21,.35)">${label.slice(0, 2)}</span>
    <span style="background:#fff;border-radius:6px;padding:2px 6px;font:700 11px/1.35 var(--font-sans);color:#111a15;box-shadow:0 1px 4px rgba(17,26,21,.2);white-space:nowrap">${label}${sub ? `<br/><span style="font-weight:500;color:#56645c">${sub}</span>` : ''}</span>`;
  return el;
}

/** Lapisan peta rencana respons: unit bergerak, garis kendali, rute, sumber air, pos komando. */
export default function PlanOverlay({
  map,
  set,
  plan,
  frame,
  padding,
}: {
  map: MlMap | null;
  set: PlanSet;
  plan: ResponsePlan;
  frame: PlanFrame;
  padding: { left: number; right: number; top: number; bottom: number };
}) {
  const [ok, setOk] = useState(false);
  const markers = useRef<Map<string, { m: Marker; el: HTMLDivElement; key: string }>>(new Map());
  const fixed = useRef<Marker[]>([]);
  const popup = useRef<Popup | null>(null);
  const fitted = useRef<string | null>(null);
  const live = useRef({ frame, plan, set });
  useEffect(() => {
    live.current = { frame, plan, set };
  });

  // Tunggu sampai lapisan dasar MapView siap.
  useEffect(() => {
    if (!map) return;
    const check = () => {
      if (map.getSource('break-ends')) setOk(true);
    };
    check();
    map.on('styledata', check);
    map.on('idle', check);
    return () => {
      map.off('styledata', check);
      map.off('idle', check);
    };
  }, [map]);

  // Pasang & lepas sumber/lapisan.
  useEffect(() => {
    if (!map || !ok) return;
    for (const s of SRC) if (!map.getSource(s)) map.addSource(s, { type: 'geojson', data: empty });
    const font = ['Open Sans Bold', 'Noto Sans Bold'];
    const add = (spec: Parameters<MlMap['addLayer']>[0]) => {
      if (!map.getLayer(spec.id)) map.addLayer(spec);
    };
    add({ id: 'plan-radius-line', type: 'line', source: 'plan-radius', paint: { 'line-color': '#111a15', 'line-width': 1.4, 'line-dasharray': [3, 3], 'line-opacity': 0.6 } });
    add({
      id: 'plan-radius-label',
      type: 'symbol',
      source: 'plan-radius',
      layout: { 'symbol-placement': 'line', 'text-field': ['get', 'label'], 'text-size': 11, 'text-font': font, 'symbol-spacing': 400 },
      paint: { 'text-color': '#111a15', 'text-halo-color': '#fff', 'text-halo-width': 1.6 },
    });
    add({
      id: 'plan-routes-line',
      type: 'line',
      source: 'plan-routes',
      paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.55, 'line-dasharray': [2, 2] },
      layout: { 'line-cap': 'round' },
    });
    add({
      id: 'plan-logistics-line',
      type: 'line',
      source: 'plan-logistics',
      paint: { 'line-color': '#b45309', 'line-width': 3, 'line-dasharray': [1, 1.6], 'line-opacity': 0.9 },
      layout: { 'line-cap': 'round' },
    });
    add({
      id: 'plan-supply-line',
      type: 'line',
      source: 'plan-supply',
      paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-dasharray': [3, 2], 'line-opacity': 0.9 },
    });
    add({
      id: 'plan-todo-line',
      type: 'line',
      source: 'plan-todo',
      paint: { 'line-color': '#c92a2a', 'line-width': 2.5, 'line-dasharray': [2, 2], 'line-opacity': 0.85 },
    });
    add({ id: 'plan-done-casing', type: 'line', source: 'plan-done', paint: { 'line-color': '#ffffff', 'line-width': 8 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    add({ id: 'plan-done-line', type: 'line', source: 'plan-done', paint: { 'line-color': '#0f8a57', 'line-width': 5 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    add({
      id: 'plan-water-circle',
      type: 'circle',
      source: 'plan-water',
      paint: {
        'circle-radius': ['case', ['get', 'used'], 7, 4],
        'circle-color': '#1c7ed6',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
    add({
      id: 'plan-water-label',
      type: 'symbol',
      source: 'plan-water',
      filter: ['==', ['get', 'used'], true],
      layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': font, 'text-offset': [0, 1.3], 'text-allow-overlap': false },
      paint: { 'text-color': '#0b4f8a', 'text-halo-color': '#fff', 'text-halo-width': 1.8 },
    });
    // Sekat & lapisan sekat bawaan disembunyikan selama mode rencana.
    for (const id of ['breaks-casing', 'breaks-line', 'breaks-label', 'break-ends', 'break-ends-label']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    }
    const ms = markers.current;
    return () => {
      for (const id of [...LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
      for (const s of SRC) if (map.getSource(s)) map.removeSource(s);
      for (const id of ['breaks-casing', 'breaks-line', 'breaks-label', 'break-ends', 'break-ends-label']) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
      }
      ms.forEach(({ m }) => m.remove());
      ms.clear();
      fixed.current.forEach((m) => m.remove());
      fixed.current = [];
      popup.current?.remove();
    };
  }, [map, ok]);

  // Data statis rencana: cakupan, rute, suplai, logistik, sumber air, pos.
  const usedWater = useMemo(() => new Set(plan.assignments.map((a) => a.waterSourceId).filter(Boolean)), [plan]);
  useEffect(() => {
    if (!map || !ok) return;
    (map.getSource('plan-radius') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: [line(circleLL(set.ignition, set.radiusKm, 96), { label: `Cakupan pencarian unit ${set.radiusKm} km` })],
    });
    const unit = new Map(set.units.map((u) => [u.id, u]));
    (map.getSource('plan-routes') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: plan.assignments
        .filter((a) => a.role !== 'udara')
        .map((a) => line([a.legs[0]?.from ?? a.workPath[0], ...a.legs.map((l) => l.to)], { color: KIND_COLOR[unit.get(a.unitId)!.kind] })),
    });
    (map.getSource('plan-supply') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: plan.assignments
        .filter((a) => a.shuttle)
        .map((a) => line([a.shuttle!.a, a.shuttle!.b], { color: a.role === 'udara' ? '#6d28d9' : '#1c7ed6' })),
    });
    (map.getSource('plan-logistics') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: [line([plan.commandPost.pos, plan.staging])],
    });
    (map.getSource('plan-water') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: set.waterSources
        .filter((w) => distKm(w.pos, set.ignition) <= set.radiusKm)
        .map((w) => ({
          type: 'Feature' as const,
          properties: { name: w.name, used: usedWater.has(w.id) },
          geometry: { type: 'Point' as const, coordinates: w.pos },
        })),
    });

    fixed.current.forEach((m) => m.remove());
    fixed.current = [
      new Marker({ element: pinEl('Pos komando lapangan', '#111a15', 'pos depan, melawan angin'), anchor: 'left', offset: [-12, 0] })
        .setLngLat(plan.staging)
        .addTo(map),
      new Marker({ element: pinEl(plan.commandPost.name, '#b45309', 'logistik & koordinasi'), anchor: 'left', offset: [-12, 0] })
        .setLngLat(plan.commandPost.pos)
        .addTo(map),
    ];

    // Kamera: tampilkan pangkalan unit darat yang dikerahkan + garis kendali.
    const key = `${set.signature}|${plan.id}`;
    if (fitted.current !== key) {
      const first = fitted.current === null || !fitted.current.startsWith(set.signature);
      fitted.current = key;
      if (first) {
        const b = new LngLatBounds();
        // Fokus ke area operasi (garis kendali, pos lapangan, posko, sektor); pangkalan jauh terlihat saat diperkecil.
        plan.ring.forEach((p) => b.extend(p));
        b.extend(plan.staging);
        b.extend(plan.commandPost.pos);
        for (const sec of plan.sectors) sec.path.forEach((p) => b.extend(p));
        map.fitBounds(b, { padding: { ...padding, top: padding.top + 40, left: padding.left + 40 }, pitch: 35, bearing: 0, duration: 1400, maxZoom: 13 });
      }
    }
  }, [map, ok, set, plan, usedWater, padding]);

  // Per frame: garis terbangun & posisi unit.
  useEffect(() => {
    if (!map || !ok) return;
    (map.getSource('plan-done') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: frame.built.map((c) => line(c)),
    });
    (map.getSource('plan-todo') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: frame.todo.map((c) => line(c)),
    });
    const seen = new Set<string>();
    for (const uf of frame.units) {
      const u = uf.unit;
      seen.add(u.id);
      let rec = markers.current.get(u.id);
      if (!rec) {
        const el = document.createElement('div');
        el.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
        el.setAttribute('role', 'button');
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const { frame: fr, plan: pl } = live.current;
          const now = fr.units.find((x) => x.unit.id === u.id);
          const a = pl.assignments.find((x) => x.unitId === u.id);
          const sec = a?.sectorId ? pl.sectors.find((s) => s.id === a.sectorId) : null;
          const ws = a?.waterSourceId ? live.current.set.waterSources.find((w) => w.id === a.waterSourceId) : null;
          const rows: [string, string][] = [
            ['Jenis', KIND_LABEL[u.kind]],
            ['Pangkalan', u.baseName],
            ['Personel', `${u.personnel} orang`],
            ['Status', now ? STATE_TEXT[now.state] : '-'],
          ];
          if (a) {
            rows.push(['Tugas', sec ? sec.name : a.role === 'udara' ? 'Water bombing kepala api' : 'Pasok air']);
            rows.push(['Tiba di lokasi', fmtH(a.onSceneH)]);
            if (ws) rows.push(['Sumber air', `${ws.name} (${nf(a.waterKm ?? 0)} km)`]);
          }
          popup.current?.remove();
          popup.current = new Popup({ offset: 14, maxWidth: '300px' })
            .setLngLat(now?.pos ?? u.base)
            .setHTML(
              `<div style="font:13px/1.45 var(--font-sans);color:#111a15;min-width:220px"><p style="font-weight:700;font-size:14px;margin:0 0 6px">${u.code}</p><table style="width:100%;border-collapse:collapse">${rows
                .map(([k, v]) => `<tr><td style="color:#56645c;padding:2px 10px 2px 0;white-space:nowrap;vertical-align:top">${k}</td><td style="font-weight:600">${v}</td></tr>`)
                .join('')}</table></div>`,
            )
            .addTo(map);
        });
        rec = { m: new Marker({ element: el }).setLngLat(uf.pos).addTo(map), el, key: '' };
        markers.current.set(u.id, rec);
      }
      rec.m.setLngLat(uf.pos);
      const key = uf.state;
      if (rec.key !== key) {
        rec.key = key;
        const dim = uf.state === 'bertugas' || uf.state === 'siaga' || uf.state === 'cadangan' || uf.state === 'selesai';
        const color = uf.state === 'bertugas' ? '#8a948e' : KIND_COLOR[u.kind];
        const ring = uf.state === 'bekerja' || uf.state === 'suplai' ? `,0 0 0 5px ${color}55` : '';
        rec.el.style.opacity = dim ? '0.6' : '1';
        rec.el.style.zIndex = dim ? '0' : '2';
        rec.el.setAttribute('aria-label', `${u.code}: ${STATE_TEXT[uf.state]}`);
        rec.el.innerHTML = `<span style="display:grid;place-items:center;min-width:26px;height:20px;padding:0 4px;border-radius:999px;background:${color};color:#fff;font:800 9.5px/1 var(--font-sans);box-shadow:0 0 0 2px #fff${ring},0 2px 5px rgba(17,26,21,.35)">${SHORT[u.kind]}</span><span style="font:700 10.5px/1 var(--font-sans);color:#111a15;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff">${u.code}</span>`;
      }
    }
    markers.current.forEach((r, id) => {
      if (!seen.has(id)) {
        r.m.remove();
        markers.current.delete(id);
      }
    });
  }, [map, ok, frame]);

  return null;
}
