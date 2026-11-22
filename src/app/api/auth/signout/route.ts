import { getSessionSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Keluar: mencabut sesi di server Auth dan menghapus cookie sesi. */
export async function POST() {
  const sb = await getSessionSupabase();
  if (sb) await sb.auth.signOut();
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
}
