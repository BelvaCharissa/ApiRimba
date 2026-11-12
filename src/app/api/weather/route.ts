import type { NextRequest } from 'next/server';
import { getWeather } from '@/lib/data/openmeteo';
import { apiError, ScenarioSlug } from '@/lib/schemas';

export async function GET(req: NextRequest) {
  const slug = ScenarioSlug.safeParse(req.nextUrl.searchParams.get('scenario'));
  if (!slug.success) return apiError('bad_request', 'Parameter scenario tidak valid.', 400);
  const data = await getWeather(slug.data);
  return Response.json(data, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } });
}
