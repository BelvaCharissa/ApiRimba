'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { Button } from '@/components/ui/primitives';
import { safeNext } from '@/lib/safe-next';
import { getBrowserSupabase } from '@/lib/supabase/client';
import AuthShell, { Field, FormError } from './AuthShell';
import { authMessage } from './authError';
import { notifyAuthChanged } from './useViewer';

/** Masuk dengan email + sandi, atau satu ketukan ke akun demo hanya-baca. */
export default function SignInView() {
  const t = useT();
  const params = useSearchParams();
  const next = safeNext(params.get('next'), '/peta');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'' | 'form' | 'demo' | 'citizen'>('');
  const [err, setErr] = useState(
    params.get('error') === 'link' ? t('That link has expired or was already used. Please try again.', 'Tautan itu sudah kedaluwarsa atau sudah dipakai. Silakan coba lagi.') : '',
  );

  const done = (to: string) => {
    notifyAuthChanged();
    window.location.assign(to);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sb = getBrowserSupabase();
    if (!sb) return setErr(t('Sign-in is not configured.', 'Login belum dikonfigurasi.'));
    setBusy('form');
    setErr('');
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy('');
    if (error) return setErr(authMessage(error, t));
    done(next);
  };

  const demo = async () => {
    setBusy('demo');
    setErr('');
    const res = await fetch('/api/auth/demo', { method: 'POST' });
    setBusy('');
    if (!res.ok) {
      return setErr(
        res.status === 429
          ? t('Too many attempts. Wait a few minutes and try again.', 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.')
          : t('The demo account is not available right now.', 'Akun demo sedang tidak tersedia.'),
      );
    }
    done(next === '/akun' ? '/petugas' : next);
  };

  const citizenDemo = async () => {
    const sb = getBrowserSupabase();
    if (!sb) return setErr(t('Demo sign-in is not configured.', 'Login demo belum dikonfigurasi.'));
    setBusy('citizen');
    setErr('');
    const nonce = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
    const emailValue = `warga-${nonce}@demo.apirimba.id`;
    const passwordValue = `Warga!${nonce}`;
    const { data, error } = await sb.auth.signUp({
      email: emailValue,
      password: passwordValue,
      options: { data: { display_name: 'Warga Demo', role_request: 'warga' } },
    });
    setBusy('');
    if (error) return setErr(authMessage(error, t));
    if (!data.session) {
      return setErr(t(
        'Citizen demo needs email confirmation. Use Verifier demo, or create a normal citizen account.',
        'Demo Warga perlu konfirmasi email. Pakai Demo Verifier, atau buat akun warga biasa.',
      ));
    }
    notifyAuthChanged();
    window.location.assign(next);
  };

  return (
    <AuthShell
      eyebrow={t('Sign in', 'Masuk')}
      title={t('Welcome back.', 'Selamat datang kembali.')}
      lead={t(
        'Choose your account to map fires, report incidents, manage aid or verify citizen reports.',
        'Pilih akun untuk membuka peta, melapor, mengelola bantuan, atau memverifikasi laporan warga.',
      )}
    >
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field label="Email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label={t('Password', 'Sandi')} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex justify-end">
          <Link href="/lupa-sandi" className="text-sm font-semibold text-sun underline-offset-4 hover:underline">
            {t('Forgot password?', 'Lupa sandi?')}
          </Link>
        </div>
        <FormError>{err}</FormError>
        <Button type="submit" className="w-full" loading={busy === 'form'} disabled={busy !== '' || !email || !password}>
          {t('Sign in', 'Masuk')}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-ink-3">
        <span className="h-px flex-1 bg-line" />
        {t('or', 'atau')}
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={citizenDemo}
          disabled={busy !== ''}
          className="rounded-[16px] border border-line-strong bg-white/[0.04] p-3 text-left transition hover:border-leaf/60 hover:bg-white/[0.08] disabled:opacity-50"
        >
          <p className="text-sm font-bold text-ink">{t('Citizen', 'Warga')}</p>
          <p className="mt-1 text-xs leading-5 text-ink-3">{busy === 'citizen' ? t('Opening...', 'Membuka...') : t('Tap to open demo', 'Ketuk untuk buka demo')}</p>
        </button>
        <button
          type="button"
          onClick={demo}
          disabled={busy !== ''}
          className="rounded-[16px] border border-sun/30 bg-sun/[0.06] p-3 text-left transition hover:border-sun hover:bg-sun/[0.12] disabled:opacity-50"
        >
          <p className="text-sm font-bold text-ink">{t('Verifier', 'Petugas verifikasi')}</p>
          <p className="mt-1 text-xs leading-5 text-ink-3">{busy === 'demo' ? t('Opening...', 'Membuka...') : t('Tap to open view-only demo', 'Ketuk untuk demo lihat saja')}</p>
        </button>
      </div>

      <p className="mt-5 text-center text-sm text-ink-2">
        {t('No account yet?', 'Belum punya akun?')}{' '}
        <Link href={`/daftar${next !== '/akun' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-sun underline-offset-4 hover:underline">
          {t('Create one', 'Daftar')}
        </Link>
      </p>
    </AuthShell>
  );
}
