import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/schemas';
import { getSupabase } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiError('not_found', 'Laporan tidak ditemukan.', 404);
  const sb = getSupabase();
  if (!sb) return apiError('internal', 'Database belum dikonfigurasi.', 500);
  const { data, error } = await sb.rpc('get_simulation', { p_id: id });
  if (error) return apiError('internal', 'Gagal membaca simulasi.', 500);
  if (!data) return apiError('not_found', 'Laporan tidak ditemukan.', 404);
  return Response.json(data, { headers: { 'Cache-Control': 'public, s-maxage=300' } });
}
