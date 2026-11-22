import { getViewer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Siapa yang sedang masuk (untuk header dan halaman klien). Tidak membocorkan apa pun bila belum masuk. */
export async function GET() {
  const { user, role } = await getViewer();
  const name = user ? (typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null) : null;
  return Response.json(
    { user: user ? { email: user.email ?? null, name } : null, role },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
