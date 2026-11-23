'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { signOut } from '@/components/auth/useViewer';
import { useT } from '@/components/i18n/LangProvider';
import { StatusPill, useAiLabel, useCategoryLabel, type AiLabel } from '@/components/lapor/ReportList';
import { PledgeStepper } from '@/components/bantu/BantuView';
import { Button, ButtonLink, Spinner } from '@/components/ui/primitives';
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
  const router = useRouter();
  const [auth, setAuth] = useState<'checking' | 'out' | 'forbidden' | 'in' | 'not_migrated'>('checking');
  const [readOnly, setReadOnly] = useState(false);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'reports' | 'pledges'>('reports');
  const [reports, setReports] = useState<OReport[]>([]);
  const [pledges, setPledges] = useState<OPledge[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/petugas', { cache: 'no-store' });
    if (res.status === 401) return setAuth('out');
    if (res.status === 403) return setAuth('forbidden');
    if (res.status === 503) return setAuth('not_migrated');
    if (!res.ok) return setAuth('out');
    const d = (await res.json()) as { reports: OReport[]; pledges: OPledge[]; readOnly: boolean };
    setReports(d.reports);
    setPledges(d.pledges.map((p) => ({ ...p, quantity: Number(p.quantity) })));
    setReadOnly(d.readOnly);
    setAuth('in');
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data dimuat sekali dari server
    void load();
  }, [load]);

  const logout = async () => {
    await signOut();
    router.replace('/masuk?next=/petugas');
    router.refresh();
  };

  const act = async (body: Record<string, unknown>) => {
    setNotice('');
    const res = await fetch('/api/petugas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 401) return setAuth('out');
    if (res.status === 403) {
      setNotice(t('The demo account can only view. Changes are not saved.', 'Akun demo hanya bisa melihat. Perubahan tidak disimpan.'));
      return;
    }
    if (!res.ok) setNotice(t('Could not save. Please try again.', 'Belum tersimpan. Silakan coba lagi.'));
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
                'The officer features need the database update in supabase/migrations/0005 to 0007.',
                'Fitur petugas butuh pembaruan database di supabase/migrations/0005 sampai 0007.',
              )}
            </p>
          )}
          {auth === 'out' && (
            <div className="glass max-w-[460px] space-y-3 rounded-[20px] p-5">
              <p className="text-ink-2">{t('Sign in with an officer account to open the dashboard.', 'Masuk dengan akun petugas untuk membuka dasbor.')}</p>
              <ButtonLink href="/masuk?next=/petugas" className="w-full">
                {t('Sign in', 'Masuk')}
              </ButtonLink>
            </div>
          )}
          {auth === 'forbidden' && (
            <div className="glass max-w-[520px] space-y-3 rounded-[20px] p-5">
              <p className="font-semibold text-ink">{t('This account is not an officer account.', 'Akun ini bukan akun petugas.')}</p>
              <p className="text-sm leading-6 text-ink-2">
                {t(
                  'Officer access is given by an admin after checking who you are. You can still report fires and pledge aid.',
                  'Akses petugas diberikan admin setelah identitas Anda dicek. Anda tetap bisa melapor api dan menjanjikan bantuan.',
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/akun" variant="secondary">
                  {t('My account', 'Akun saya')}
                </ButtonLink>
                <Button variant="ghost" onClick={logout}>
                  {t('Switch account', 'Ganti akun')}
                </Button>
              </div>
            </div>
          )}
          {auth === 'in' && (
            <>
              {readOnly && (
                <p role="status" className="mb-4 rounded-[14px] border border-sun/40 bg-sun/10 px-4 py-3 text-sm text-ink">
                  <strong>{t('Demo mode, view only.', 'Mode demo, lihat saja.')}</strong>{' '}
                  {t(
                    'Citizen names are shortened and contact details are hidden. Buttons are turned off.',
                    'Nama warga disingkat dan kontak disembunyikan. Tombol aksi dimatikan.',
                  )}
                </p>
              )}
              {notice && (
                <p role="alert" className="mb-4 rounded-[14px] bg-danger/15 px-4 py-3 text-sm text-danger-ink">
                  {notice}
                </p>
              )}
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
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setTab('reports');
                    document.getElementById('verification-work')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="rounded-[18px] border border-sun/40 bg-sun/[0.08] p-5 text-left hover:bg-sun/[0.13]"
                >
                  <p className="num text-3xl font-bold text-sun">{pendingCount}</p>
                  <p className="mt-1 text-sm font-bold text-ink">{t('reports waiting', 'laporan menunggu')}</p>
                  <p className="mt-1 text-xs leading-5 text-ink-3">{t('Start verification now', 'Mulai verifikasi sekarang')} →</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('pledges')}
                  className="rounded-[18px] border border-leaf/30 bg-leaf/[0.07] p-5 text-left hover:bg-leaf/[0.12]"
                >
                  <p className="num text-3xl font-bold text-leaf">{openPledges}</p>
                  <p className="mt-1 text-sm font-bold text-ink">{t('aid pledges in progress', 'janji bantuan berjalan')}</p>
                  <p className="mt-1 text-xs leading-5 text-ink-3">{t('Continue distribution workflow', 'lanjutkan alur penyaluran')} →</p>
                </button>
                <div className="rounded-[18px] border border-line-strong bg-white/[0.04] p-5">
                  <p className="text-3xl font-bold text-ink">3/4</p>
                  <p className="mt-1 text-sm font-bold text-ink">{t('verification stages', 'tahap verifikasi')}</p>
                  <p className="mt-1 text-xs leading-5 text-ink-3">{t('Photo · location · satellite · officer', 'Foto · lokasi · satelit · petugas')}</p>
                </div>
              </div>
              <div id="verification-work" className="scroll-mt-24" />
              {tab === 'reports' ? (
                <ul className="mt-5 grid gap-3 lg:grid-cols-2">
                  {reports.length === 0 && <p className="text-ink-2">{t('No reports yet.', 'Belum ada laporan.')}</p>}
                  {reports.map((r) => (
                    <ReportCard key={r.id} r={r} onAct={act} readOnly={readOnly} />
                  ))}
                </ul>
              ) : (
                <ul className="mt-5 space-y-3">
                  {pledges.length === 0 && <p className="text-ink-2">{t('No pledges yet.', 'Belum ada janji bantuan.')}</p>}
                  {pledges.map((p) => (
                    <PledgeRow key={p.id} p={p} onAct={act} readOnly={readOnly} />
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

function ReportCard({ r, onAct, readOnly }: { r: OReport; onAct: (b: Record<string, unknown>) => Promise<void>; readOnly: boolean }) {
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
              {readOnly ? ` · ${t('contact hidden in demo', 'kontak disembunyikan di demo')}` : r.contact ? ` · ${r.contact}` : ''}
            </dd>
          </dl>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            disabled={readOnly}
            placeholder={t('Note (shown publicly)', 'Catatan (tampil ke publik)')}
            className="mt-3 h-10 w-full rounded-[10px] border border-line-strong bg-black/25 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-sun focus:outline-none disabled:opacity-50"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || readOnly} onClick={() => go('verified')}>
              {t('Verify', 'Verifikasi')}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy || readOnly} onClick={() => go('rejected')}>
              {t('Reject', 'Tolak')}
            </Button>
            {(r.status === 'verified' || r.status === 'rejected') && (
              <Button size="sm" variant="ghost" disabled={busy || readOnly} onClick={() => go('pending')}>
                {t('Back to waiting', 'Kembalikan ke menunggu')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function PledgeRow({ p, onAct, readOnly }: { p: OPledge; onAct: (b: Record<string, unknown>) => Promise<void>; readOnly: boolean }) {
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
            {p.donor_name ?? t('(no name)', '(tanpa nama)')} ·{' '}
            {readOnly ? t('contact hidden in demo', 'kontak disembunyikan di demo') : (p.contact ?? t('no contact', 'tanpa kontak'))}
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
          disabled={readOnly}
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
          disabled={readOnly}
          placeholder={t('Note for the donor (optional)', 'Catatan untuk donatur (opsional)')}
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-line-strong bg-black/25 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-sun focus:outline-none"
        />
        <Button size="sm" disabled={busy || readOnly || (status === p.status && !note)} onClick={save}>
          {t('Update', 'Perbarui')}
        </Button>
      </div>
    </li>
  );
}
