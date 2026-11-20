import type { NextRequest } from 'next/server';
import { getWeather, getWeatherAt } from '@/lib/data/openmeteo';
import { apiError, ScenarioSlug } from '@/lib/schemas';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const headers = { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=600' };
  if (sp.has('lat') && sp.has('lon')) {
    const lat = Number(sp.get('lat'));
    const lon = Number(sp.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 15 || lon < 90 || lon > 145) {
      return apiError('bad_request', 'Koordinat tidak valid.', 400);
    }
    const data = await getWeatherAt(Math.round(lat * 100) / 100, Math.round(lon * 100) / 100);
    if (!data) return apiError('upstream', 'Cuaca langsung tidak tersedia.', 502);
    return Response.json(data, { headers });
  }
  const slug = ScenarioSlug.safeParse(sp.get('scenario'));
  if (!slug.success) return apiError('bad_request', 'Parameter scenario tidak valid.', 400);
  const data = await getWeather(slug.data);
  return Response.json(data, { headers });
}
