import { z } from 'zod';
import { type AidTotalsRow, type Campaign, needsFor } from '@/lib/aid';
import { getNationalHotspots } from '@/lib/data/national';
import { clusterIncidents, incidentPriority } from '@/lib/pantau';
import { apiError } from '@/lib/schemas';
import { getSupabase } from '@/lib/supabase/server';

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
  const sb = getSupabase();
  if (sb) {
    const { data: rows } = await sb.rpc('aid_totals');
    totals = ((rows as AidTotalsRow[] | null) ?? []).map((r) => ({ ...r, quantity: Number(r.quantity), donors: Number(r.donors) }));
  }
  return Response.json(
    { source: data.source, fetchedAt: data.fetchedAt, campaigns, totals, storage: sb ? 'supabase' : 'none' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Simpan komitmen bantuan (tanpa pembayaran). */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('bad_request', 'Invalid JSON body.', 400);
  }
  const parsed = Pledge.safeParse(body);
  if (!parsed.success) return apiError('bad_request', 'Invalid pledge.', 400);
  const sb = getSupabase();
  if (!sb) return apiError('db_unavailable', 'Database is not configured.', 503);
  const p = parsed.data;
  const { data, error } = await sb.rpc('submit_pledge', {
    p_campaign_key: p.campaign,
    p_aid_type: p.aidType,
    p_quantity: p.quantity,
    p_dropoff: p.dropoff,
    p_donor_name: p.name ?? null,
    p_contact: p.contact ?? null,
  });
  if (error) return apiError('db_error', 'Could not save the pledge.', 500);
  return Response.json({ id: data as string });
}
