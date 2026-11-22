'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { Button, Spinner } from '@/components/ui/primitives';
import { getBrowserSupabase } from '@/lib/supabase/client';
import AuthShell, { Field, FormError, FormNote } from './AuthShell';
import { authMessage, passwordProblem } from './authError';
import { notifyAuthChanged } from './useViewer';

/** Minta tautan atur ulang sandi. Pesan selalu sama agar tidak membocorkan email yang terdaftar. */
export function ForgotPasswordView() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sb = getBrowserSupabase();
    if (!sb) return;
    setBusy(true);
    setErr('');
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/atur-sandi`,
    });
    setBusy(false);
    if (error && (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit')) return setErr(authMessage(error, t));
    setSent(true);
  };

  return (
    <AuthShell eyebrow={t('Password', 'Sandi')} title={t('Reset your password.', 'Atur ulang sandi.')}>
      {sent ? (
        <div className="space-y-4">
          <FormNote>
            {t(
              'If that email has an account, a reset link is on its way. It works once and expires in one hour.',
              'Bila email itu punya akun, tautan atur ulang sedang dikirim. Tautan hanya berlaku sekali dan kedaluwarsa dalam satu jam.',
            )}
          </FormNote>
          <Link href="/masuk" className="block text-center text-sm font-semibold text-sun underline-offset-4 hover:underline">
            {t('Back to sign in', 'Kembali ke halaman masuk')}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label="Email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormError>{err}</FormError>
          <Button type="submit" className="w-full" loading={busy} disabled={busy || !email}>
            {t('Send reset link', 'Kirim tautan')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

/** Setel sandi baru setelah membuka tautan dari email (sesi pemulihan sudah ada di cookie). */
export function ResetPasswordView() {
  const t = useT();
  const router = useRouter();
  const [ready, setReady] = useState<'checking' | 'yes' | 'no'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    void sb.auth.getUser().then(({ data }) => setReady(data.user ? 'yes' : 'no'));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const weak = passwordProblem(password, t);
    if (weak) return setErr(weak);
    if (password !== confirm) return setErr(t('The passwords do not match.', 'Kedua sandi tidak sama.'));
    const sb = getBrowserSupabase();
    if (!sb) return;
    setBusy(true);
    setErr('');
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr(authMessage(error, t));
    notifyAuthChanged();
    router.replace('/akun');
    router.refresh();
  };

  return (
    <AuthShell eyebrow={t('Password', 'Sandi')} title={t('Choose a new password.', 'Buat sandi baru.')}>
      {ready === 'checking' && <Spinner />}
      {ready === 'no' && (
        <div className="space-y-4">
          <FormError>{t('This page needs a fresh reset link from your email.', 'Halaman ini butuh tautan atur ulang baru dari email Anda.')}</FormError>
          <Link href="/lupa-sandi" className="block text-center text-sm font-semibold text-sun underline-offset-4 hover:underline">
            {t('Send a new link', 'Kirim tautan baru')}
          </Link>
        </div>
      )}
      {ready === 'yes' && (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field
            label={t('New password', 'Sandi baru')}
            type="password"
            autoComplete="new-password"
            required
            hint={t('At least 8 characters, letters and numbers.', 'Minimal 8 karakter, huruf dan angka.')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Field label={t('Repeat password', 'Ulangi sandi')} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <FormError>{err}</FormError>
          <Button type="submit" className="w-full" loading={busy} disabled={busy || !password || !confirm}>
            {t('Save password', 'Simpan sandi')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
