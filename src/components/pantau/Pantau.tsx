'use client';

import type { Map as MlMap } from 'maplibre-gl';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconChevron, IconInfo, IconLayers, IconPause, IconPlay, IconRefresh } from '@/components/ui/icons';
import { Button, Segmented, Switch } from '@/components/ui/primitives';
import SiteHeader from '@/components/ui/SiteHeader';
import { fmtTimeWIB, nf } from '@/lib/format';
import {
  AGE_BANDS,
  agoText,
  clusterIncidents,
  type Incident,
  incidentPriority,
  ISPU,
  ispuOf,
  type NationalHotspots,
  type NationalWeather,
  type NatHotspot,
} from '@/lib/pantau';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { CityDetail, frpText, HotspotDetail, IncidentDetail, ProvinceDetail } from './DetailCard';
import { flyToBbox, gibsDate, type PantauLayers, type Selection } from './PantauMap';
import WindField from './WindField';

const PantauMap = dynamic(() => import('./PantauMap'), { ssr: false, loading: () => <div className="skeleton-light absolute inset-0" /> });

const HOUR = 3600_000;
type Conf = 'semua' | 'sedang' | 'tinggi';

interface AlertRow {
  id: string;
  level: 'waspada' | 'siaga' | 'awas';
  title: string;
  created_at: string;
  scenarios: { slug: string } | null;
}

const LAYER_ITEMS: { group: string; items: { key: keyof Omit<PantauLayers, 'base'>; label: string; hint: string }[] }[] = [
  {
    group: 'Api',
    items: [
      { key: 'hotspots', label: 'Titik panas', hint: 'Lokasi panas dari satelit; warna = umur deteksi' },
      { key: 'heat', label: 'Kepadatan api', hint: 'Area merah tua = banyak titik berdekatan' },
      { key: 'provinces', label: 'Jumlah per provinsi', hint: 'Makin oranye, makin banyak titik' },
    ],
  },
  {
    group: 'Cuaca & udara',
    items: [
      { key: 'wind', label: 'Angin (animasi)', hint: 'Arah garis = ke mana asap dan api terbawa' },
      { key: 'air', label: 'Kualitas udara PM2,5', hint: 'Kategori ISPU di kota besar' },
      { key: 'gibs', label: `Citra satelit harian`, hint: `Awan dan asap terlihat, NASA ${gibsDate().split('-').reverse().join('/')}` },
    ],
  },
  {
    group: 'Lainnya',
    items: [{ key: 'simAreas', label: 'Area simulator', hint: 'Tiga area gambut yang bisa disimulasikan' }],
  },
];

function fetchAll(): Promise<[NationalHotspots | null, NationalWeather | null]> {
  return Promise.all([
    fetch('/api/pantau/hotspots').then((r) => (r.ok ? (r.json() as Promise<NationalHotspots>) : null)).catch(() => null),
    fetch('/api/pantau/cuaca').then((r) => (r.ok ? (r.json() as Promise<NationalWeather>) : null)).catch(() => null),
  ]);
}

function useWide() {
  const [w, setW] = useState(true);
  useEffect(() => {
    const up = () => setW(window.innerWidth >= 1024);
    up();
    window.addEventListener('resize', up);
    return () => window.removeEventListener('resize', up);
  }, []);
  return w;
}

function Trend({ now, prev, show }: { now: number; prev: number; show: boolean }) {
  if (!show) return <span className="text-xs text-ink-3">periode penuh</span>;
  if (prev === 0 && now === 0) return <span className="text-xs text-ink-3">sama</span>;
  const d = now - prev;
  const pct = prev ? Math.round((d / prev) * 100) : 100;
  const up = d > 0;
  return (
    <span title="Dibanding periode yang sama sebelumnya" className={`text-xs font-semibold ${up ? 'text-danger-ink' : d < 0 ? 'text-ok-ink' : 'text-ink-3'}`}>
      {up ? 'Naik' : d < 0 ? 'Turun' : 'Sama'} {d !== 0 ? `${Math.abs(pct)}%` : ''}
    </span>
  );
}

export default function Pantau() {
  const wide = useWide();
  const [data, setData] = useState<NationalHotspots | null>(null);
  const [weather, setWeather] = useState<NationalWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [windowH, setWindowH] = useState<24 | 48 | 72>(24);
  const [conf, setConf] = useState<Conf>('semua');
  const [hideStatic, setHideStatic] = useState(true);
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [layers, setLayers] = useState<PantauLayers>({
    base: 'peta',
    hotspots: true,
    heat: true,
    wind: false,
    air: false,
    gibs: false,
    provinces: true,
    simAreas: true,
  });
  const [layerOpen, setLayerOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [tab, setTab] = useState<'provinsi' | 'kejadian' | 'peringatan'>('provinsi');
  const [selection, setSelection] = useState<Selection>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [map, setMap] = useState<MlMap | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[] | null>(() => (getBrowserSupabase() ? null : []));
  const [provBbox, setProvBbox] = useState<Map<string, number[]>>(new Map());
  const layerRef = useRef<HTMLDivElement>(null);

  const apply = useCallback((h: NationalHotspots | null, w: NationalWeather | null) => {
    if (h) setData(h);
    if (w) setWeather(w);
    setFetchedAt(Date.now());
    setCursor(null);
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [h, w] = await fetchAll();
    apply(h, w);
  }, [apply]);

  useEffect(() => {
    let cancel = false;
    const run = () =>
      fetchAll().then(([h, w]) => {
        if (!cancel) apply(h, w);
      });
    void run();
    const id = setInterval(run, 30 * 60 * 1000);
    return () => {
      cancel = true;
      clearInterval(id);
    };
  }, [apply]);

  useEffect(() => {
    fetch('/data/provinces.json')
      .then((r) => r.json() as Promise<{ features: { properties: { name: string; bbox: number[] } }[] }>)
      .then((d) => setProvBbox(new Map(d.features.map((f) => [f.properties.name, f.properties.bbox]))))
      .catch(() => undefined);
    const sb = getBrowserSupabase();
    if (!sb) return;
    sb.from('alerts')
      .select('id,level,title,created_at,scenarios(slug)')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data: rows }) => setAlerts((rows as unknown as AlertRow[]) ?? []));
  }, []);

  useEffect(() => {
    if (!layerOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !layerRef.current?.contains(e.target as Node)) setLayerOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [layerOpen]);

  // Putar ulang: kursor bergerak 1 jam tiap 120 ms dari 72 jam lalu sampai sekarang.
  const minCursor = fetchedAt - 72 * HOUR + 6 * HOUR;
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setCursor((c) => {
        const next = (c ?? minCursor) + HOUR;
        if (next >= fetchedAt) {
          setPlaying(false);
          return null;
        }
        return next;
      });
    }, 120);
    return () => clearInterval(id);
  }, [playing, minCursor, fetchedAt]);

  const t = cursor ?? fetchedAt;
  const live = cursor === null;
  const effWindow = live ? windowH : 24;

  const confOk = useCallback(
    (h: { confidence: NatHotspot['confidence']; persistent?: boolean }) =>
      !(hideStatic && h.persistent) && (conf === 'semua' || (conf === 'tinggi' ? h.confidence === 'high' : h.confidence !== 'low')),
    [conf, hideStatic],
  );
  const staticCount = useMemo(() => {
    const lo = (cursor ?? fetchedAt) - (cursor === null ? windowH : 24) * HOUR;
    return (data?.items ?? []).filter((h) => h.persistent && Date.parse(h.acquiredAt) > lo && Date.parse(h.acquiredAt) <= (cursor ?? fetchedAt)).length;
  }, [data, cursor, fetchedAt, windowH]);
  const { visible, incidents, prevCount } = useMemo(() => {
    const all = data?.items ?? [];
    const lo = t - effWindow * HOUR;
    const inWin = all.filter((h) => {
      const at = Date.parse(h.acquiredAt);
      return at <= t && at > lo && confOk(h);
    });
    const prev = all.filter((h) => {
      const at = Date.parse(h.acquiredAt);
      return at <= lo && at > lo - effWindow * HOUR && confOk(h);
    }).length;
    const c = clusterIncidents(inWin);
    return { visible: c.items, incidents: c.incidents, prevCount: prev };
  }, [data, t, effWindow, confOk]);

  const trendValid = live ? windowH < 72 && (data?.items.length ?? 0) > 0 : t - 2 * effWindow * HOUR >= fetchedAt - 72 * HOUR;

  const provCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of visible) m.set(h.province, (m.get(h.province) ?? 0) + 1);
    return m;
  }, [visible]);
  const provRank = useMemo(() => [...provCounts.entries()].sort((a, b) => b[1] - a[1]), [provCounts]);
  const incRank = useMemo(() => [...incidents].sort((a, b) => incidentPriority(b, t) - incidentPriority(a, t)), [incidents, t]);
  const high = visible.filter((h) => h.confidence === 'high').length;
  const worstAir = useMemo(() => [...(weather?.air ?? [])].sort((a, b) => b.pm25 - a.pm25)[0], [weather]);

  const padding = wide ? { top: 80, bottom: 120, left: 440, right: 420 } : { top: 60, bottom: 220, left: 30, right: 30 };

  const select = useCallback(
    (s: Selection) => {
      setSelection(s);
      if (!s || !map) return;
      if (s.kind === 'province') {
        const b = provBbox.get(s.name);
        if (b) flyToBbox(map, b, padding);
      } else if (s.kind === 'incident') {
        const i = incidents.find((x) => x.id === s.id);
        if (i) map.flyTo({ center: [i.lon, i.lat], zoom: Math.max(map.getZoom(), i.spreadKm > 5 ? 9 : 10.5), duration: 1200, padding });
      } else if (s.kind === 'hotspot') {
        const h = visible.find((x) => x.id === s.id);
        if (h && map.getZoom() < 7) map.flyTo({ center: [h.lon, h.lat], zoom: 9, duration: 1200, padding });
      } else if (s.kind === 'city') {
        const c = weather?.air.find((x) => x.city === s.city);
        if (c && map.getZoom() < 6) map.flyTo({ center: [c.lon, c.lat], zoom: 7, duration: 1200, padding });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, provBbox, incidents, visible, weather, wide],
  );

  // Pilihan yang hilang dari jendela waktu dibersihkan.
  const selHot = selection?.kind === 'hotspot' ? visible.find((h) => h.id === selection.id) : undefined;
  const selInc = selection?.kind === 'incident' ? incidents.find((i) => i.id === selection.id) : undefined;
  const selCity = selection?.kind === 'city' ? weather?.air.find((c) => c.city === selection.city) : undefined;

  const detail = selHot ? (
    <HotspotDetail
      h={selHot}
      inc={incidents[selHot.incident]}
      now={t}
      wind={weather?.wind ?? null}
      air={weather?.air ?? []}
      members={visible.filter((x) => x.incident === selHot.incident)}
      onClose={() => setSelection(null)}
      onIncident={(id) => select({ kind: 'incident', id })}
    />
  ) : selInc ? (
    <IncidentDetail
      inc={selInc}
      now={t}
      wind={weather?.wind ?? null}
      air={weather?.air ?? []}
      members={visible.filter((x) => x.incident === selInc.id)}
      onClose={() => setSelection(null)}
    />
  ) : selCity ? (
    <CityDetail c={selCity} hot={visible} onClose={() => setSelection(null)} />
  ) : selection?.kind === 'province' ? (
    <ProvinceDetail
      name={selection.name}
      hot={visible}
      incidents={incidents}
      air={weather?.air ?? []}
      now={t}
      onClose={() => setSelection(null)}
      onIncident={(id) => select({ kind: 'incident', id })}
    />
  ) : null;

  const top = provRank[0];
  const whenText = live ? `dalam ${windowH} jam terakhir` : `dalam 24 jam sampai ${fmtTimeWIB(new Date(t).toISOString())}`;

  /* ---------------- Panel ---------------- */
  const summary = (
    <header>
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        {data?.stale ? (
          <span className="rounded-full bg-[#fff3bf] px-2.5 py-1 text-warn-ink">Data contoh</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-2.5 py-1 text-ok-ink">
            <span className="size-1.5 animate-pulse rounded-full bg-ok" aria-hidden="true" /> Langsung · NASA FIRMS
          </span>
        )}
        {fetchedAt > 0 && <span className="text-ink-3">Diperbarui {fmtTimeWIB(new Date(fetchedAt).toISOString())}</span>}
      </div>
      {loading && !data ? (
        <div className="skeleton-light mt-3 h-16 w-full rounded-lg" />
      ) : (
        <h1 className="mt-2 font-display text-[26px] font-bold leading-[1.15] tracking-tight text-ink">
          <span className="num">{visible.length.toLocaleString('id-ID')}</span> titik panas di Indonesia {whenText}
        </h1>
      )}
      <p className="mt-1.5 text-sm leading-6 text-ink-2">
        {top ? (
          <>
            Terbanyak di <b className="text-ink">{top[0]}</b> ({top[1]} titik). {high.toLocaleString('id-ID')} titik berkeyakinan tinggi.
          </>
        ) : loading ? (
          'Memuat data satelit...'
        ) : (
          'Tidak ada titik panas untuk filter ini.'
        )}
      </p>
      {data?.note && <p className="mt-1 text-xs leading-5 text-ink-3">{data.note}</p>}
    </header>
  );

  const filters = (
    <div className="space-y-2.5">
      <div>
        <p className="mb-1 text-xs font-semibold text-ink-2">Rentang deteksi</p>
        <Segmented
          tone="light"
          label="Rentang deteksi"
          value={windowH}
          onChange={(v) => {
            setWindowH(v);
            setCursor(null);
            setPlaying(false);
          }}
          options={[
            { value: 24 as const, label: '24 jam' },
            { value: 48 as const, label: '48 jam' },
            { value: 72 as const, label: '72 jam' },
          ]}
        />
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-ink-2">Keyakinan satelit</p>
        <Segmented
          tone="light"
          label="Keyakinan satelit"
          value={conf}
          onChange={setConf}
          options={[
            { value: 'semua' as const, label: 'Semua' },
            { value: 'sedang' as const, label: 'Sedang+' },
            { value: 'tinggi' as const, label: 'Tinggi' },
          ]}
        />
      </div>
      <Switch
        tone="light"
        checked={hideStatic}
        onChange={setHideStatic}
        label="Sembunyikan sumber panas tetap"
        hint={`${staticCount} titik di lokasi yang sama ≥ 3 hari, kemungkinan cerobong gas atau smelter, bukan kebakaran lahan`}
      />
    </div>
  );

  const kpis = (
    <dl className="num grid grid-cols-3 gap-px overflow-hidden rounded-[16px] bg-line">
      <div className="bg-card px-3 py-2.5">
        <dt className="text-xs text-ink-3">Titik panas</dt>
        <dd className="text-xl font-bold text-ink">{visible.length.toLocaleString('id-ID')}</dd>
        <Trend now={visible.length} prev={prevCount} show={trendValid} />
      </div>
      <div className="bg-card px-3 py-2.5">
        <dt className="text-xs text-ink-3">Kejadian</dt>
        <dd className="text-xl font-bold text-ink">{incidents.length.toLocaleString('id-ID')}</dd>
        <span className="text-xs text-ink-3">{incidents.filter((i) => i.count >= 10).length} besar (≥10 titik)</span>
      </div>
      <button
        className="bg-card px-3 py-2.5 text-left hover:bg-paper disabled:pointer-events-none"
        disabled={!worstAir}
        onClick={() => {
          if (!worstAir) return;
          setLayers((l) => ({ ...l, air: true }));
          select({ kind: 'city', city: worstAir.city });
        }}
      >
        <dt className="text-xs text-ink-3">Udara terburuk</dt>
        <dd className="truncate text-xl font-bold" style={{ color: worstAir ? ispuOf(worstAir.pm25).ink : undefined }}>
          {worstAir ? ispuOf(worstAir.pm25).label : '-'}
        </dd>
        <span className="block truncate text-xs text-ink-3">{worstAir ? `${worstAir.city}, ${nf(worstAir.pm25, 0)} µg/m³` : 'memuat'}</span>
      </button>
    </dl>
  );

  const maxProv = provRank[0]?.[1] ?? 1;
  const lists = (
    <div>
      <Segmented
        tone="light"
        label="Daftar"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'provinsi' as const, label: 'Provinsi' },
          { value: 'kejadian' as const, label: 'Kejadian' },
          { value: 'peringatan' as const, label: 'Peringatan' },
        ]}
      />
      {tab === 'provinsi' && (
        <ol className="mt-2 space-y-0.5" aria-label="Provinsi dengan titik panas terbanyak">
          {provRank.length === 0 && <li className="py-6 text-center text-sm text-ink-3">Tidak ada titik panas.</li>}
          {provRank.slice(0, 15).map(([name, n], k) => (
            <li key={name}>
              <button
                onClick={() => select({ kind: 'province', name })}
                aria-pressed={selection?.kind === 'province' && selection.name === name}
                className={`grid min-h-11 w-full grid-cols-[22px_1fr_auto] items-center gap-2 rounded-[10px] px-2 text-left text-sm hover:bg-sunken ${
                  selection?.kind === 'province' && selection.name === name ? 'bg-forest-100' : ''
                }`}
              >
                <span className="num text-xs text-ink-3">{k + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{name}</span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                    <span className="block h-full rounded-full bg-ember" style={{ width: `${(n / maxProv) * 100}%` }} />
                  </span>
                </span>
                <span className="num text-sm font-bold text-ink">{n}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {tab === 'kejadian' && (
        <ol className="mt-2 space-y-1" aria-label="Kejadian menurut prioritas">
          {incRank.length === 0 && <li className="py-6 text-center text-sm text-ink-3">Tidak ada kejadian.</li>}
          {incRank.slice(0, 30).map((i: Incident) => {
            const fresh = t - Date.parse(i.firstSeen) < 12 * HOUR;
            const on = selection?.kind === 'incident' && selection.id === i.id;
            return (
              <li key={i.id}>
                <button
                  onClick={() => select({ kind: 'incident', id: i.id })}
                  aria-pressed={on}
                  className={`w-full rounded-[10px] px-2.5 py-2 text-left text-sm hover:bg-sunken ${on ? 'bg-forest-100' : ''}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold text-ink">{i.province}</span>
                    <span className="num shrink-0 text-xs text-ink-3">prioritas {incidentPriority(i, t)}</span>
                  </span>
                  <span className="num block text-ink-2">
                    {i.count} titik · api {frpText(i.maxFrp)} ({nf(i.maxFrp)} MW) · {agoText(t - Date.parse(i.lastSeen))}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {fresh && <span className="rounded-[6px] bg-ember-soft px-1.5 py-0.5 text-[11px] font-bold text-danger-ink">Baru</span>}
                    {i.count >= 10 && <span className="rounded-[6px] bg-sunken px-1.5 py-0.5 text-[11px] font-bold text-ink-2">Besar</span>}
                    {i.maxFrp >= 30 && <span className="rounded-[6px] bg-sunken px-1.5 py-0.5 text-[11px] font-bold text-ink-2">Sangat kuat</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {tab === 'peringatan' && (
        <ul className="mt-2 divide-y divide-line" aria-live="polite">
          {alerts === null && <li className="skeleton-light h-12 rounded-[8px]" />}
          {alerts?.length === 0 && <li className="py-4 text-sm leading-6 text-ink-2">Belum ada. Peringatan desa muncul setelah laporan disimpan dari simulator.</li>}
          {alerts?.map((a) => (
            <li key={a.id} className="py-2.5 text-sm">
              <p className="font-semibold leading-5 text-ink">{a.title}</p>
              <p className="text-xs text-ink-3">
                {fmtTimeWIB(a.created_at)} · {a.level}
                {a.scenarios && (
                  <>
                    {' · '}
                    <Link href={`/peta?scenario=${a.scenarios.slug}`} className="font-semibold text-forest-800 underline-offset-4 hover:underline">
                      Buka simulator
                    </Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const howTo = (
    <div className="rounded-[12px] bg-sunken p-3 text-[13px] leading-5 text-ink-2">
      <button onClick={() => setHelp(!help)} aria-expanded={help} className="flex w-full items-center justify-between gap-2 font-semibold text-ink">
        <span className="inline-flex items-center gap-1.5">
          <IconInfo size={15} /> Cara membaca peta
        </span>
        <IconChevron size={16} className={`transition-transform ${help ? 'rotate-180' : ''}`} />
      </button>
      {help && (
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <b>Titik panas</b> = lokasi yang terdeteksi lebih panas dari sekitarnya oleh satelit, biasanya api. Warna menunjukkan kapan terdeteksi.
          </li>
          <li>
            <b>Kejadian</b> = titik-titik yang berjarak ≤ 2 km digabung menjadi satu kebakaran, supaya lebih mudah diprioritaskan.
          </li>
          <li>
            <b>Kekuatan api (FRP)</b> dalam megawatt: di atas 10 MW tergolong kuat.
          </li>
          <li>Klik titik, kejadian, provinsi, atau kota untuk detail, arah angin, kualitas udara, dan tombol simulasi.</li>
        </ul>
      )}
    </div>
  );

  /* ---------------- Peta: lapisan, legenda, waktu ---------------- */
  const layerMenu = (
    <div ref={layerRef} className="relative">
      <button
        onClick={() => setLayerOpen(!layerOpen)}
        aria-expanded={layerOpen}
        aria-haspopup="true"
        className="flex h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink shadow-float hover:bg-paper"
      >
        <IconLayers size={18} /> Lapisan
      </button>
      {layerOpen && (
        <div className="absolute right-0 top-[52px] z-40 w-[300px] rounded-[16px] border border-line bg-card p-3 shadow-float">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-3">Peta dasar</p>
          <Segmented
            tone="light"
            label="Peta dasar"
            value={layers.base}
            onChange={(v) => setLayers((l) => ({ ...l, base: v }))}
            options={[
              { value: 'peta' as const, label: 'Peta' },
              { value: 'satelit' as const, label: 'Citra satelit' },
            ]}
          />
          {LAYER_ITEMS.map((g) => (
            <div key={g.group} className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{g.group}</p>
              {g.items.map((i) => (
                <Switch key={i.key} checked={layers[i.key]} onChange={(v) => setLayers((l) => ({ ...l, [i.key]: v }))} label={i.label} hint={i.hint} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const legend = (
    <section aria-label="Legenda" className="w-[248px] rounded-[16px] border border-line bg-card text-xs shadow-float">
      <button onClick={() => setLegendOpen(!legendOpen)} aria-expanded={legendOpen} className="flex min-h-11 w-full items-center justify-between px-3 font-bold text-ink">
        Legenda
        <IconChevron size={16} className={`transition-transform ${legendOpen ? '' : 'rotate-180'}`} />
      </button>
      {legendOpen && (
        <div className="space-y-3 px-3 pb-3">
          {layers.hotspots && (
            <div>
              <p className="mb-1 font-semibold text-ink-2">Titik panas, terdeteksi</p>
              <ul className="space-y-1">
                {AGE_BANDS.map((b) => (
                  <li key={b.key} className="flex items-center gap-2">
                    <span className="size-3 rounded-full border-2 border-white shadow" style={{ background: b.color }} />
                    {b.label} lalu
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-ink-3">Titik lebih besar = api lebih kuat. Pudar = keyakinan rendah.</p>
            </div>
          )}
          {layers.air && (
            <div>
              <p className="mb-1 font-semibold text-ink-2">Kualitas udara (ISPU PM2,5)</p>
              <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
                {ISPU.map((c) => (
                  <li key={c.key} className="flex items-center gap-1.5">
                    <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="truncate">{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {layers.wind && <p className="text-ink-2">Garis bergerak = arah angin; makin cepat, makin kencang.</p>}
          {layers.simAreas && (
            <p className="flex items-center gap-2 text-ink-2">
              <span className="h-0 w-6 border-t-2 border-dashed border-forest-950" /> Area yang bisa disimulasikan
            </p>
          )}
        </div>
      )}
    </section>
  );

  const progress = live ? 1 : (t - minCursor) / (fetchedAt - minCursor);
  const timeline = !data ? (
    <div className="skeleton-light h-11 w-full rounded-full" />
  ) : (
    <div className="flex items-center gap-3">
      <button
        onClick={() => {
          if (playing) setPlaying(false);
          else {
            setCursor((c) => (c === null || c >= fetchedAt - HOUR ? minCursor : c));
            setPlaying(true);
          }
        }}
        aria-label={playing ? 'Jeda putar ulang' : 'Putar ulang 72 jam terakhir'}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-forest-950 text-white hover:bg-forest-800"
      >
        {playing ? <IconPause /> : <IconPlay />}
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          className="range w-full"
          min={minCursor}
          max={fetchedAt}
          step={HOUR}
          value={t}
          aria-label="Waktu yang ditampilkan"
          aria-valuetext={live ? 'Sekarang' : fmtTimeWIB(new Date(t).toISOString())}
          onChange={(e) => {
            const v = Number(e.target.value);
            setPlaying(false);
            setCursor(v >= fetchedAt - HOUR / 2 ? null : v);
          }}
          style={{
            ['--track' as string]: `linear-gradient(90deg,#d9481c ${progress * 100}%,#c4ccc3 0)`,
            ['--thumb' as string]: '#d9481c',
          }}
        />
        <div className="num hidden justify-between text-[11px] text-ink-3 sm:flex" aria-hidden="true">
          <span>66 jam lalu</span>
          <span>48 jam</span>
          <span>24 jam</span>
          <span>Sekarang</span>
        </div>
      </div>
      <div className="w-[118px] shrink-0 text-right">
        <p className="text-sm font-bold text-ink">{live ? 'Sekarang' : fmtTimeWIB(new Date(t).toISOString())}</p>
        {!live ? (
          <button onClick={() => (setPlaying(false), setCursor(null))} className="text-xs font-semibold text-wind hover:underline">
            Kembali ke sekarang
          </button>
        ) : (
          <p className="text-xs text-ink-3">putar ulang 72 jam</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper">
      <div className="border-b border-line bg-card">
        <SiteHeader />
      </div>
      <main className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <PantauMap
            items={layers.hotspots || layers.heat ? visible : []}
            cursor={t}
            air={weather?.air ?? []}
            provinceCounts={provCounts}
            layers={layers}
            selection={selection}
            onSelect={(s) => {
              select(s);
              if (!wide && s) setSheetOpen(false);
            }}
            onMap={setMap}
          />
          <WindField map={map} grid={weather?.wind ?? null} enabled={layers.wind} light={layers.base === 'satelit' || layers.gibs} />
        </div>

        {/* Bar atas kanan */}
        <div className="absolute right-[60px] top-[10px] z-40 flex items-center gap-2">
          <Button variant="secondary" size="sm" className="h-11 shadow-float" onClick={() => void load()} loading={loading} aria-label="Perbarui data">
            {!loading && <IconRefresh size={16} />} <span className="hidden sm:inline">Perbarui</span>
          </Button>
          {layerMenu}
        </div>

        {wide ? (
          <>
            <aside
              aria-label="Ringkasan titik panas"
              className="absolute bottom-4 left-4 top-4 z-20 w-[400px] space-y-4 overflow-y-auto rounded-[24px] border border-line bg-card p-4 shadow-float"
            >
              {summary}
              {kpis}
              {filters}
              {lists}
              {howTo}
              <p className="text-[11px] leading-4 text-ink-3">
                Sumber: NASA FIRMS ({data?.satellites.join(', ') || 'VIIRS & MODIS'}), Open-Meteo/CAMS, NASA GIBS, Esri. Batas 34 provinsi (sebelum
                pemekaran Papua 2022), disederhanakan.
              </p>
            </aside>
            {detail && <div className="absolute right-4 top-[76px] z-30 w-[380px]">{detail}</div>}
            {!detail && <div className="absolute bottom-[104px] right-4 z-20">{legend}</div>}
            <div className="absolute bottom-4 left-[432px] right-4 z-20 rounded-[20px] border border-line bg-card px-4 py-3 shadow-float">{timeline}</div>
          </>
        ) : (
          <>
            {detail && <div className="absolute inset-x-3 bottom-3 z-40">{detail}</div>}
            {!detail && (
              <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-[24px] border-t border-line bg-card shadow-float">
                <button
                  onClick={() => setSheetOpen(!sheetOpen)}
                  aria-expanded={sheetOpen}
                  className="flex w-full flex-col items-center px-4 pb-1 pt-2"
                  aria-label={sheetOpen ? 'Tutup panel ringkasan' : 'Buka panel ringkasan'}
                >
                  <span className="h-1.5 w-10 rounded-full bg-line-strong" aria-hidden="true" />
                </button>
                <div className={`space-y-4 overflow-y-auto px-4 pb-4 ${sheetOpen ? 'max-h-[68dvh]' : 'max-h-[210px]'}`}>
                  {summary}
                  {timeline}
                  {sheetOpen && (
                    <>
                      {kpis}
                      {filters}
                      {lists}
                      {legend}
                      {howTo}
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
