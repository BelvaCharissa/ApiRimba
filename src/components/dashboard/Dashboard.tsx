'use client';

import { ArrowDownUp, Bell, Flame, MapPin, Radar, ShieldAlert } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import SiteHeader from '@/components/ui/SiteHeader';
import { fmtTimeWIB, nf } from '@/lib/format';
import { SCENARIOS } from '@/lib/scenario';
import type { HotspotsResponse } from '@/lib/schemas';
import { getBrowserSupabase } from '@/lib/supabase/client';
import type { DashHotspot } from './DashboardMap';

const DashboardMap = dynamic(() => import('./DashboardMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-line/50" />,
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

const LEVEL_STYLE: Record<string, { bg: string; fg: string; bar: string; label: string }> = {
  waspada: { bg: '#fff8e1', fg: '#8a6100', bar: '#ffc53d', label: 'Waspada' },
  siaga: { bg: '#fff1e6', fg: '#b4470c', bar: '#ff8a3d', label: 'Siaga' },
  awas: { bg: '#ffeceb', fg: '#b4232a', bar: '#ff4d4f', label: 'Awas' },
};

const CONF_LABEL = { high: 'Tinggi', nominal: 'Nominal', low: 'Rendah' } as const;

export default function Dashboard() {
  const [data, setData] = useState<HotspotsResponse[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState<string>('semua');
  const [conf, setConf] = useState<string>('semua');
  const [days, setDays] = useState(1);
  const [sort, setSort] = useState<'time' | 'frp'>('time');
  const [focus, setFocus] = useState<DashHotspot | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const res = await Promise.all(
        SCENARIOS.map((s) =>
          fetch(`/api/hotspots?scenario=${s.slug}&days=${days}`)
            .then((r) => r.json() as Promise<HotspotsResponse>)
            .catch(() => null),
        ),
      );
      if (!cancel) {
        setData(res.filter((x): x is HotspotsResponse => x !== null));
        setLoading(false);
      }
    })();
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

  const all: DashHotspot[] = useMemo(
    () => data.flatMap((d) => d.items.map((h) => ({ ...h, scenario: d.scenario }))),
    [data],
  );
  const filtered = useMemo(() => {
    const out = all.filter((h) => (scenario === 'semua' || h.scenario === scenario) && (conf === 'semua' || h.confidence === conf));
    out.sort((a, b) => (sort === 'time' ? Date.parse(b.acquiredAt) - Date.parse(a.acquiredAt) : b.frp - a.frp));
    return out;
  }, [all, scenario, conf, sort]);

  const stale = data.some((d) => d.stale);
  const latest = data.map((d) => d.fetchedAt).sort().at(-1);
  const highConf = all.filter((h) => h.confidence === 'high').length;
  const threats = alerts.filter((a) => a.type === 'village_threat' && (a.level === 'siaga' || a.level === 'awas')).length;
  const maxFrp = all.reduce((m, h) => Math.max(m, h.frp), 0);
  const provinceOf = (slug: string) => SCENARIOS.find((s) => s.slug === slug)?.province ?? slug;

  const select = 'h-10 rounded-full border border-line bg-white px-4 text-sm font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-wind';

  return (
    <div className="min-h-dvh bg-paper">
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cta-ink">Pemantauan</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Titik panas dan peringatan</h1>
            <p className="mt-1 text-sm text-ink-2">
              {latest ? `Diperbarui ${fmtTimeWIB(latest)}` : 'Memuat data...'}
              {stale && (
                <span className="ml-2 rounded-full bg-[#fff8e1] px-2 py-0.5 text-xs font-medium text-[#8a6100]">Sebagian data cadangan</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
            <select aria-label="Filter skenario" className={select} value={scenario} onChange={(e) => setScenario(e.target.value)}>
              <option value="semua">Semua wilayah</option>
              {SCENARIOS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.province}
                </option>
              ))}
            </select>
            <select aria-label="Filter keyakinan" className={select} value={conf} onChange={(e) => setConf(e.target.value)}>
              <option value="semua">Semua keyakinan</option>
              <option value="high">Keyakinan tinggi</option>
              <option value="nominal">Keyakinan nominal</option>
              <option value="low">Keyakinan rendah</option>
            </select>
            <select aria-label="Rentang waktu" className={select} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={1}>24 jam</option>
              <option value={2}>48 jam</option>
              <option value={3}>72 jam</option>
            </select>
          </div>
        </div>

        {/* KPI */}
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ringkasan">
          {[
            { icon: Radar, label: 'Titik panas', value: loading ? '–' : String(all.length), sub: 'tiga wilayah pantauan' },
            { icon: Flame, label: 'Keyakinan tinggi', value: loading ? '–' : String(highConf), sub: 'deteksi VIIRS' },
            { icon: ShieldAlert, label: 'Desa siaga/awas', value: String(threats), sub: 'dari simulasi tersimpan' },
            { icon: MapPin, label: 'FRP tertinggi', value: loading ? '–' : `${nf(maxFrp)} MW`, sub: 'daya radiasi api' },
          ].map((k) => (
            <div key={k.label} className="rounded-3xl border border-line bg-white p-5 shadow-soft">
              <div className="flex items-center gap-2 text-sm text-ink-2">
                <k.icon size={16} className="text-cta-ink" /> {k.label}
              </div>
              <p className="mt-2 font-mono text-3xl font-semibold text-ink">{k.value}</p>
              <p className="text-xs text-ink-3">{k.sub}</p>
            </div>
          ))}
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr_0.85fr]">
          {/* Tabel */}
          <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-soft lg:h-[560px]" aria-label="Tabel titik panas">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-semibold text-ink">Daftar titik panas</h2>
              <button
                onClick={() => setSort(sort === 'time' ? 'frp' : 'time')}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-ink-2 hover:bg-paper"
              >
                <ArrowDownUp size={14} /> Urut: {sort === 'time' ? 'waktu' : 'FRP'}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-xs text-ink-3">
                  <tr>
                    <th className="px-5 py-2 font-medium">Waktu deteksi</th>
                    <th className="py-2 font-medium">Wilayah</th>
                    <th className="py-2 font-medium">Keyakinan</th>
                    <th className="py-2 pr-5 text-right font-medium">FRP</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h) => (
                    <tr
                      key={h.id}
                      tabIndex={0}
                      onClick={() => setFocus(h)}
                      onKeyDown={(e) => e.key === 'Enter' && setFocus(h)}
                      aria-selected={focus?.id === h.id}
                      className={`cursor-pointer border-t border-line/70 transition hover:bg-paper ${focus?.id === h.id ? 'bg-forest-100' : ''}`}
                    >
                      <td className="px-5 py-2.5 font-mono text-xs">{fmtTimeWIB(h.acquiredAt)}</td>
                      <td className="py-2.5">{provinceOf(h.scenario)}</td>
                      <td className="py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            h.confidence === 'high' ? 'bg-[#ffeceb] text-[#b4232a]' : h.confidence === 'nominal' ? 'bg-[#fff1e6] text-[#b4470c]' : 'bg-[#fff8e1] text-[#8a6100]'
                          }`}
                        >
                          {CONF_LABEL[h.confidence]}
                        </span>
                      </td>
                      <td className="py-2.5 pr-5 text-right font-mono text-xs">{nf(h.frp)} MW</td>
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-ink-3">
                        Tidak ada titik panas untuk filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line px-5 py-3">
              {focus ? (
                <Link
                  href={`/simulator?scenario=${focus.scenario}`}
                  className="flex h-10 items-center justify-center rounded-full bg-cta text-sm font-semibold text-white hover:brightness-105"
                >
                  Simulasikan dari area {provinceOf(focus.scenario)}
                </Link>
              ) : (
                <p className="text-center text-xs text-ink-3">Pilih baris untuk melihat titik di peta dan menyimulasikan areanya.</p>
              )}
            </div>
          </section>

          {/* Peta */}
          <section className="h-[380px] overflow-hidden rounded-3xl border border-line bg-white shadow-soft lg:h-[560px]">
            <DashboardMap items={filtered} focus={focus} />
          </section>

          {/* Peringatan */}
          <section className="flex flex-col rounded-3xl border border-line bg-white shadow-soft lg:h-[560px]" aria-label="Feed peringatan">
            <div className="flex items-center gap-2 border-b border-line px-5 py-4">
              <Bell size={16} className="text-cta-ink" />
              <h2 className="font-semibold text-ink">Peringatan</h2>
            </div>
            <ul className="min-h-0 flex-1 space-y-2 overflow-auto p-4" aria-live="polite">
              {alerts.length === 0 && (
                <li className="rounded-2xl bg-paper p-4 text-sm text-ink-2">
                  Belum ada peringatan. Peringatan desa muncul setelah simulasi disimpan dari simulator.
                </li>
              )}
              {alerts.map((a) => {
                const st = LEVEL_STYLE[a.level];
                return (
                  <li key={a.id} className="rounded-2xl border-l-4 bg-paper p-3" style={{ borderColor: st.bar }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ background: st.bg, color: st.fg }}>
                        {st.label}
                      </span>
                      <span className="text-[11px] text-ink-3">{fmtTimeWIB(a.created_at)}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-ink">{a.title}</p>
                    {a.body && <p className="text-xs text-ink-2">{a.body}</p>}
                    {a.scenarios && (
                      <Link href={`/simulator?scenario=${a.scenarios.slug}`} className="mt-1 inline-block text-xs font-semibold text-forest-700 hover:underline">
                        Lihat di simulator ({a.scenarios.province})
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
        <p className="mt-4 text-xs text-ink-3">
          Sumber: NASA FIRMS (VIIRS SNPP dan NOAA-20). Bila data langsung tidak tersedia atau kunci belum diatur, ditampilkan data
          cadangan contoh. Peringatan desa berasal dari prediksi simulasi, bukan pengganti informasi resmi.
        </p>
      </main>
    </div>
  );
}
