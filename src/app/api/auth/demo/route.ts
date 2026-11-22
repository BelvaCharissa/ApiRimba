import { rateLimit } from '@/lib/ratelimit';
import { apiError } from '@/lib/schemas';
import { getSessionSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Masuk sebagai akun demo (untuk juri dan pengunjung). Email dan sandi demo hanya ada di env server
 * (DEMO_EMAIL, DEMO_PASSWORD), tidak pernah dikirim ke peramban. Akun demo berperan 'demo':
 * boleh melihat dasbor petugas, tetapi kontak warga disembunyikan dan tidak bisa mengubah data.
 */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'demo');
  if (limited) return limited;
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) return apiError('demo_unavailable', 'The demo account is not configured.', 503);
  const sb = await getSessionSupabase();
  if (!sb) return apiError('db_unavailable', 'Database is not configured.', 503);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return apiError('demo_unavailable', 'The demo account is not available right now.', 503);
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
}
