'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { StatusPill, useCategoryLabel } from '@/components/lapor/ReportList';
import { Button, ButtonLink, Spinner } from '@/components/ui/primitives';
import SiteHeader from '@/components/ui/SiteHeader';
import { aidInfo, type AidType, type PledgeStatus, pledgeStatusLabel } from '@/lib/aid';
import { locale } from '@/lib/i18n';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { FormError } from './AuthShell';
import { notifyAuthChanged, signOut, type ViewerRole } from './useViewer';

export interface AccountData {
  email: string;
  name: string | null;
  role: ViewerRole;
  reports: { id: string; created_at: string; category: 'fire' | 'smoke' | 'burnt'; place: string | null; status: 'matched' | 'pending' | 'verified' | 'rejected'; review_note: string | null }[];
  pledges: { code: string; created_at: string; campaign_key: string; aid_type: AidType; quantity: number; status: PledgeStatus }[];
  simulations: { id: string; created_at: string; label: string | null; wind_ms: number; scenario: string | null }[];
}

const when = (iso: string) => new Date(iso).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function useRoleLabel() {
  const t = useT();
  return (r: ViewerRole) =>
    ({
      anon: t('Guest', 'Tamu'),
      warga: t('Citizen', 'Warga'),
      petugas: t('Verifier', 'Petugas verifikasi'),
      admin: 'Admin',
      demo: t('Demo (view only)', 'Demo (lihat saja)'),
    })[r];
}

export default function AccountView({ data }: { data: AccountData }) {
  const t = useT();
  const router = useRouter();
  const roleLabel = useRoleLabel();
  const cat = useCategoryLabel();
  const [name, setName] = useState(data.name ?? '');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const staff = data.role === 'petugas' || data.role === 'admin' || data.role === 'demo';

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    const sb = getBrowserSupabase();
    if (!sb) return;
    setBusy(true);
    setErr('');
    const { error } = await sb.rpc('update_my_profile', { p_display_name: name });
    setBusy(false);
    if (error) return setErr(t('Could not save your name.', 'Nama belum bisa disimpan.'));
    setSaved(true);
    notifyAuthChanged();
  };

  const out = async () => {
    await signOut();
    router.replace('/');
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-paper">
      <div className="grad-canopy">
        <SiteHeader />
        <section className="mx-auto max-w-[1200px] px-4 pb-8 pt-6 sm:px-6">
          <p className="text-sm font-semibold text-leaf">{t('Account', 'Akun')}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink">{data.name || data.email}</h1>
          <p className="mt-2 text-ink-2">
            {data.email} · <span className="font-semibold text-ink">{roleLabel(data.role)}</span>
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {staff && <ButtonLink href="/petugas">{t('Officer dashboard', 'Dasbor petugas')}</ButtonLink>}
            <ButtonLink href="/lapor" variant={staff ? 'secondary' : 'primary'}>
              {t('Report a fire', 'Lapor api')}
            </ButtonLink>
            <ButtonLink href="/bantu" variant="secondary">
              {t('Give help', 'Bantu')}
            </ButtonLink>
            <Button variant="ghost" onClick={out}>
              {t('Sign out', 'Keluar')}
            </Button>
          </div>
        </section>
      </div>

      <div className="grad-canopy-soft min-h-[60dvh]">
        <div className="mx-auto grid max-w-[1200px] gap-4 px-4 py-8 sm:px-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            {data.role !== 'demo' && (
              <form onSubmit={saveName} className="glass space-y-3 rounded-[20px] p-5">
                <h2 className="text-lg font-bold text-ink">{t('Profile', 'Profil')}</h2>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">{t('Display name', 'Nama tampilan')}</span>
                  <input
                    value={name}
                    maxLength={80}
                    autoComplete="name"
                    onChange={(e) => {
                      setName(e.target.value);
                      setSaved(false);
                    }}
                    className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-black/25 px-3 text-ink focus:border-sun focus:outline-none"
                  />
                </label>
                <FormError>{err}</FormError>
                <Button type="submit" size="sm" loading={busy} disabled={busy || name === (data.name ?? '')}>
                  {saved ? t('Saved', 'Tersimpan') : t('Save', 'Simpan')}
                </Button>
              </form>
            )}
            <div className="glass rounded-[20px] p-5 text-sm leading-6 text-ink-2">
              <h2 className="text-lg font-bold text-ink">{t('Your data', 'Data Anda')}</h2>
              <p className="mt-1">
                {t(
                  'Only you can see this list. Officers see your contact details only on reports you choose to send.',
                  'Hanya Anda yang bisa melihat daftar ini. Petugas hanya melihat kontak Anda pada laporan yang Anda kirim.',
                )}
              </p>
              <Link href="/lupa-sandi" className="mt-2 inline-block font-semibold text-sun underline-offset-4 hover:underline">
                {t('Change password', 'Ganti sandi')}
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <Section title={t('My fire reports', 'Laporan saya')} empty={t('No reports yet.', 'Belum ada laporan.')} count={data.reports.length}>
              {data.reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-semibold text-ink">
                      {cat(r.category)} · {r.place ?? '-'}
                    </p>
                    <p className="text-xs text-ink-3">{when(r.created_at)}</p>
                    {r.review_note && <p className="mt-1 text-xs text-ink-2">{r.review_note}</p>}
                  </div>
                  {r.status === 'rejected' ? (
                    <span className="rounded-full bg-danger/20 px-2.5 py-1 text-[11px] font-bold text-danger-ink">{t('Rejected', 'Ditolak')}</span>
                  ) : (
                    <StatusPill status={r.status} />
                  )}
                </li>
              ))}
            </Section>

            <Section title={t('My aid pledges', 'Janji bantuan saya')} empty={t('No pledges yet.', 'Belum ada janji bantuan.')} count={data.pledges.length}>
              {data.pledges.map((p) => {
                const a = aidInfo(p.aid_type);
                return (
                  <li key={p.code} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {Number(p.quantity).toLocaleString(locale())} {a.unit()} {a.label().toLowerCase()} → {p.campaign_key.replace(/^prov:/, '')}
                      </p>
                      <p className="num text-xs text-ink-3">
                        {p.code} · {when(p.created_at)}
                      </p>
                    </div>
                    <Link href={`/bantu?kode=${encodeURIComponent(p.code)}`} className="text-sm font-semibold text-sun underline-offset-4 hover:underline">
                      {pledgeStatusLabel(p.status)}
                    </Link>
                  </li>
                );
              })}
            </Section>

            <Section title={t('My saved simulations', 'Simulasi tersimpan')} empty={t('Save a simulation report from the map to see it here.', 'Simpan laporan simulasi dari peta agar muncul di sini.')} count={data.simulations.length}>
              {data.simulations.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-semibold text-ink">{s.label || s.scenario || t('Simulation', 'Simulasi')}</p>
                    <p className="num text-xs text-ink-3">
                      {when(s.created_at)} · {s.wind_ms} m/s
                    </p>
                  </div>
                  <Link href={`/report/${s.id}`} className="text-sm font-semibold text-sun underline-offset-4 hover:underline">
                    {t('Open report', 'Buka laporan')}
                  </Link>
                </li>
              ))}
            </Section>

            {data.role === 'admin' && <AdminUsers />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, empty, count, children }: { title: string; empty: string; count: number; children: ReactNode }) {
  return (
    <section className="glass rounded-[20px] p-5">
      <h2 className="text-lg font-bold text-ink">
        {title} <span className="text-ink-3">({count})</span>
      </h2>
      {count === 0 ? <p className="mt-2 text-sm text-ink-2">{empty}</p> : <ul className="mt-1 divide-y divide-line text-sm">{children}</ul>}
    </section>
  );
}

interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  role: ViewerRole;
  created_at: string;
  last_sign_in_at: string | null;
}

/** Admin: beri atau cabut peran petugas. Basis data menolak perubahan pada diri sendiri dan akun demo. */
function AdminUsers() {
  const t = useT();
  const roleLabel = useRoleLabel();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [me, setMe] = useState('');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/users', { cache: 'no-store' });
    if (!res.ok) return setErr(t('Could not load accounts.', 'Daftar akun belum bisa dimuat.'));
    const d = (await res.json()) as { users: AdminUser[]; me: string };
    setUsers(d.users);
    setMe(d.me);
  }, [t]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data dimuat sekali dari server
    void load();
  }, [load]);

  const setRole = async (id: string, role: 'warga' | 'petugas' | 'admin') => {
    setErr('');
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, role }) });
    if (!res.ok) setErr(t('The role was not changed.', 'Peran tidak berubah.'));
    await load();
  };

  const shown = (users ?? []).filter((u) => !q || `${u.email} ${u.display_name ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <section className="glass rounded-[20px] p-5">
      <h2 className="text-lg font-bold text-ink">{t('Manage accounts', 'Kelola akun')}</h2>
      <p className="mt-1 text-sm text-ink-2">{t('Give officer access to post staff after checking who they are.', 'Beri akses petugas kepada staf posko setelah identitasnya dicek.')}</p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('Search email or name', 'Cari email atau nama')}
        aria-label={t('Search accounts', 'Cari akun')}
        className="mt-3 h-10 w-full rounded-[10px] border border-line-strong bg-black/25 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-sun focus:outline-none"
      />
      <div className="mt-2">
        <FormError>{err}</FormError>
      </div>
      {users === null ? (
        <div className="mt-3">
          <Spinner />
        </div>
      ) : (
        <ul className="mt-1 divide-y divide-line text-sm">
          {shown.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{u.display_name || u.email}</p>
                <p className="truncate text-xs text-ink-3">{u.email}</p>
              </div>
              {u.id === me || u.role === 'demo' ? (
                <span className="text-xs font-semibold text-ink-2">{roleLabel(u.role)}</span>
              ) : (
                <select
                  value={u.role}
                  onChange={(e) => void setRole(u.id, e.target.value as 'warga' | 'petugas' | 'admin')}
                  aria-label={t(`Role for ${u.email}`, `Peran untuk ${u.email}`)}
                  className="h-9 rounded-[10px] border border-line-strong bg-black/40 px-2 text-sm text-ink"
                >
                  {(['warga', 'petugas', 'admin'] as const).map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
