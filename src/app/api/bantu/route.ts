import { z } from 'zod';
import { type AidTotalsRow, type Campaign, needsFor, type PublicPledge } from '@/lib/aid';
import { getNationalHotspots } from '@/lib/data/national';
import { clusterIncidents, incidentPriority } from '@/lib/pantau';
import { apiError } from '@/lib/schemas';
import { rateLimit } from '@/lib/ratelimit';
import { getSessionSupabase, getSupabase, getViewer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const Pledge = z.object({
  campaign: z.string().min(2).max(80),
  aidType: z.enum(['masks', 'water', 'food', 'medical', 'equipment', 'shelter']),
  quantity: z.number().int().min(1).max(100000),
  dropoff: z.enum(['posko', 'pickup', 'courier']),
  name: z.string().max(80).optional(),
  contact: z.string().max(120).optional(),
});

/** Posko provinsi dengan titik panas aktif 72 jam terakhir, kebutuhan perkiraan, dan total komitmen. */
export async function GET() {
  const data = await getNationalHotspots();
  const now = Date.now();
  const items = data.items.filter((h) => !h.persistent);
  const { incidents } = clusterIncidents(items);
  const byProv = new Map<string, { hotspots: number; incidents: number; top: number; lat: number; lon: number }>();
  for (const h of items) {
    const v = byProv.get(h.province) ?? { hotspots: 0, incidents: 0, top: 0, lat: h.lat, lon: h.lon };
    v.hotspots++;
    byProv.set(h.province, v);
  }
  for (const i of incidents) {
    const v = byProv.get(i.province);
    if (!v) continue;
    v.incidents++;
    const p = incidentPriority(i, now);
    if (p > v.top) {
      v.top = p;
      v.lat = i.lat;
      v.lon = i.lon;
    }
  }
  const campaigns: Campaign[] = [...byProv.entries()]
    .filter(([, v]) => v.hotspots >= 5)
    .sort((a, b) => b[1].top - a[1].top || b[1].hotspots - a[1].hotspots)
    .slice(0, 12)
    .map(([province, v]) => ({
      key: `prov:${province}`,
      province,
      hotspots: v.hotspots,
      incidents: v.incidents,
      topPriority: v.top,
      lat: v.lat,
      lon: v.lon,
      needs: needsFor(v.hotspots),
    }));

  let totals: AidTotalsRow[] = [];
  let recent: PublicPledge[] = [];
  let tracking = false;
  const sb = getSupabase();
  if (sb) {
    const [{ data: rows }, list] = await Promise.all([sb.rpc('aid_totals'), sb.rpc('list_pledges', { p_limit: 24 })]);
    totals = ((rows as AidTotalsRow[] | null) ?? []).map((r) => ({
      ...r,
      quantity: Number(r.quantity),
      delivered: Number(r.delivered ?? 0),
      donors: Number(r.donors),
    }));
    // list_pledges ada sejak migrasi 0005 (status penyaluran)
    if (!list.error) {
      tracking = true;
      recent = ((list.data as PublicPledge[] | null) ?? []).map((r) => ({ ...r, quantity: Number(r.quantity) }));
    }
  }
  return Response.json(
    { source: data.source, fetchedAt: data.fetchedAt, campaigns, totals, recent, tracking, storage: sb ? 'supabase' : 'none' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Simpan komitmen bantuan (tanpa pembayaran). */
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'bantu');
  if (limited) return limited;
  const { user, role } = await getViewer();
  if (!user) return apiError('auth_required', 'Please sign in to pledge aid.', 401);
  if (role === 'petugas' || role === 'demo' || role === 'demo_admin') {
    return apiError('citizen_only', 'Verifier accounts can review aid but cannot create pledges.', 403);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('bad_request', 'Invalid JSON body.', 400);
  }
  const parsed = Pledge.safeParse(body);
  if (!parsed.success) return apiError('bad_request', 'Invalid pledge.', 400);
  // Klien bersesi: janji bantuan dari pengguna yang masuk muncul di halaman Akun (user_id = auth.uid()).
  const sb = await getSessionSupabase();
  if (!sb) return apiError('db_unavailable', 'Database is not configured.', 503);
  const p = parsed.data;
  const args = {
    p_campaign_key: p.campaign,
    p_aid_type: p.aidType,
    p_quantity: p.quantity,
    p_dropoff: p.dropoff,
    p_donor_name: p.name ?? null,
    p_contact: p.contact ?? null,
  };
  // v2 mengembalikan kode lacak; bila basis data belum dimigrasi ke 0005, pakai fungsi lama.
  const v2 = await sb.rpc('submit_pledge_v2', args);
  if (!v2.error) {
    const row = (v2.data as { id: string; code: string }[] | null)?.[0];
    return Response.json({ id: row?.id ?? null, code: row?.code ?? null });
  }
  const { data, error } = await sb.rpc('submit_pledge', args);
  if (error) return apiError('db_error', 'Could not save the pledge.', 500);
  return Response.json({ id: data as string, code: null });
}
