import { apiError, SimulationSave } from '@/lib/schemas';
import { getSupabase } from '@/lib/supabase/server';

const MAX_BODY = 200_000;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) return apiError('bad_request', 'Ukuran data terlalu besar.', 400);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return apiError('bad_request', 'Body bukan JSON yang valid.', 400);
  }
  const parsed = SimulationSave.safeParse(body);
  if (!parsed.success) return apiError('bad_request', parsed.error.issues[0]?.message ?? 'Data tidak valid.', 400);
  const sb = getSupabase();
  if (!sb) return apiError('internal', 'Database belum dikonfigurasi.', 500);
  const { data, error } = await sb.rpc('save_simulation', { p: parsed.data });
  if (error) return apiError('internal', 'Gagal menyimpan simulasi.', 500);
  return Response.json({ id: data as string }, { status: 201 });
}
