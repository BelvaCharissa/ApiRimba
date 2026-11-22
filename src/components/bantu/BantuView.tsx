'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { IconArrowRight, IconCheck, IconClose } from '@/components/ui/icons';
import { Button, Spinner } from '@/components/ui/primitives';
import SiteFooter from '@/components/ui/SiteFooter';
import SiteHeader from '@/components/ui/SiteHeader';
import { AID, type AidTotalsRow, type AidType, type Campaign, campaignPercent, DROPOFF, type Dropoff } from '@/lib/aid';
import { locale } from '@/lib/i18n';
import AidPicture from './AidPicture';

interface Data {
  source: 'nasa-firms' | 'fallback';
  fetchedAt: string;
  campaigns: Campaign[];
  totals: AidTotalsRow[];
  storage: 'supabase' | 'none';
}

const fmt = (v: number) => v.toLocaleString(locale(), { maximumFractionDigits: 0 });

function Bar({ pct }: { pct: number }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
      <span className="block h-full rounded-full bg-[linear-gradient(90deg,#9be15d,#ffd24a)]" style={{ width: `${Math.max(2, pct)}%` }} />
    </span>
  );
}

export default function BantuView() {
  const t = useT();
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
    const donors = new Map<string, number>();
    for (const r of data?.totals ?? []) {
      const v = m.get(r.campaign_key) ?? {};
      v[r.aid_type] = (v[r.aid_type] ?? 0) + r.quantity;
      m.set(r.campaign_key, v);
      donors.set(r.campaign_key, (donors.get(r.campaign_key) ?? 0) + r.donors);
    }
    return { m, donors };
  }, [data]);

  const overall = data?.campaigns.length
    ? Math.round(data.campaigns.reduce((s, c) => s + campaignPercent(c, pledged.m.get(c.key) ?? {}), 0) / data.campaigns.length)
    : 0;
  const totalDonors = [...pledged.donors.values()].reduce((s, v) => s + v, 0);

  return (
    <div className="min-h-dvh bg-paper">
      <div className="grad-canopy">
        <SiteHeader />
        <section className="mx-auto max-w-[1200px] px-4 pb-14 pt-10 sm:px-6">
          <p className="text-sm font-semibold text-leaf">{t('Give help', 'Bantu')}</p>
          <h1 className="mt-2 max-w-[760px] text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            {t('Send help to the posts closest to the fires.', 'Kirim bantuan ke posko yang paling dekat dengan api.')}
          </h1>
          <p className="mt-4 max-w-[620px] text-lg leading-8 text-ink-2">
            {t(
              'Each province with active satellite hotspots gets a post. Pick what you can give; everyone can see how much of each need is already covered, so help does not pile up in one place.',
              'Tiap provinsi dengan titik panas satelit aktif punya satu posko. Pilih apa yang bisa Anda beri; semua orang bisa melihat berapa kebutuhan yang sudah tertutup, jadi bantuan tidak menumpuk di satu tempat.',
            )}
          </p>
          <dl className="mt-8 grid max-w-[720px] grid-cols-3 gap-3">
            {[
              [t('Active posts', 'Posko aktif'), data ? fmt(data.campaigns.length) : '-'],
              [t('Needs covered', 'Kebutuhan tertutup'), data ? `${overall}%` : '-'],
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
        {/* jenis bantuan */}
        <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6" aria-labelledby="jenis">
          <h2 id="jenis" className="text-3xl font-bold tracking-tight text-ink">
            {t('What is needed', 'Yang dibutuhkan')}
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AID.map((a) => (
              <li key={a.key} className="glass overflow-hidden rounded-[20px]">
                <AidPicture type={a.key} className="h-auto w-full" />
                <div className="p-4">
                  <p className="text-lg font-semibold text-ink">{a.label()}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-2">{a.why()}</p>
                </div>
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
              <p className="mt-1 text-sm text-ink-3">
                {t('Ordered by the highest incident priority in the province (last 72 hours).', 'Diurutkan dari prioritas kejadian tertinggi di provinsi (72 jam terakhir).')}
              </p>
            </div>
            {data?.source === 'fallback' && (
              <span className="rounded-full bg-sun/15 px-3 py-1 text-xs font-semibold text-sun">{t('Sample data', 'Data contoh')}</span>
            )}
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
              const pct = campaignPercent(c, got);
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
                      <span className="text-xs text-ink-3">{t('covered', 'tertutup')}</span>
                    </p>
                  </div>
                  <div className="mt-3">
                    <Bar pct={pct} />
                  </div>
                  <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-3">
                    {AID.map((a) => {
                      const g = got[a.key] ?? 0;
                      const need = c.needs[a.key];
                      return (
                        <li key={a.key}>
                          <span className="flex justify-between gap-2 text-xs">
                            <span className="truncate text-ink-2">{a.label()}</span>
                            <span className="num shrink-0 text-ink-3">{Math.min(100, Math.round((g / need) * 100))}%</span>
                          </span>
                          <span className="mt-1 block">
                            <Bar pct={Math.min(100, (g / need) * 100)} />
                          </span>
                          <span className="num text-[11px] text-ink-3">
                            {fmt(g)} / {fmt(need)} {a.unit()}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button onClick={() => setOpen(c)}>
                      {t('Pledge help', 'Janjikan bantuan')} <IconArrowRight size={16} />
                    </Button>
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

          <div className="glass mt-10 rounded-[20px] p-5 text-sm leading-6 text-ink-2">
            <p className="font-semibold text-ink">{t('How this works', 'Cara kerjanya')}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>{t('No money is collected here. You record a pledge of goods; the post contacts you to arrange delivery.', 'Tidak ada uang yang dikumpulkan di sini. Anda mencatat janji barang; posko menghubungi Anda untuk mengatur pengiriman.')}</li>
              <li>
                {t(
                  'Needs are estimates scaled from the number of satellite hotspots, not official requests. Check with the local BPBD (via 112) for urgent needs.',
                  'Kebutuhan adalah perkiraan dari jumlah titik panas satelit, bukan permintaan resmi. Tanyakan BPBD setempat (lewat 112) untuk kebutuhan mendesak.',
                )}
              </li>
              <li>{t('Your name and contact are never shown publicly. Only totals are.', 'Nama dan kontak Anda tidak pernah ditampilkan ke publik. Hanya totalnya.')}</li>
            </ul>
          </div>
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
          <div className="py-8 text-center">
            <span className="grad-sun mx-auto grid size-12 place-items-center rounded-full">
              <IconCheck size={22} />
            </span>
            <p className="mt-4 text-lg font-semibold text-ink">{t('Thank you. Your pledge is recorded.', 'Terima kasih. Janji Anda tercatat.')}</p>
            <p className="mt-1 text-sm text-ink-2">
              {fmt(n)} {info.unit()} {info.label().toLowerCase()} → {campaign.province}
            </p>
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
                        <span className="num text-[11px] text-ink-3">{pct}% {t('covered', 'tertutup')}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
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
                <span className="text-sm font-semibold text-ink">{t('Phone or email (optional)', 'Telepon atau email (opsional)')}</span>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={120}
                  className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-black/25 px-3 text-ink focus:border-sun focus:outline-none"
                />
              </label>
            </div>
            <p className="text-xs leading-5 text-ink-3">
              {t('Contact details are only used by the post to arrange delivery and are never shown publicly.', 'Kontak hanya dipakai posko untuk mengatur pengiriman dan tidak pernah ditampilkan ke publik.')}
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
