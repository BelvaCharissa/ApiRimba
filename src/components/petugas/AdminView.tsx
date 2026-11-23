'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { Button, Spinner } from '@/components/ui/primitives';
import SiteHeader from '@/components/ui/SiteHeader';

interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  role: 'warga' | 'petugas' | 'admin';
  created_at: string;
}

export default function AdminView() {
  const t = useT();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    const res = await fetch('/api/admin/users', { cache: 'no-store' });
    if (res.status === 403) return setState('forbidden');
    if (!res.ok) return setState('error');
    const data = await res.json() as { users: UserRow[]; me: string };
    setUsers(data.users);
    setMe(data.me);
    setState('ready');
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setRole = async (id: string, role: UserRow['role']) => {
    setNotice('');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role }),
    });
    if (!res.ok) {
      setNotice(t('The role could not be changed.', 'Peran tidak dapat diubah.'));
      return;
    }
    await load();
  };

  return (
    <div className="min-h-dvh bg-paper">
      <div className="grad-canopy">
        <SiteHeader cta={false} />
        <section className="mx-auto max-w-[1200px] px-4 pb-8 pt-6 sm:px-6">
          <p className="text-sm font-semibold text-leaf">{t('Administrator', 'Administrator')}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink">{t('Full administration', 'Administrasi penuh')}</h1>
          <p className="mt-2 max-w-[700px] text-ink-2">
            {t('Manage citizen and verifier accounts, plus access the complete map, aid and verification areas.', 'Kelola akun warga dan verifier, sekaligus akses seluruh peta, bantuan, dan area verifikasi.')}
          </p>
        </section>
      </div>
      <main className="grad-canopy-soft min-h-[60dvh] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-[1200px]">
          {state === 'loading' && <Spinner />}
          {state === 'forbidden' && <p className="glass rounded-[16px] p-5 text-ink-2">{t('This account is not an administrator.', 'Akun ini bukan administrator.')}</p>}
          {state === 'error' && <p className="glass rounded-[16px] p-5 text-danger-ink">{t('Could not load accounts.', 'Daftar akun tidak dapat dimuat.')}</p>}
          {notice && <p className="mb-4 rounded-[12px] bg-danger/15 px-4 py-3 text-sm text-danger-ink">{notice}</p>}
          {state === 'ready' && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <a href="/peta" className="glass rounded-[18px] p-5 text-left hover:bg-white/[0.06]">
                  <p className="text-xs font-bold uppercase text-leaf">{t('Monitor', 'Pantau')}</p>
                  <p className="mt-1 text-lg font-bold text-ink">{t('Map & simulation', 'Peta & simulasi')}</p>
                </a>
                <a href="/petugas" className="glass rounded-[18px] p-5 text-left hover:bg-white/[0.06]">
                  <p className="text-xs font-bold uppercase text-sun">{t('Verify', 'Verifikasi')}</p>
                  <p className="mt-1 text-lg font-bold text-ink">{t('Reports & aid', 'Laporan & bantuan')}</p>
                </a>
                <a href="/bantu" className="glass rounded-[18px] p-5 text-left hover:bg-white/[0.06]">
                  <p className="text-xs font-bold uppercase text-wind">{t('Operate', 'Operasikan')}</p>
                  <p className="mt-1 text-lg font-bold text-ink">{t('Aid posts', 'Posko bantuan')}</p>
                </a>
              </div>
              <section className="glass mt-5 overflow-hidden rounded-[20px]">
                <header className="border-b border-line px-5 py-4">
                  <h2 className="text-lg font-bold text-ink">{t('Accounts', 'Akun')} <span className="num text-ink-3">({users.length})</span></h2>
                </header>
                <ul className="divide-y divide-line">
                  {users.map((u) => (
                    <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{u.display_name || u.email || u.id}</p>
                        <p className="num truncate text-xs text-ink-3">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={t('Account role', 'Peran akun')}
                          value={u.role}
                          disabled={u.id === me}
                          onChange={(e) => void setRole(u.id, e.target.value as UserRow['role'])}
                          className="h-10 rounded-[10px] border border-line-strong bg-black/25 px-3 text-sm text-ink"
                        >
                          <option value="warga">Warga</option>
                          <option value="petugas">Verifier</option>
                          <option value="admin">Admin</option>
                        </select>
                        {u.id === me && <span className="text-xs text-ink-3">{t('This account', 'Akun ini')}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
