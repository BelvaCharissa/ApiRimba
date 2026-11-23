import { z } from 'zod';
import { rateLimit } from '@/lib/ratelimit';
import { apiError } from '@/lib/schemas';
import { DEMO_ROLES, getViewer, STAFF_ROLES } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Dasbor petugas posko. Akses memakai akun Supabase Auth berperan 'petugas', 'admin', 'demo', atau
 * 'demo_admin'. Akun demo boleh memverifikasi, tetapi kontak warga disembunyikan basis data (migrasi 0009).
 * Peran diperiksa dua kali: di sini dan di dalam fungsi RPC staff_* (security definer).
 */
const BUCKET = 'report-photos';

const Review = z.object({
  action: z.literal('review'),
  id: z.uuid(),
  status: z.enum(['verified', 'rejected', 'pending']),
  note: z.string().max(300).optional(),
});
const Pledge = z.object({
  action: z.literal('pledge'),
  id: z.uuid(),
  status: z.enum(['pledged', 'confirmed', 'sent', 'received', 'distributed', 'cancelled']),
  note: z.string().max(300).optional(),
});
const Body = z.discriminatedUnion('action', [Review, Pledge]);

const signIn = () => apiError('auth_required', 'Please sign in.', 401);
const forbidden = () => apiError('officer_denied', 'This account is not an officer account.', 403);
const notMigrated = () => apiError('not_migrated', 'Run supabase/migrations/0007_auth_roles.sql first.', 503);

/** Data dasbor: semua laporan dan komitmen bantuan (kontak disembunyikan untuk akun demo). */
export async function GET(req: Request) {
  const limited = await rateLimit(req, 'staf');
  if (limited) return limited;
  const { sb, user, role } = await getViewer();
  if (!sb) return apiError('db_unavailable', 'Database is not configured.', 503);
  if (!user) return signIn();
  if (!STAFF_ROLES.includes(role)) return forbidden();
  const [reports, pledges] = await Promise.all([
    sb.rpc('staff_list_reports', { p_limit: 150 }),
    sb.rpc('staff_list_pledges', { p_limit: 300 }),
  ]);
  if (reports.error || pledges.error) {
    const msg = `${reports.error?.message ?? ''} ${pledges.error?.message ?? ''}`;
    return /officer_denied/.test(msg) ? forbidden() : notMigrated();
  }
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  return Response.json(
    {
      role,
      // Akun demo boleh bertindak, tetapi kontak warga disembunyikan oleh basis data.
      demo: DEMO_ROLES.includes(role),
      readOnly: false,
      reports: ((reports.data as ({ photo_path: string } & Record<string, unknown>)[] | null) ?? []).map(({ photo_path, ...r }) => ({
        ...r,
        photo_url: base + photo_path,
      })),
      pledges: pledges.data ?? [],
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(req: Request) {
  const limited = await rateLimit(req, 'staf');
  if (limited) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError('bad_request', 'Invalid JSON body.', 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return apiError('bad_request', 'Invalid request.', 400);
  const body = parsed.data;

  const { sb, user, role } = await getViewer();
  if (!sb) return apiError('db_unavailable', 'Database is not configured.', 503);
  if (!user) return signIn();
  if (!STAFF_ROLES.includes(role)) return forbidden();

  const { error } =
    body.action === 'review'
      ? await sb.rpc('staff_review_report', { p_id: body.id, p_status: body.status, p_note: body.note ?? null })
      : await sb.rpc('staff_set_pledge', { p_id: body.id, p_status: body.status, p_note: body.note ?? null });
  if (error) {
    if (/demo_readonly/.test(error.message)) return apiError('demo_readonly', 'The demo account can only view.', 403);
    if (/officer_denied/.test(error.message)) return forbidden();
    return apiError('db_error', 'Could not save.', 500);
  }
  return Response.json({ ok: true });
}
