import { getNationalWeather } from '@/lib/data/national';

/** Angin (grid 3°) dan PM2.5 kota se-Indonesia (Open-Meteo), diperbarui 5 menit. */
export async function GET() {
  const data = await getNationalWeather();
  return Response.json(data, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } });
}
