'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { StatusPill, useAiLabel, useCategoryLabel, type AiLabel } from '@/components/lapor/ReportList';
import { PledgeStepper } from '@/components/bantu/BantuView';
import { Button, Spinner } from '@/components/ui/primitives';
import SiteHeader from '@/components/ui/SiteHeader';
import { aidInfo, type AidType, DROPOFF, type Dropoff, PLEDGE_STEPS, type PledgeStatus, pledgeStatusLabel } from '@/lib/aid';
import { locale } from '@/lib/i18n';

interface OReport {
  id: string;
  created_at: string;
  lat: number;
  lon: number;
  category: 'fire' | 'smoke' | 'burnt';
  description: string;
  photo_url: string;
  status: 'matched' | 'pending' | 'verified' | 'rejected';
  satellite_km: number | string | null;
  exif_km: number | string | null;
  reporter_name: string | null;
  contact: string | null;
  ai_label: AiLabel | null;
  ai_confidence: number | string | null;
  ai_reason: string | null;
  photo_source: 'camera' | 'gallery' | null;
  place: string | null;
  photo_taken_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

interface OPledge {
  id: string;
  code: string;
  created_at: string;
  campaign_key: string;
  aid_type: AidType;
  quantity: number;
  dropoff: Dropoff;
  donor_name: string | null;
  contact: string | null;
  status: PledgeStatus;
  status_at: string;
  status_note: string | null;
}

const when = (iso: string) => new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const n = (v: number | string | null) => (v === null ? null : Number(v));

/** Dasbor petugas posko: verifikasi laporan warga dan perbarui status penyaluran bantuan. */
export default function OfficerView() {
  const t = useT();
  const [auth, setAuth] = useState<'checking' | 'out' | 'in' | 'not_migrated'>('checking');
  const [pin, setPin] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'reports' | 'pledges'>('reports');
  const [reports, setReports] = useState<OReport[]>([]);
  const [pledges, setPledges] = useState<OPledge[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/petugas', { cache: 'no-store' });
    if (res.status === 401) return setAuth('out');
    if (res.status === 503) return setAuth('not_migrated');
    if (!res.ok) return setAuth('out');
    const d = (await res.json()) as { reports: OReport[]; pledges: OPledge[] };
    setReports(d.reports);
    setPledges(d.pledges.map((p) => ({ ...p, quantity: Number(p.quantity) })));
    setAuth('in');
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data dimuat sekali dari server
    void load();
  }, [load]);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLoginErr('');
    const res = await fetch('/api/petugas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', pin }) });
    setBusy(false);
    if (res.ok) {
      setPin('');
      return load();
    }
    if (res.status === 503) return setAuth('not_migrated');
    setLoginErr(t('Wrong PIN.', 'PIN salah.'));
  };

  const logout = async () => {
    await fetch('/api/petugas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    setAuth('out');
  };

  const act = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/petugas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 401) return setAuth('out');
    await load();
  };

  const pendingCount = reports.filter((r) => r.status === 'pending' || r.status === 'matched').length;
  const openPledges = pledges.filter((p) => p.status !== 'distributed' && p.status !== 'cancelled').length;

  return (
    <div className="min-h-dvh bg-paper">
      <div className="grad-canopy">
        <SiteHeader cta={false} />
        <section className="mx-auto max-w-[1200px] px-4 pb-8 pt-6 sm:px-6">
          <p className="text-sm font-semibold text-leaf">{t('Officers only', 'Khusus petugas')}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink">{t('Post officer dashboard', 'Dasbor petugas posko')}</h1>
          <p className="mt-2 max-w-[640px] text-ink-2">
            {t('Confirm citizen reports and update where each aid pledge is.', 'Konfirmasi laporan warga dan perbarui posisi tiap janji bantuan.')}
          </p>
        </section>
      </div>
      <div className="grad-canopy-soft min-h-[60dvh]">
        <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
          {auth === 'checking' && <Spinner />}
          {auth === 'not_migrated' && (
            <p className="glass rounded-[16px] p-5 text-ink-2">
              {t(
                'The officer features need the database update in supabase/migrations/0005_review_tracking.sql and an officer PIN.',
                'Fitur petugas butuh pembaruan database di supabase/migrations/0005_review_tracking.sql dan PIN petugas.',
              )}
            </p>
          )}
          {auth === 'out' && (
            <form onSubmit={login} className="glass max-w-[420px] space-y-3 rounded-[20px] p-5">
              <label className="block">
                <span className="text-sm font-semibold text-ink">{t('Officer PIN', 'PIN petugas')}</span>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoComplete="current-password"
                  className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-black/25 px-3 text-ink focus:border-sun focus:outline-none"
                />
              </label>
              {loginErr && <p className="text-sm text-danger-ink">{loginErr}</p>}
              <Button type="submit" disabled={busy || pin.length < 6} className="w-full">
                {busy ? <Spinner /> : t('Sign in', 'Masuk')}
              </Button>
            </form>
          )}
          {auth === 'in' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div role="tablist" className="glass inline-flex rounded-full p-1">
                  {(
                    [
                      ['reports', `${t('Reports', 'Laporan')} (${pendingCount})`],
                      ['pledges', `${t('Aid', 'Bantuan')} (${openPledges})`],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={tab === k}
                      onClick={() => setTab(k)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? 'grad-sun' : 'text-ink-2 hover:text-ink'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Button variant="ghost" onClick={logout}>
                  {t('Sign out', 'Keluar')}
                </Button>
              </div>
              {tab === 'reports' ? (
                <ul className="mt-5 grid gap-3 lg:grid-cols-2">
                  {reports.length === 0 && <p className="text-ink-2">{t('No reports yet.', 'Belum ada laporan.')}</p>}
                  {reports.map((r) => (
                    <ReportCard key={r.id} r={r} onAct={act} />
                  ))}
                </ul>
              ) : (
                <ul className="mt-5 space-y-3">
                  {pledges.length === 0 && <p className="text-ink-2">{t('No pledges yet.', 'Belum ada janji bantuan.')}</p>}
                  {pledges.map((p) => (
                    <PledgeRow key={p.id} p={p} onAct={act} />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ReportCard({ r, onAct }: { r: OReport; onAct: (b: Record<string, unknown>) => Promise<void> }) {
  const t = useT();
  const cat = useCategoryLabel();
  const ai = useAiLabel();
  const [note, setNote] = useState(r.review_note ?? '');
  const [busy, setBusy] = useState(false);
  const go = async (status: 'verified' | 'rejected' | 'pending') => {
    setBusy(true);
    await onAct({ action: 'review', id: r.id, status, note: note || undefined });
    setBusy(false);
  };
  const sat = n(r.satellite_km);
  const exif = n(r.exif_km);
  return (
    <li className={`glass overflow-hidden rounded-[20px] ${r.status === 'rejected' ? 'opacity-60' : ''}`}>
      <div className="grid sm:grid-cols-[220px_1fr]">
        <a href={r.photo_url} target="_blank" rel="noreferrer" className="block bg-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.photo_url} alt={cat(r.category)} className="aspect-[4/3] size-full object-cover sm:aspect-auto" />
        </a>
        <div className="p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-ink">
              {cat(r.category)} · {r.place ?? '-'}
            </p>
            {r.status === 'rejected' ? (
              <span className="rounded-full bg-danger/20 px-2.5 py-1 text-[11px] font-bold text-danger-ink">{t('Rejected', 'Ditolak')}</span>
            ) : (
              <StatusPill status={r.status} />
            )}
          </div>
          <p className="mt-1 leading-6 text-ink-2">{r.description}</p>
          <dl className="num mt-2 grid grid-cols-[110px_1fr] gap-x-2 gap-y-0.5 text-xs text-ink-3">
            <dt>{t('Sent', 'Dikirim')}</dt>
            <dd className="text-ink-2">{when(r.created_at)}</dd>
            <dt>{t('Photo', 'Foto')}</dt>
            <dd className="text-ink-2">
              {r.photo_source === 'camera' ? t('live camera', 'kamera langsung') : t('gallery', 'galeri')}
              {r.photo_taken_at ? ` · ${when(r.photo_taken_at)}` : ''}
            </dd>
            <dt>AI</dt>
            <dd className="text-ink-2">
              {r.ai_label ? `${ai(r.ai_label)} (${Math.round((n(r.ai_confidence) ?? 0) * 100)}%)` : t('not checked', 'belum dicek')}
              {r.ai_reason ? ` · ${r.ai_reason}` : ''}
            </dd>
            <dt>{t('Satellite', 'Satelit')}</dt>
            <dd className="text-ink-2">{sat !== null ? `${sat} km` : '-'}</dd>
            <dt>GPS {t('photo', 'foto')}</dt>
            <dd className="text-ink-2">{exif !== null ? `${exif} km` : '-'}</dd>
            <dt>{t('Coordinates', 'Koordinat')}</dt>
            <dd>
              <a className="text-sun underline-offset-4 hover:underline" href={`https://www.google.com/maps?q=${r.lat},${r.lon}`} target="_blank" rel="noreferrer">
                {r.lat.toFixed(5)}, {r.lon.toFixed(5)}
              </a>
            </dd>
            <dt>{t('Reporter', 'Pelapor')}</dt>
            <dd className="text-ink-2">
              {r.reporter_name ?? '-'}
              {r.contact ? ` · ${r.contact}` : ''}
            </dd>
          </dl>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder={t('Note (shown publicly)', 'Catatan (tampil ke publik)')}
            className="mt-3 h-10 w-full rounded-[10px] border border-line-strong bg-black/25 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-sun focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => go('verified')}>
              {t('Verify', 'Verifikasi')}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => go('rejected')}>
              {t('Reject', 'Tolak')}
            </Button>
            {(r.status === 'verified' || r.status === 'rejected') && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => go('pending')}>
                {t('Back to waiting', 'Kembalikan ke menunggu')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function PledgeRow({ p, onAct }: { p: OPledge; onAct: (b: Record<string, unknown>) => Promise<void> }) {
  const t = useT();
  const [status, setStatus] = useState<PledgeStatus>(p.status);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const a = aidInfo(p.aid_type);
  const save = async () => {
    setBusy(true);
    await onAct({ action: 'pledge', id: p.id, status, note: note || undefined });
    setNote('');
    setBusy(false);
  };
  return (
    <li className="glass rounded-[18px] p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">
            {p.quantity.toLocaleString(locale())} {a.unit()} {a.label().toLowerCase()} → {p.campaign_key.replace(/^prov:/, '')}
          </p>
          <p className="num text-xs text-ink-3">
            {p.code} · {when(p.created_at)} · {DROPOFF.find((d) => d.key === p.dropoff)?.label()}
          </p>
          <p className="text-xs text-ink-2">
            {p.donor_name ?? t('(no name)', '(tanpa nama)')} · {p.contact ?? t('no contact', 'tanpa kontak')}
          </p>
        </div>
        <span className="text-xs font-semibold text-ink-2">{pledgeStatusLabel(p.status)}</span>
      </div>
      <div className="mt-3">
        <PledgeStepper status={p.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PledgeStatus)}
          aria-label={t('New status', 'Status baru')}
          className="h-10 rounded-[10px] border border-line-strong bg-black/40 px-2 text-sm text-ink"
        >
          {[...PLEDGE_STEPS.map((s) => s.key), 'cancelled' as const].map((k) => (
            <option key={k} value={k}>
              {pledgeStatusLabel(k)}
            </option>
          ))}
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder={t('Note for the donor (optional)', 'Catatan untuk donatur (opsional)')}
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-line-strong bg-black/25 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-sun focus:outline-none"
        />
        <Button size="sm" disabled={busy || (status === p.status && !note)} onClick={save}>
          {t('Update', 'Perbarui')}
        </Button>
      </div>
    </li>
  );
}
