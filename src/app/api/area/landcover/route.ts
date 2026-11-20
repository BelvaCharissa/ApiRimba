import type { NextRequest } from 'next/server';
import { fetchWithTimeout } from '@/lib/data/fallback';
import { apiError } from '@/lib/schemas';

/** Proksi citra tutupan lahan Sentinel-2 10 m (Esri Land Cover) untuk kotak area simulasi. */
export async function GET(req: NextRequest) {
  const bbox = (req.nextUrl.searchParams.get('bbox') ?? '').split(',').map(Number);
  if (bbox.length !== 4 || bbox.some((v) => !Number.isFinite(v))) return apiError('bad_request', 'Parameter bbox tidak valid.', 400);
  const [w, s, e, n] = bbox;
  if (e - w > 0.5 || n - s > 0.5 || w < 90 || e > 145 || s < -15 || n > 10) return apiError('bad_request', 'Area di luar jangkauan.', 400);
  const url = `https://ic.imagery1.arcgis.com/arcgis/rest/services/Sentinel2_10m_LandCover/ImageServer/exportImage?bbox=${bbox.join(',')}&bboxSR=4326&imageSR=4326&size=256,256&format=png&f=image`;
  try {
    const res = await fetchWithTimeout(url, { next: { revalidate: 2592000 } }, 15000);
    if (!res.ok || !res.headers.get('content-type')?.includes('image')) throw new Error(String(res.status));
    return new Response(await res.arrayBuffer(), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, s-maxage=2592000, max-age=86400' },
    });
  } catch {
    return apiError('upstream', 'Citra tutupan lahan tidak tersedia.', 502);
  }
}
