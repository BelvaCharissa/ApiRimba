import { z } from 'zod';
import { rateLimit } from '@/lib/ratelimit';
import { apiError } from '@/lib/schemas';
import { ADMIN_ROLES, getViewer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const SetRole = z.object({ id: z.uuid(), role: z.enum(['warga', 'petugas', 'admin']) });

/** Admin: daftar akun dan perannya. Basis data menolak bila pemanggil bukan admin. */
export async function GET(req: Request) {
  const limited = await rateLimit(req, 'staf');
  if (limited) return limited;
  const { sb, user, role } = await getViewer();
  if (!sb) return apiError('db_unavailable', 'Database is not configured.', 503);
  if (!user) return apiError('auth_required', 'Please sign in.', 401);
  if (!ADMIN_ROLES.includes(role)) return apiError('admin_only', 'Admins only.', 403);
  const { data, error } = await sb.rpc('admin_list_users', { p_limit: 300 });
  if (error) return apiError('db_error', 'Could not load accounts.', 500);
  return Response.json({ users: data ?? [], me: user.id }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/** Admin: ubah peran satu akun (tidak bisa mengubah diri sendiri atau akun demo). */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'staf');
  if (limited) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError('bad_request', 'Invalid JSON body.', 400);
  }
  const parsed = SetRole.safeParse(raw);
  if (!parsed.success) return apiError('bad_request', 'Invalid request.', 400);
  const { sb, user, role } = await getViewer();
  if (!sb) return apiError('db_unavailable', 'Database is not configured.', 503);
  if (!user) return apiError('auth_required', 'Please sign in.', 401);
  if (!ADMIN_ROLES.includes(role)) return apiError('admin_only', 'Admins only.', 403);
  const { error } = await sb.rpc('admin_set_role', { p_user: parsed.data.id, p_role: parsed.data.role });
  if (error) {
    const known = ['cannot_change_self', 'demo_locked', 'demo_limited', 'bad_role'].find((c) => error.message.includes(c));
    return apiError(known ?? 'db_error', known ? known.replace(/_/g, ' ') : 'Could not change the role.', known ? 400 : 500);
  }
  return Response.json({ ok: true });
}
