import { getSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Cek kesehatan + menjaga project Supabase gratis tetap aktif (project free dijeda setelah
 * 7 hari tanpa aktivitas). Dipanggil harian oleh Vercel Cron (vercel.json).
 */
export async function GET() {
  const sb = getSupabase();
  if (!sb) return Response.json({ ok: false, db: 'not_configured' }, { status: 503 });
  const { error } = await sb.from('scenarios').select('id').limit(1);
  return Response.json(
    { ok: !error, db: error ? 'error' : 'ok', at: new Date().toISOString() },
    { status: error ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
