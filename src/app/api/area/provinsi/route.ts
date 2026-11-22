import { provinceOf } from '@/lib/data/national';

/** Provinsi untuk satu titik; null bila di luar daratan Indonesia (laut atau negara tetangga). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get('lat'));
  const lon = Number(q.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return Response.json({ province: null });
  return Response.json({ province: provinceOf(lon, lat) }, { headers: { 'Cache-Control': 'public, max-age=86400' } });
}
