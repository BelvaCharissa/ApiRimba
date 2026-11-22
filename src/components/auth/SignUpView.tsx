'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { useT } from '@/components/i18n/LangProvider';
import { Button } from '@/components/ui/primitives';
import { safeNext } from '@/lib/safe-next';
import { getBrowserSupabase } from '@/lib/supabase/client';
import AuthShell, { Field, FormError, FormNote } from './AuthShell';
import { authMessage, passwordProblem } from './authError';
import { notifyAuthChanged } from './useViewer';

/** Daftar akun warga baru dengan email + sandi. Peran petugas hanya diberikan oleh admin. */
export default function SignUpView() {
  const t = useT();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const weak = passwordProblem(password, t);
    if (weak) return setErr(weak);
    if (password !== confirm) return setErr(t('The passwords do not match.', 'Kedua sandi tidak sama.'));
    const sb = getBrowserSupabase();
    if (!sb) return setErr(t('Sign-up is not configured.', 'Pendaftaran belum dikonfigurasi.'));
    setBusy(true);
    setErr('');
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim().slice(0, 80) },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) return setErr(authMessage(error, t));
    if (data.session) {
      notifyAuthChanged();
      router.replace(next);
      router.refresh();
      return;
    }
    // Konfirmasi email aktif: sesi baru ada setelah tautan di email diklik.
    setSent(true);
  };

  return (
    <AuthShell
      eyebrow={t('Create account', 'Daftar')}
      title={t('One account for reports and help.', 'Satu akun untuk laporan dan bantuan.')}
      lead={t(
        'Create a Citizen account to follow fire reports, give aid and save simulations. Verifier accounts are assigned by an administrator.',
        'Buat akun Warga untuk melacak laporan api, memberi bantuan, dan menyimpan simulasi. Akun Verifier diberikan oleh administrator.',
      )}
    >
      {sent ? (
        <div className="space-y-4">
          <FormNote>
            {t(
              `We sent a confirmation link to ${email.trim()}. Open it to finish signing up.`,
              `Kami mengirim tautan konfirmasi ke ${email.trim()}. Buka tautan itu untuk menyelesaikan pendaftaran.`,
            )}
          </FormNote>
          <Link href="/masuk" className="block text-center text-sm font-semibold text-sun underline-offset-4 hover:underline">
            {t('Back to sign in', 'Kembali ke halaman masuk')}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label={t('Name', 'Nama')} autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field
            label={t('Password', 'Sandi')}
            type="password"
            autoComplete="new-password"
            required
            hint={t('At least 8 characters, letters and numbers.', 'Minimal 8 karakter, huruf dan angka.')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Field label={t('Repeat password', 'Ulangi sandi')} type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <FormError>{err}</FormError>
          <Button type="submit" className="w-full" loading={busy} disabled={busy || !email || !password || !confirm}>
            {t('Create account', 'Daftar')}
          </Button>
          <p className="text-center text-sm text-ink-2">
            {t('Already have an account?', 'Sudah punya akun?')}{' '}
            <Link href="/masuk" className="font-semibold text-sun underline-offset-4 hover:underline">
              {t('Sign in', 'Masuk')}
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
