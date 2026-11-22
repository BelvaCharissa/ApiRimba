import { cookies } from 'next/headers';
import { z } from 'zod';
import { apiError } from '@/lib/schemas';
import { getSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Dasbor petugas posko. PIN petugas diperiksa oleh basis data (hash bcrypt di app_secrets,
 * migrasi 0005); setelah masuk, PIN disimpan di cookie httpOnly selama 8 jam.
 */
const COOKIE = 'officer';
const BUCKET = 'report-photos';

const Login = z.object({ action: z.literal('login'), pin: z.string().min(6).max(64) });
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
const Body = z.discriminatedUnion('action', [Login, Review, Pledge, z.object({ action: z.literal('logout') })]);

async function pinFromCookie() {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

function denied() {
  return apiError('officer_denied', 'Officer sign-in required.', 401);
}

/** Data dasbor: semua laporan (dengan kontak) dan semua komitmen bantuan. */
export async function GET() {
  const sb = getSupabase();
  if (!sb) return apiError('db_unavailable', 'Database is not configured.', 503);
  const pin = await pinFromCookie();
  if (!pin) return denied();
  const [reports, pledges] = await Promise.all([
    sb.rpc('officer_list_reports', { p_pin: pin, p_limit: 150 }),
    sb.rpc('officer_list_pledges', { p_pin: pin, p_limit: 300 }),
  ]);
  if (reports.error || pledges.error) {
    const msg = `${reports.error?.message ?? ''} ${pledges.error?.message ?? ''}`;
    if (/officer_denied/.test(msg)) return denied();
    return apiError('not_migrated', 'Run supabase/migrations/0005_review_tracking.sql first.', 503);
  }
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  return Response.json(
    {
      reports: ((reports.data as ({ photo_path: string } & Record<string, unknown>)[] | null) ?? []).map((r) => ({ ...r, photo_url: base + r.photo_path })),
      pledges: pledges.data ?? [],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError('bad_request', 'Invalid JSON body.', 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return apiError('bad_request', 'Invalid request.', 400);
  const body = parsed.data;
  const jar = await cookies();
  if (body.action === 'logout') {
    jar.delete(COOKIE);
    return Response.json({ ok: true });
  }
  const sb = getSupabase();
  if (!sb) return apiError('db_unavailable', 'Database is not configured.', 503);

  if (body.action === 'login') {
    const { error } = await sb.rpc('officer_list_reports', { p_pin: body.pin, p_limit: 1 });
    if (error) {
      if (/officer_denied/.test(error.message)) return apiError('officer_denied', 'Wrong PIN.', 401);
      return apiError('not_migrated', 'Run supabase/migrations/0005_review_tracking.sql first.', 503);
    }
    jar.set(COOKIE, body.pin, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/petugas', maxAge: 8 * 3600 });
    return Response.json({ ok: true });
  }

  const pin = jar.get(COOKIE)?.value;
  if (!pin) return denied();
  const { error } =
    body.action === 'review'
      ? await sb.rpc('officer_review_report', { p_pin: pin, p_id: body.id, p_status: body.status, p_note: body.note ?? null })
      : await sb.rpc('officer_set_pledge', { p_pin: pin, p_id: body.id, p_status: body.status, p_note: body.note ?? null });
  if (error) return /officer_denied/.test(error.message) ? denied() : apiError('db_error', 'Could not save.', 500);
  return Response.json({ ok: true });
}
