import type { PledgeTrack } from '@/lib/aid';
import { apiError } from '@/lib/schemas';
import { getSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Lacak satu komitmen bantuan dengan kodenya (mis. AR-7K2Q9A): status dan riwayat penyaluran. */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('kode')?.trim().toUpperCase() ?? '';
  if (!/^AR-[0-9A-F]{6}$/.test(code)) return apiError('bad_code', 'Tracking codes look like AR-1A2B3C.', 400);
  const sb = getSupabase();
  if (!sb) return apiError('db_unavailable', 'Database is not configured.', 503);
  const { data, error } = await sb.rpc('track_pledge', { p_code: code });
  if (error) return apiError('tracking_unavailable', 'Tracking is not available yet.', 503);
  const row = (data as PledgeTrack[] | null)?.[0];
  if (!row) return apiError('not_found', 'No pledge with that code.', 404);
  return Response.json({ ...row, quantity: Number(row.quantity) }, { headers: { 'Cache-Control': 'no-store' } });
}
