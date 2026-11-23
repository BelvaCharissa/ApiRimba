'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { useViewer } from '@/components/auth/useViewer';
import PageGuide from '@/components/guide/PageGuide';
import { ArtAid, ArtOfficer, ArtTrack, ArtTruck } from '@/components/guide/art';
import { IconArrowRight, IconCheck, IconClose } from '@/components/ui/icons';
import { Button, Spinner } from '@/components/ui/primitives';
import ShareQr from '@/components/ui/ShareQr';
import SiteFooter from '@/components/ui/SiteFooter';
import SiteHeader from '@/components/ui/SiteHeader';
import {
  AID,
  type AidTotalsRow,
  type AidType,
  aidInfo,
  type Campaign,
  campaignPercent,
  DROPOFF,
  type Dropoff,
  PLEDGE_STEPS,
  type PledgeStatus,
  pledgeStatusLabel,
  pledgeStepIndex,
  type PledgeTrack,
  type PublicPledge,
} from '@/lib/aid';
import { locale } from '@/lib/i18n';
import AidPicture from './AidPicture';

interface Data {
  source: 'nasa-firms' | 'fallback';
  fetchedAt: string;
  campaigns: Campaign[];
  totals: AidTotalsRow[];
  recent?: PublicPledge[];
  tracking?: boolean;
  storage: 'supabase' | 'none';
}

const fmt = (v: number) => v.toLocaleString(locale(), { maximumFractionDigits: 0 });
const when = (iso: string) => new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const provOf = (key: string) => key.replace(/^prov:/, '');

/** Bilah dua lapis: terang = sudah diterima posko / disalurkan, pudar = baru dijanjikan. */
function Bar({ pct, done = 0 }: { pct: number; done?: number }) {
  return (
    <span className="relative block h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
      <span className="absolute inset-y-0 left-0 rounded-full bg-[#ffd24a]/35" style={{ width: `${Math.max(2, pct)}%` }} />
      <span className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#9be15d,#ffd24a)]" style={{ width: `${Math.min(pct, done)}%` }} />
    </span>
  );
}

/** Tahap penyaluran: Dijanjikan, Dikonfirmasi, Dalam perjalanan, Diterima posko, Disalurkan. */
export function PledgeStepper({ status, compact = false }: { status: PledgeStatus; compact?: boolean }) {
  const t = useT();
  const at = pledgeStepIndex(status);
  if (status === 'cancelled') return <span className="inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-ink-3">{t('Cancelled', 'Dibatalkan')}</span>;
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label={pledgeStatusLabel(status)}>
      {PLEDGE_STEPS.map((s, k) => (
        <li key={s.key} className="min-w-0 text-center">
          <span className={`block h-1.5 rounded-full ${k <= at ? 'bg-[linear-gradient(90deg,#9be15d,#ffd24a)]' : 'bg-white/10'}`} />
          {!compact && (
            <span className={`mt-1.5 block truncate text-[11px] leading-4 ${k === at ? 'font-bold text-ink' : k < at ? 'text-ink-2' : 'text-ink-3'}`}>{s.label()}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

function StatusChip({ status }: { status: PledgeStatus }) {
  const done = status === 'received' || status === 'distributed';
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${done ? 'grad-sun' : status === 'cancelled' ? 'bg-white/10 text-ink-3' : 'bg-white/10 text-ink'}`}>
      {pledgeStatusLabel(status)}
    </span>
  );
}

export default function BantuView() {
  const t = useT();
  const viewer = useViewer();
  const verifier = viewer?.role === 'petugas' || viewer?.role === 'admin' || viewer?.role === 'demo';
  const params = useSearchParams();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  // ?prov=Riau membuka formulir posko itu langsung (dari peta)
  const [openKey, setOpenKey] = useState<string | null>(() => (params.get('prov') ? `prov:${params.get('prov')}` : null));

  const load = useCallback(() => {
    fetch('/api/bantu')
      .then((r) => (r.ok ? (r.json() as Promise<Data>) : Promise.reject(new Error('fail'))))
      .then((d) => {
        setData(d);
        setErr(false);
      })
      .catch(() => setErr(true));
  }, []);
  useEffect(load, [load]);

  const open = data?.campaigns.find((c) => c.key === openKey) ?? null;
  const setOpen = (c: Campaign | null) => setOpenKey(c ? c.key : null);

  const pledged = useMemo(() => {
    const m = new Map<string, Partial<Record<AidType, number>>>();
    const got = new Map<string, Partial<Record<AidType, number>>>();
    const donors = new Map<string, number>();
    for (const r of data?.totals ?? []) {
      const v = m.get(r.campaign_key) ?? {};
      v[r.aid_type] = (v[r.aid_type] ?? 0) + r.quantity;
      m.set(r.campaign_key, v);
      const d = got.get(r.campaign_key) ?? {};
      d[r.aid_type] = (d[r.aid_type] ?? 0) + (r.delivered ?? 0);
      got.set(r.campaign_key, d);
      donors.set(r.campaign_key, (donors.get(r.campaign_key) ?? 0) + r.donors);
    }
    return { m, got, donors };
  }, [data]);

  const overall = data?.campaigns.length
    ? Math.round(data.campaigns.reduce((s, c) => s + campaignPercent(c, pledged.m.get(c.key) ?? {}), 0) / data.campaigns.length)
    : 0;
  const overallDone = data?.campaigns.length
    ? Math.round(data.campaigns.reduce((s, c) => s + campaignPercent(c, pledged.got.get(c.key) ?? {}), 0) / data.campaigns.length)
    : 0;
  const totalDonors = [...pledged.donors.values()].reduce((s, v) => s + v, 0);

  const flow = [
    { art: <ArtAid />, title: t('1. Pick a post and pledge', '1. Pilih posko dan janjikan'), body: t('Choose what you can give. The most urgent posts are at the top. No money changes hands here.', 'Pilih barang yang bisa Anda beri. Posko paling mendesak ada di atas. Tidak ada uang yang berpindah di sini.') },
    { art: <ArtOfficer />, title: t('2. The post confirms', '2. Posko mengonfirmasi'), body: t('An officer calls or messages you to agree on delivery. Your pledge moves to "Confirmed".', 'Petugas menelepon atau mengirim pesan untuk menyepakati pengiriman. Status berubah menjadi "Dikonfirmasi".') },
    { art: <ArtTruck />, title: t('3. Send or hand it over', '3. Kirim atau antar barang'), body: t('The status becomes "On the way", then "Received" when it reaches the post.', 'Status menjadi "Dalam perjalanan", lalu "Diterima posko" saat sampai.') },
    { art: <ArtTrack />, title: t('4. Track until it is distributed', '4. Lacak sampai disalurkan'), body: t('Keep your tracking code (AR-xxxxxx). Enter it below at any time to see each step, up to "Distributed" to crews and residents.', 'Simpan kode lacak Anda (AR-xxxxxx). Masukkan di bawah kapan saja untuk melihat tiap tahap sampai "Disalurkan" ke regu dan warga.') },
  ];

  return (
    <div className="min-h-dvh bg-paper">
      <div className="grad-canopy">
        <SiteHeader />
        <section className="mx-auto max-w-[1200px] px-4 pb-12 pt-8 sm:px-6">
          <p className="text-center text-sm font-semibold text-leaf">{t('Give help', 'Bantu')}</p>
          <h1 className="mx-auto mt-2 max-w-[760px] text-center text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            {t('Send help to the posts closest to the fires.', 'Kirim bantuan ke posko yang paling dekat dengan api.')}
          </h1>
          <dl className="mx-auto mt-8 grid max-w-[860px] grid-cols-2 gap-3 text-center sm:grid-cols-4">
            {[
              [t('Active posts', 'Posko aktif'), data ? fmt(data.campaigns.length) : '-'],
              [t('Needs pledged', 'Kebutuhan dijanjikan'), data ? `${overall}%` : '-'],
              [t('Already delivered', 'Sudah disalurkan'), data ? `${overallDone}%` : '-'],
              [t('Pledges', 'Komitmen'), data ? fmt(totalDonors) : '-'],
            ].map(([k, v]) => (
              <div key={k} className="glass rounded-[16px] p-4">
                <dt className="text-xs text-ink-3">{k}</dt>
                <dd className="num mt-1 text-2xl font-bold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="grad-canopy-soft">
        {/* alur penyaluran */}
        <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6" aria-labelledby="alur">
          <h2 id="alur" className="text-3xl font-bold tracking-tight text-ink">
            {t('From pledge to the people who need it', 'Dari janji sampai ke yang membutuhkan')}
          </h2>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {flow.map((f) => (
              <li key={f.title} className="glass overflow-hidden rounded-[20px]">
                {f.art}
                <div className="p-4">
                  <p className="font-semibold text-ink">{f.title}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-2">{f.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* lacak + penyaluran terbaru */}
        <section className="mx-auto grid max-w-[1200px] gap-3 px-4 pb-14 sm:px-6 lg:grid-cols-[1fr_1.2fr]" aria-label={t('Tracking', 'Pelacakan')}>
          <TrackBox enabled={data?.tracking !== false} initial={params.get('kode') ?? ''} />
          <div className="glass rounded-[20px] p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-lg font-bold text-ink">{t('Latest deliveries', 'Penyaluran terbaru')}</p>
              <span className="text-xs text-ink-3">{t('updated by post officers', 'diperbarui petugas posko')}</span>
            </div>
            {!data ? (
              <div className="skeleton mt-4 h-40 rounded-[14px]" />
            ) : !data.tracking ? (
              <p className="mt-4 text-sm leading-6 text-ink-2">
                {t('Delivery tracking is being switched on. Pledges are still recorded.', 'Pelacakan penyaluran sedang diaktifkan. Janji bantuan tetap tercatat.')}
              </p>
            ) : (data.recent ?? []).length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-ink-2">{t('No pledges yet. Yours could be the first.', 'Belum ada janji bantuan. Jadilah yang pertama.')}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {(data.recent ?? []).slice(0, 8).map((r) => {
                  const a = aidInfo(r.aid_type);
                  return (
                    <li key={r.code} className="grid grid-cols-[44px_1fr] items-center gap-3 py-3">
                      <span className="block overflow-hidden rounded-[10px]">
                        <AidPicture type={r.aid_type} className="h-auto w-full" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-ink">
                            {fmt(r.quantity)} {a.unit()} {a.label().toLowerCase()} → {provOf(r.campaign_key)}
                          </p>
                          <StatusChip status={r.status} />
                        </div>
                        <div className="mt-1.5">
                          <PledgeStepper status={r.status} compact />
                        </div>
                        <p className="num mt-1 text-[11px] text-ink-3">
                          {r.code} · {when(r.status_at)}
                          {r.donor ? ` · ${r.donor}` : ''}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* jenis bantuan */}
        <section className="mx-auto max-w-[1200px] px-4 pb-14 sm:px-6" aria-labelledby="jenis">
          <h2 id="jenis" className="text-3xl font-bold tracking-tight text-ink">
            {t('What is needed', 'Yang dibutuhkan')}
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
            {AID.map((a) => (
              <li key={a.key} className="glass overflow-hidden rounded-[20px]" title={a.why()}>
                <AidPicture type={a.key} className="h-auto w-full" />
                <p className="px-3 py-2.5 text-sm font-semibold text-ink">{a.label()}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* posko */}
        <section className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6" aria-labelledby="posko">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="posko" className="text-3xl font-bold tracking-tight text-ink">
                {t('Posts, most urgent first', 'Posko, paling mendesak dulu')}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-5 rounded-full bg-[linear-gradient(90deg,#9be15d,#ffd24a)]" /> {t('delivered', 'sudah disalurkan')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-5 rounded-full bg-[#ffd24a]/35" /> {t('pledged, on the way', 'dijanjikan, dalam proses')}
                </span>
              </p>
            </div>
            {data?.source === 'fallback' && <span className="rounded-full bg-sun/15 px-3 py-1 text-xs font-semibold text-sun">{t('Sample data', 'Data contoh')}</span>}
          </div>

          {err && <p className="mt-6 text-ink-2">{t('Could not load posts. Try again in a moment.', 'Gagal memuat posko. Coba lagi sebentar lagi.')}</p>}
          {!data && !err && (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-48 rounded-[20px]" />
              ))}
            </div>
          )}
          {data && data.campaigns.length === 0 && (
            <p className="glass mt-6 rounded-[16px] p-5 text-ink-2">
              {t('No province has enough active hotspots for a post right now.', 'Saat ini belum ada provinsi dengan titik panas aktif yang cukup untuk dibuka posko.')}
            </p>
          )}
          <ol className="mt-6 grid gap-3 md:grid-cols-2">
            {data?.campaigns.map((c, i) => {
              const got = pledged.m.get(c.key) ?? {};
              const done = pledged.got.get(c.key) ?? {};
              const pct = campaignPercent(c, got);
              const pctDone = campaignPercent(c, done);
              return (
                <li key={c.key} className="glass flex flex-col rounded-[20px] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="num text-xs font-semibold text-ink-3">
                        #{i + 1} · {t('priority', 'prioritas')} {c.topPriority}/100
                      </p>
                      <p className="mt-0.5 text-xl font-bold text-ink">
                        {t('BPBD post', 'Posko BPBD')} {c.province}
                      </p>
                      <p className="num text-sm text-ink-2">
                        {fmt(c.hotspots)} {t('hotspots', 'titik panas')} · {fmt(c.incidents)} {t('incidents', 'kejadian')}
                      </p>
                    </div>
                    <p className="num shrink-0 text-right">
                      <span className="block text-3xl font-bold text-ink">{pct}%</span>
                      <span className="text-xs text-ink-3">
                        {t('pledged', 'dijanjikan')} · <b className="text-leaf">{pctDone}%</b> {t('delivered', 'disalurkan')}
                      </span>
                    </p>
                  </div>
                  <div className="mt-3">
                    <Bar pct={pct} done={pctDone} />
                  </div>
                  <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-3">
                    {AID.map((a) => {
                      const g = got[a.key] ?? 0;
                      const d = done[a.key] ?? 0;
                      const need = c.needs[a.key];
                      return (
                        <li key={a.key}>
                          <span className="flex justify-between gap-2 text-xs">
                            <span className="truncate text-ink-2">{a.label()}</span>
                            <span className="num shrink-0 text-ink-3">{Math.min(100, Math.round((g / need) * 100))}%</span>
                          </span>
                          <span className="mt-1 block">
                            <Bar pct={Math.min(100, (g / need) * 100)} done={Math.min(100, (d / need) * 100)} />
                          </span>
                          <span className="num text-[11px] text-ink-3">
                            {fmt(g)} / {fmt(need)} {a.unit()}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {verifier ? (
                      <Link href="/petugas" className="grad-sun inline-flex h-11 items-center rounded-full px-5 text-[15px] font-bold">
                        {t('Review aid status', 'Tinjau status bantuan')}
                      </Link>
                    ) : (
                      <Button onClick={() => setOpen(c)}>
                        {t('Pledge help', 'Janjikan bantuan')} <IconArrowRight size={16} />
                      </Button>
                    )}
                    <Link
                      href={`/peta?fokus=${c.lat.toFixed(4)},${c.lon.toFixed(4)}`}
                      className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 text-[15px] font-semibold text-ink hover:bg-white/10"
                    >
                      {t('See on map', 'Lihat di peta')}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="mt-6 text-xs leading-5 text-ink-3">
            {t(
              'Needs are estimates scaled from the number of satellite hotspots, not official requests. Check with the local BPBD (via 112) for urgent needs. Your name and contact are never shown publicly.',
              'Kebutuhan adalah perkiraan dari jumlah titik panas satelit, bukan permintaan resmi. Tanyakan BPBD setempat (lewat 112) untuk kebutuhan mendesak. Nama dan kontak Anda tidak pernah ditampilkan ke publik.',
            )}
          </p>
        </section>
        <SiteFooter />
      </div>

      {open && (
        <PledgeDialog
          campaign={open}
          got={pledged.m.get(open.key) ?? {}}
          disabled={data?.storage !== 'supabase'}
          onClose={() => setOpen(null)}
          onDone={load}
        />
      )}
      <PageGuide id="bantu" title={t('How giving help works', 'Cara memberi bantuan')} steps={flow} />
    </div>
  );
}

/** Lacak satu janji bantuan dengan kode AR-xxxxxx. */
function TrackBox({ enabled, initial = '' }: { enabled: boolean; initial?: string }) {
  const t = useT();
  const [code, setCode] = useState(initial);
  const [state, setState] = useState<'idle' | 'busy' | 'notfound' | 'error'>('idle');
  const [row, setRow] = useState<PledgeTrack | null>(null);
  const [notify, setNotify] = useState(false);
  const lastStatus = useRef<PledgeStatus | null>(null);

  const look = async (e?: FormEvent) => {
    e?.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^AR-[0-9A-F]{6}$/.test(c)) return setState('notfound');
    setState('busy');
    try {
      const res = await fetch(`/api/bantu/lacak?kode=${encodeURIComponent(c)}`);
      if (res.status === 404 || res.status === 400) {
        setRow(null);
        return setState('notfound');
      }
      if (!res.ok) throw new Error();
      setRow((await res.json()) as PledgeTrack);
      setState('idle');
      localStorage.setItem('apirimba-watch-pledge', c);
      setNotify(localStorage.getItem('apirimba-notify-pledge') === c);
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    if (!initial) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pelacakan dijalankan sekali saat dibuka dari QR
    void look();
    // Tracking should run once when an invitation QR opens this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notify || !code) return;
    const id = window.setInterval(async () => {
      try {
        const c = code.trim().toUpperCase();
        const res = await fetch(`/api/bantu/lacak?kode=${encodeURIComponent(c)}`);
        if (!res.ok) return;
        const next = (await res.json()) as PledgeTrack;
        if (lastStatus.current && next.status !== lastStatus.current && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(t('ApiRimba help status updated', 'Status bantuan ApiRimba diperbarui'), {
            body: `${c}: ${pledgeStatusLabel(next.status)}`,
          });
        }
        lastStatus.current = next.status;
        setRow(next);
      } catch {
        // Keep the last successful status when the connection is unavailable.
      }
    }, 60000);
    return () => window.clearInterval(id);
  }, [notify, code, t]);

  return (
    <div className="glass rounded-[20px] p-5">
      <p className="text-lg font-bold text-ink">{t('Track your help', 'Lacak bantuan Anda')}</p>
      <p className="mt-1 text-sm text-ink-2">{t('Enter the code you got after pledging.', 'Masukkan kode yang Anda dapat setelah berjanji.')}</p>
      <form onSubmit={look} className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="AR-1A2B3C"
          aria-label={t('Tracking code', 'Kode lacak')}
          disabled={!enabled}
          className="num h-11 min-w-0 flex-1 rounded-[12px] border border-line-strong bg-black/25 px-3 uppercase tracking-wider text-ink placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-3 focus:border-sun focus:outline-none"
        />
        <Button type="submit" disabled={!enabled || state === 'busy'}>
          {state === 'busy' ? <Spinner /> : t('Track', 'Lacak')}
        </Button>
      </form>
      {row && (
        <button
          type="button"
          onClick={async () => {
            if (!('Notification' in window)) return;
            const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
            if (permission === 'granted') {
              localStorage.setItem('apirimba-notify-pledge', code.trim().toUpperCase());
              lastStatus.current = row.status;
              setNotify(true);
            }
          }}
          className="mt-3 w-full rounded-[12px] border border-line-strong px-3 py-2 text-sm font-semibold text-ink hover:bg-white/10"
        >
          {notify
            ? t('Status notifications enabled', 'Notifikasi status aktif')
            : t('Notify me when status changes', 'Beritahu bila status berubah')}
        </button>
      )}
      {state === 'notfound' && <p className="mt-2 text-sm text-danger-ink">{t('No pledge with that code. Codes look like AR-1A2B3C.', 'Kode tidak ditemukan. Contoh format: AR-1A2B3C.')}</p>}
      {state === 'error' && <p className="mt-2 text-sm text-danger-ink">{t('Tracking is not available right now.', 'Pelacakan sedang tidak tersedia.')}</p>}
      {row && (
        <div className="mt-4 rounded-[14px] bg-black/25 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-ink">
              {fmt(row.quantity)} {aidInfo(row.aid_type).unit()} {aidInfo(row.aid_type).label().toLowerCase()} → {provOf(row.campaign_key)}
            </p>
            <StatusChip status={row.status} />
          </div>
          <div className="mt-3">
            <PledgeStepper status={row.status} />
          </div>
          <ol className="mt-4 space-y-2 border-l border-line pl-4">
            {row.events.map((e) => (
              <li key={`${e.status}-${e.at}`} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-sun" />
                <b className="text-ink">{pledgeStatusLabel(e.status)}</b> <span className="num text-xs text-ink-3">· {when(e.at)}</span>
                {e.note && <span className="block text-ink-2">{e.note}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function PledgeDialog({
  campaign,
  got,
  disabled,
  onClose,
  onDone,
}: {
  campaign: Campaign;
  got: Partial<Record<AidType, number>>;
  disabled: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  // jenis yang paling kurang dipilih lebih dulu
  const neediest = [...AID].sort((a, b) => (got[a.key] ?? 0) / campaign.needs[a.key] - (got[b.key] ?? 0) / campaign.needs[b.key])[0];
  const [type, setType] = useState<AidType>(neediest.key);
  const [qty, setQty] = useState('');
  const [dropoff, setDropoff] = useState<Dropoff>('posko');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const info = AID.find((a) => a.key === type) ?? AID[0];
  const left = Math.max(0, campaign.needs[type] - (got[type] ?? 0));
  const n = Number(qty);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!Number.isInteger(n) || n < 1) return;
    setState('busy');
    try {
      const res = await fetch('/api/bantu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: campaign.key, aidType: type, quantity: n, dropoff, name: name || undefined, contact: contact || undefined }),
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { code: string | null };
      setCode(json.code);
      setState('done');
      onDone();
    } catch {
      setState('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-end bg-black/60 p-2 sm:place-items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={t('Pledge help', 'Janjikan bantuan')} className="glass max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-[24px] p-5 shadow-float">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-ink-3">{t('Pledge to', 'Janji untuk')}</p>
            <p className="text-xl font-bold text-ink">
              {t('BPBD post', 'Posko BPBD')} {campaign.province}
            </p>
          </div>
          <button onClick={onClose} aria-label={t('Close', 'Tutup')} className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-white/10">
            <IconClose size={18} />
          </button>
        </div>

        {state === 'done' ? (
          <div className="py-6 text-center">
            <span className="grad-sun mx-auto grid size-12 place-items-center rounded-full">
              <IconCheck size={22} />
            </span>
            <p className="mt-4 text-lg font-semibold text-ink">{t('Thank you. Your pledge is recorded.', 'Terima kasih. Janji Anda tercatat.')}</p>
            <p className="mt-1 text-sm text-ink-2">
              {fmt(n)} {info.unit()} {info.label().toLowerCase()} → {campaign.province}
            </p>
            {code && (
              <div className="mx-auto mt-5 max-w-[380px] rounded-[16px] bg-black/30 p-4 text-left">
                <p className="text-xs font-semibold text-ink-3">{t('Your tracking code', 'Kode lacak Anda')}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="num text-2xl font-bold tracking-wider text-sun">{code}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(code);
                        setCopied(true);
                      } catch {
                        setCopied(false);
                      }
                    }}
                  >
                    {copied ? t('Copied', 'Tersalin') : t('Copy', 'Salin')}
                  </Button>
                </div>
                <div className="mt-4">
                  <PledgeStepper status="pledged" />
                </div>
                {typeof window !== 'undefined' && (
                  <div className="mt-4 border-t border-line pt-4">
                    <ShareQr
                      url={`${window.location.origin}/bantu?kode=${encodeURIComponent(code)}`}
                      label={t('Tracking QR', 'QR pelacakan')}
                    />
                  </div>
                )}
                <p className="mt-3 text-xs leading-5 text-ink-3">
                  {t(
                    'The post will contact you to arrange delivery. Use this code on the Give help page to see when it is confirmed, received and distributed.',
                    'Posko akan menghubungi Anda untuk mengatur pengiriman. Pakai kode ini di halaman Bantu untuk melihat kapan bantuan dikonfirmasi, diterima, dan disalurkan.',
                  )}
                </p>
              </div>
            )}
            <Button className="mt-6" onClick={onClose}>
              {t('Done', 'Selesai')}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <fieldset>
              <legend className="text-sm font-semibold text-ink">{t('What will you give?', 'Apa yang akan Anda beri?')}</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {AID.map((a) => {
                  const on = a.key === type;
                  const pct = Math.min(100, Math.round(((got[a.key] ?? 0) / campaign.needs[a.key]) * 100));
                  return (
                    <button
                      type="button"
                      key={a.key}
                      onClick={() => setType(a.key)}
                      aria-pressed={on}
                      className={`overflow-hidden rounded-[14px] border text-left transition-colors ${on ? 'border-sun bg-sun/10' : 'border-line hover:bg-white/5'}`}
                    >
                      <AidPicture type={a.key} className="h-auto w-full" />
                      <span className="block px-2 py-1.5">
                        <span className="block truncate text-xs font-semibold text-ink">{a.label()}</span>
                        <span className="num text-[11px] text-ink-3">
                          {pct}% {t('pledged', 'dijanjikan')}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-3">{info.why()}</p>
            </fieldset>

            <label className="block">
              <span className="text-sm font-semibold text-ink">
                {t('Quantity', 'Jumlah')} ({info.unit()})
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                required
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-black/25 px-3 text-ink focus:border-sun focus:outline-none"
              />
              <span className="num mt-1 block text-xs text-ink-3">
                {t('Still needed', 'Masih dibutuhkan')}: {fmt(left)} {info.unit()}
              </span>
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-ink">{t('Delivery', 'Pengiriman')}</legend>
              <div className="mt-2 grid gap-1.5">
                {DROPOFF.map((d) => (
                  <label key={d.key} className="flex cursor-pointer items-center gap-2.5 rounded-[12px] bg-black/20 px-3 py-2.5 text-sm text-ink">
                    <input type="radio" name="dropoff" checked={dropoff === d.key} onChange={() => setDropoff(d.key)} className="accent-[#ffd24a]" />
                    {d.label()}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-ink">{t('Name (optional)', 'Nama (opsional)')}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  autoComplete="name"
                  className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-black/25 px-3 text-ink focus:border-sun focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-ink">{t('Phone or email', 'Telepon atau email')}</span>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={120}
                  className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-black/25 px-3 text-ink focus:border-sun focus:outline-none"
                />
              </label>
            </div>
            <p className="text-xs leading-5 text-ink-3">
              {t('The post uses your contact to confirm and arrange delivery. It is never shown publicly.', 'Kontak dipakai posko untuk konfirmasi dan mengatur pengiriman. Tidak pernah ditampilkan ke publik.')}
            </p>

            {state === 'error' && <p className="text-sm text-danger-ink">{t('Could not save. Please try again.', 'Gagal menyimpan. Coba lagi.')}</p>}
            {disabled && <p className="text-sm text-sun">{t('Saving is unavailable: the database is not connected.', 'Penyimpanan tidak tersedia: database belum tersambung.')}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={disabled || state === 'busy' || !(n >= 1)}>
              {state === 'busy' ? <Spinner /> : null} {t('Record my pledge', 'Catat janji saya')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
