import { createHash } from 'node:crypto';
import { apiError } from '@/lib/schemas';
import { getSupabase } from '@/lib/supabase/server';

/** Batas per alamat IP untuk tiap endpoint yang bisa disalahgunakan (tulis data atau memanggil AI). */
export const LIMITS = {
  lapor: { max: 5, windowSec: 600 },
  bantu: { max: 10, windowSec: 600 },
  chat: { max: 30, windowSec: 600 },
  briefing: { max: 10, windowSec: 600 },
  simulasi: { max: 20, windowSec: 600 },
  demo: { max: 10, windowSec: 600 },
  staf: { max: 120, windowSec: 600 },
} as const;
export type LimitBucket = keyof typeof LIMITS;

/** IP klien dari header Vercel; di-hash agar alamat IP asli tidak tersimpan di basis data. */
export function clientKey(req: Request): string {
  const ip =
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  const salt = process.env.RATE_LIMIT_SALT ?? 'apirimba';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 40);
}

/**
 * Hitung satu permintaan. Mengembalikan Response 429 bila melewati batas, atau null bila boleh lanjut.
 * Bila basis data belum punya fungsi rate_hit (migrasi 0007 belum dijalankan), permintaan tetap dilayani.
 */
export async function rateLimit(req: Request, bucket: LimitBucket): Promise<Response | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { max, windowSec } = LIMITS[bucket];
  const { data, error } = await sb.rpc('rate_hit', {
    p_bucket: bucket,
    p_subject: clientKey(req),
    p_max: max,
    p_window_seconds: windowSec,
  });
  if (error || data !== false) return null;
  const res = apiError('rate_limited', 'Too many requests. Please wait a few minutes and try again.', 429);
  res.headers.set('Retry-After', String(windowSec));
  return res;
}
