/**
 * Tujuan setelah masuk dari parameter ?next=. Hanya jalur internal ("/akun"); alamat luar
 * ("https://...", "//evil.com", "/\\evil.com") ditolak agar tidak jadi open redirect.
 */
export function safeNext(v: string | null | undefined, fallback = '/akun'): string {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || /[\r\n]/.test(v)) return fallback;
  return v;
}
