import type { NextRequest } from 'next/server';
import { fetchWithTimeout } from '@/lib/data/fallback';
import { apiError } from '@/lib/schemas';

const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

interface OsmEl {
  lat?: number;
  lon?: number;
  tags?: { name?: string; population?: string; place?: string };
}

/** Desa/dusun di sekitar area dari OpenStreetMap (Overpass). Kosong bila server penuh. */
export async function GET(req: NextRequest) {
  const bbox = (req.nextUrl.searchParams.get('bbox') ?? '').split(',').map(Number);
  if (bbox.length !== 4 || bbox.some((v) => !Number.isFinite(v))) return apiError('bad_request', 'Parameter bbox tidak valid.', 400);
  const [w, s, e, n] = bbox;
  if (e - w > 0.6 || n - s > 0.6) return apiError('bad_request', 'Area terlalu besar.', 400);
  const q = `[out:json][timeout:12];node["place"~"^(village|hamlet|town|suburb|neighbourhood)$"]["name"](${s},${w},${n},${e});out;`;
  for (const m of MIRRORS) {
    try {
      const res = await fetchWithTimeout(
        m,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ApiRimbaAI/1.0 (simulasi karhutla)' },
          body: `data=${encodeURIComponent(q)}`,
          next: { revalidate: 604800 },
        },
        9000,
      );
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OsmEl[] };
      const villages = (json.elements ?? [])
        .filter((el) => el.lat !== undefined && el.lon !== undefined && el.tags?.name)
        .map((el) => ({
          name: el.tags!.name!,
          lat: el.lat!,
          lon: el.lon!,
          place: el.tags!.place ?? 'village',
          population: Number(el.tags!.population) || null,
        }));
      return Response.json({ source: 'osm', villages }, { headers: { 'Cache-Control': 'public, s-maxage=604800' } });
    } catch {
      // coba server berikutnya
    }
  }
  return Response.json({ source: 'none', villages: [] }, { headers: { 'Cache-Control': 'public, s-maxage=600' } });
}
