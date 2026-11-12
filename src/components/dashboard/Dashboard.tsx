'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { IconSort } from '@/components/ui/icons';
import { ButtonLink, Segmented } from '@/components/ui/primitives';
import SiteHeader from '@/components/ui/SiteHeader';
import { fmtTimeWIB, nf } from '@/lib/format';
import { SCENARIOS } from '@/lib/scenario';
import type { HotspotsResponse } from '@/lib/schemas';
import { getBrowserSupabase } from '@/lib/supabase/client';
import type { DashHotspot } from './DashboardMap';

const DashboardMap = dynamic(() => import('./DashboardMap'), {
  ssr: false,
  loading: () => <div className="skeleton-light h-full w-full" />,
});

interface AlertRow {
  id: string;
  type: 'village_threat' | 'new_hotspot' | 'wind_shift';
  level: 'waspada' | 'siaga' | 'awas';
  title: string;
  body: string | null;
  created_at: string;
  scenarios: { slug: string; province: string } | null;
}

const LEVEL: Record<AlertRow['level'], { dot: string; label: string }> = {
  waspada: { dot: 'var(--color-warn)', label: 'Waspada' },
  siaga: { dot: 'var(--color-alert)', label: 'Siaga' },
  awas: { dot: 'var(--color-danger)', label: 'Awas' },
};
const CONF: Record<DashHotspot['confidence'], { dot: string; label: string }> = {
  high: { dot: 'var(--color-danger)', label: 'Tinggi' },
  nominal: { dot: 'var(--color-alert)', label: 'Nominal' },
  low: { dot: 'var(--color-warn)', label: 'Rendah' },
};
const SHORT: Record<string, string> = { riau: 'Riau', kalteng: 'Kalimantan Tengah', sumsel: 'Sumatera Selatan' };

export default function Dashboard() {
  const [data, setData] = useState<HotspotsResponse[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[] | null>(() => (getBrowserSupabase() ? null : []));
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState<string>('semua');
  const [conf, setConf] = useState<string>('semua');
  const [days, setDays] = useState(1);
  const [sort, setSort] = useState<'time' | 'frp'>('time');
  const [focus, setFocus] = useState<DashHotspot | null>(null);

  useEffect(() => {
    let cancel = false;
    Promise.all(
      SCENARIOS.map((s) =>
        fetch(`/api/hotspots?scenario=${s.slug}&days=${days}`)
          .then((r) => r.json() as Promise<HotspotsResponse>)
          .catch(() => null),
      ),
    ).then((res) => {
      if (cancel) return;
      setData(res.filter((x): x is HotspotsResponse => x !== null));
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [days]);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    sb.from('alerts')
      .select('id,type,level,title,body,created_at,scenarios(slug,province)')
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data: rows }) => setAlerts((rows as unknown as AlertRow[]) ?? []));
  }, []);

  const all: DashHotspot[] = useMemo(() => data.flatMap((d) => d.items.map((h) => ({ ...h, scenario: d.scenario }))), [data]);
  const filtered = useMemo(() => {
    const out = all.filter((h) => (area === 'semua' || h.scenario === area) && (conf === 'semua' || h.confidence === conf));
    out.sort((a, b) => (sort === 'time' ? Date.parse(b.acquiredAt) - Date.parse(a.acquiredAt) : b.frp - a.frp));
    return out;
  }, [all, area, conf, sort]);

  const stale = data.some((d) => d.stale);
  const latest = data.map((d) => d.fetchedAt).sort().at(-1);
  const highConf = filtered.filter((h) => h.confidence === 'high').length;
  const threats = (alerts ?? []).filter((a) => a.type === 'village_threat' && (a.level === 'siaga' || a.level === 'awas')).length;
  const maxFrp = filtered.reduce((m, h) => Math.max(m, h.frp), 0);
  const newest = [...filtered].sort((a, b) => Date.parse(b.acquiredAt) - Date.parse(a.acquiredAt))[0];
  const counts = new Map<string, number>();
  for (const h of filtered) counts.set(h.scenario, (counts.get(h.scenario) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const busiest = top ? `${SHORT[top[0]]} (${top[1]})` : 'Tidak ada';
  const areaName = area === 'semua' ? 'tiga wilayah gambut' : SHORT[area];

  return (
    <div className="min-h-dvh bg-paper">
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-4 pb-20 pt-8 sm:px-6">
        {/* Judul = hasil */}
        <header className="max-w-[860px]">
          {loading ? (
            <div className="skeleton-light h-12 w-[min(560px,100%)] rounded-lg" />
          ) : (
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-[44px]">
              <span className="num">{filtered.length}</span> titik panas di {areaName}, <span className="num">{highConf}</span> berkeyakinan tinggi
            </h1>
          )}
          <p className="mt-3 text-[15px] leading-7 text-ink-2">
            {latest ? `Diperbarui ${fmtTimeWIB(latest)}. ` : ''}
            {stale
              ? 'Sebagian data adalah contoh cadangan karena data satelit langsung belum tersedia.'
              : 'Sumber: NASA FIRMS VIIRS.'}
          </p>
        </header>

        {/* Filter: pilihan tunggal = segmented, lebar segmen sama */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Segmented
            tone="light"
            label="Wilayah"
            value={area}
            onChange={setArea}
            options={[
              { value: 'semua', label: 'Semua' },
              { value: 'riau', label: 'Riau' },
              { value: 'kalteng', label: 'Kalteng' },
              { value: 'sumsel', label: 'Sumsel' },
            ]}
            className="w-full sm:w-[380px]"
          />
          <Segmented
            tone="light"
            label="Rentang waktu"
            value={days}
            onChange={(v) => {
              if (v === days) return;
              setLoading(true);
              setDays(v);
            }}
            options={[
              { value: 1, label: '24 jam' },
              { value: 2, label: '48 jam' },
              { value: 3, label: '72 jam' },
            ]}
            className="w-full sm:w-[260px]"
          />
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-2">
            Keyakinan
            <select
              value={conf}
              onChange={(e) => setConf(e.target.value)}
              className="h-11 rounded-[12px] border border-line-strong bg-card px-3 text-sm font-semibold text-ink"
            >
              <option value="semua">Semua</option>
              <option value="high">Tinggi</option>
              <option value="nominal">Nominal</option>
              <option value="low">Rendah</option>
            </select>
          </label>
        </div>

        {/* Ringkasan: angka saja, tanpa ikon hiasan */}
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[20px] bg-line lg:grid-cols-4">
          {[
            ['Deteksi terbaru', loading ? null : newest ? fmtTimeWIB(newest.acquiredAt) : 'Tidak ada'],
            ['Wilayah terpadat', loading ? null : busiest],
            ['FRP tertinggi', loading ? null : `${nf(maxFrp)} MW`],
            ['Desa siaga atau awas', alerts === null ? null : String(threats)],
          ].map(([k, v]) => (
            <div key={k} className="bg-card px-5 py-4">
              <dt className="text-sm text-ink-3">{k}</dt>
              <dd className="mt-1 text-2xl font-bold text-ink">
                {v === null ? <span className="skeleton-light inline-block h-8 w-16 rounded" /> : <span className="num">{v}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          {/* Tabel */}
          <section className="flex min-h-0 flex-col overflow-hidden rounded-[20px] bg-card shadow-card lg:h-[600px]" aria-labelledby="tabel-h">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 id="tabel-h" className="text-lg font-semibold text-ink">
                Titik panas
              </h2>
              <button
                onClick={() => setSort(sort === 'time' ? 'frp' : 'time')}
                className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-2 hover:bg-sunken hover:text-ink"
              >
                <IconSort size={16} /> {sort === 'time' ? 'Terbaru' : 'FRP terbesar'}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-ink-3">
                  <tr className="border-y border-line">
                    <th className="px-5 py-2.5 font-semibold">Waktu deteksi</th>
                    <th className="py-2.5 font-semibold">Wilayah</th>
                    <th className="py-2.5 font-semibold">Keyakinan</th>
                    <th className="py-2.5 pr-5 text-right font-semibold">FRP</th>
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    Array.from({ length: 8 }, (_, i) => (
                      <tr key={i} className="border-b border-line">
                        <td colSpan={4} className="px-5 py-3.5">
                          <div className="skeleton-light h-4 w-full rounded" />
                        </td>
                      </tr>
                    ))}
                  {!loading &&
                    filtered.map((h) => {
                      const on = focus?.id === h.id;
                      return (
                        <tr
                          key={h.id}
                          tabIndex={0}
                          onClick={() => setFocus(h)}
                          onKeyDown={(e) => e.key === 'Enter' && setFocus(h)}
                          aria-selected={on}
                          className={`cursor-pointer border-b border-line transition-colors ${on ? 'bg-forest-100' : 'hover:bg-paper'}`}
                        >
                          <td className="num px-5 py-3 text-ink">{fmtTimeWIB(h.acquiredAt)}</td>
                          <td className="py-3 text-ink-2">{SHORT[h.scenario]}</td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1.5 text-ink-2">
                              <span className="size-2 rounded-full" style={{ background: CONF[h.confidence].dot }} />
                              {CONF[h.confidence].label}
                            </span>
                          </td>
                          <td className="num py-3 pr-5 text-right text-ink">{nf(h.frp)} MW</td>
                        </tr>
                      );
                    })}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-ink-3">
                        Tidak ada titik panas untuk filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line p-4">
              {focus ? (
                <ButtonLink href={`/simulator?scenario=${focus.scenario}`} className="w-full">
                  Simulasikan sebaran di {SHORT[focus.scenario]}
                </ButtonLink>
              ) : (
                <p className="py-2 text-center text-sm text-ink-3">Pilih satu titik untuk melihatnya di peta dan menyimulasikan sebarannya.</p>
              )}
            </div>
          </section>

          <div className="grid gap-6 lg:h-[600px] lg:grid-rows-[1fr_auto]">
            <section className="h-[360px] overflow-hidden rounded-[20px] bg-card shadow-card lg:h-auto" aria-label="Peta titik panas">
              <DashboardMap items={filtered} focus={focus} />
            </section>

            {/* Peringatan */}
            <section className="rounded-[20px] bg-card p-5 shadow-card" aria-labelledby="alert-h">
              <h2 id="alert-h" className="text-lg font-semibold text-ink">
                Peringatan desa terbaru
              </h2>
              <ul className="mt-3 max-h-[200px] divide-y divide-line overflow-auto" aria-live="polite">
                {alerts === null && <li className="skeleton-light h-12 rounded-[8px]" />}
                {alerts?.length === 0 && (
                  <li className="py-3 text-sm leading-6 text-ink-2">Belum ada. Peringatan muncul setelah laporan disimpan dari simulator.</li>
                )}
                {alerts?.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold leading-6 text-ink">{a.title}</p>
                      <p className="text-sm text-ink-3">
                        {fmtTimeWIB(a.created_at)}
                        {a.scenarios && (
                          <>
                            {' · '}
                            <Link href={`/simulator?scenario=${a.scenarios.slug}`} className="font-semibold text-forest-800 underline-offset-4 hover:underline">
                              Buka simulator
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-ink-2">
                      <span className="size-2 rounded-full" style={{ background: LEVEL[a.level].dot }} />
                      {LEVEL[a.level].label}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
