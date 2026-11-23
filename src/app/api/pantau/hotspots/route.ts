import { getNationalHotspots } from '@/lib/data/national';

/** Titik panas se-Indonesia 72 jam terakhir (NASA FIRMS), cache 30 menit. */
export async function GET() {
  const data = await getNationalHotspots();
  return Response.json(data, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } });
}
