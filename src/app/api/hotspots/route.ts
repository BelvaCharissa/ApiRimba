import type { NextRequest } from 'next/server';
import { getHotspots } from '@/lib/data/firms';
import { apiError, ScenarioSlug } from '@/lib/schemas';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const slug = ScenarioSlug.safeParse(sp.get('scenario'));
  const days = Number(sp.get('days') ?? '1');
  if (!slug.success) return apiError('bad_request', 'Parameter scenario tidak valid.', 400);
  if (!Number.isInteger(days) || days < 1 || days > 3) return apiError('bad_request', 'Parameter days harus 1-3.', 400);
  const data = await getHotspots(slug.data, days);
  return Response.json(data, { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=600' } });
}
