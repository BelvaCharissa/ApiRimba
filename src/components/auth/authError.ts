import type { AuthError } from '@supabase/supabase-js';

type T = (en: string, id: string) => string;

/** Pesan galat Supabase Auth yang ramah, tanpa membocorkan apakah sebuah email terdaftar. */
export function authMessage(e: AuthError | null, t: T): string {
  if (!e) return '';
  switch (e.code) {
    case 'invalid_credentials':
      return t('Email or password is wrong.', 'Email atau sandi salah.');
    case 'email_not_confirmed':
      return t('Please confirm your email first. Check your inbox.', 'Konfirmasi email Anda dulu. Cek kotak masuk.');
    case 'user_already_exists':
    case 'email_exists':
      return t('This email is already registered. Try signing in.', 'Email ini sudah terdaftar. Coba masuk.');
    case 'weak_password':
      return t('The password is too weak. Use at least 8 characters with letters and numbers.', 'Sandi terlalu lemah. Pakai minimal 8 karakter berisi huruf dan angka.');
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return t('Too many attempts. Wait a few minutes and try again.', 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.');
    case 'same_password':
      return t('The new password must be different from the old one.', 'Sandi baru harus berbeda dari sandi lama.');
    case 'signup_disabled':
      return t('Sign-up is closed right now.', 'Pendaftaran sedang ditutup.');
    default:
      return t('Something went wrong. Please try again.', 'Terjadi kesalahan. Silakan coba lagi.');
  }
}

/** Aturan sandi minimum di sisi klien (server Auth tetap memeriksa). */
export function passwordProblem(pw: string, t: T): string {
  if (pw.length < 8) return t('Use at least 8 characters.', 'Pakai minimal 8 karakter.');
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return t('Mix letters and numbers.', 'Gabungkan huruf dan angka.');
  return '';
}
