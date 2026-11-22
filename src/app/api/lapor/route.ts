import { km } from '@/lib/bantuan';
import { getNationalHotspots } from '@/lib/data/national';
import { readExif } from '@/lib/exif';
import { apiError } from '@/lib/schemas';
import { getSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024;
const BUCKET = 'report-photos';

interface PublicReport {
  id: string;
  created_at: string;
  lat: number;
  lon: number;
  category: 'fire' | 'smoke' | 'burnt';
  description: string;
  photo_url: string;
  status: 'matched' | 'pending' | 'verified';
  satellite_km: number | null;
  exif_km: number | null;
  reporter: string | null;
}

/** Jenis gambar dari byte awal (bukan dari nama file atau header yang dikirim klien). */
function sniff(b: Uint8Array): { mime: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/** Laporan terbaru (publik: tanpa kontak, nama pelapor inisial). */
export async function GET() {
  const sb = getSupabase();
  if (!sb) return Response.json({ reports: [], storage: 'none' });
  const { data, error } = await sb.rpc('list_reports', { p_limit: 60 });
  if (error) return Response.json({ reports: [], storage: 'error' });
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  const reports: PublicReport[] = ((data as (Omit<PublicReport, 'photo_url'> & { photo_path: string })[] | null) ?? []).map(
    ({ photo_path, ...r }) => ({
      ...r,
      satellite_km: r.satellite_km === null ? null : Number(r.satellite_km),
      exif_km: r.exif_km === null ? null : Number(r.exif_km),
      photo_url: base + photo_path,
    }),
  );
  return Response.json({ reports, storage: 'supabase' }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Laporan baru dengan foto wajib. Pemeriksaan otomatis:
 * 1) file benar-benar gambar (byte awal), maks 8 MB;
 * 2) GPS dan waktu dari EXIF foto (bila ada) dibandingkan dengan lokasi laporan;
 * 3) jarak ke titik panas satelit NASA FIRMS terdekat dalam 48 jam terakhir.
 * Status "matched" bila (2) atau (3) <= 5 km; selain itu "pending" menunggu petugas.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError('bad_request', 'Expected multipart form data.', 400);
  }
  const lat = Number(form.get('lat'));
  const lon = Number(form.get('lon'));
  const category = String(form.get('category') ?? '');
  const description = String(form.get('description') ?? '').trim();
  const name = String(form.get('name') ?? '').trim().slice(0, 80);
  const contact = String(form.get('contact') ?? '').trim().slice(0, 120);
  const photo = form.get('photo');

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 15 || lon < 90 || lon > 145) {
    return apiError('bad_location', 'The location must be inside Indonesia.', 400);
  }
  if (!['fire', 'smoke', 'burnt'].includes(category)) return apiError('bad_category', 'Unknown report type.', 400);
  if (description.length < 10 || description.length > 1000) return apiError('bad_description', 'Description must be 10-1000 characters.', 400);
  if (!(photo instanceof File) || photo.size === 0) return apiError('photo_required', 'A photo is required.', 400);
  if (photo.size > MAX_BYTES) return apiError('photo_too_large', 'The photo must be 8 MB or smaller.', 400);

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return apiError('photo_type', 'The photo must be a JPEG, PNG or WebP image.', 400);

  // EXIF: GPS dan waktu ambil foto
  const exif = kind.mime === 'image/jpeg' ? readExif(bytes) : { lat: null, lon: null, takenAt: null };
  const exifKm = exif.lat !== null && exif.lon !== null ? Math.round(km(lat, lon, exif.lat, exif.lon) * 100) / 100 : null;

  // titik panas satelit terdekat dalam 48 jam
  let satelliteKm: number | null = null;
  try {
    const hot = await getNationalHotspots();
    if (hot.source === 'nasa-firms') {
      const since = Date.now() - 48 * 3600_000;
      let best = Infinity;
      for (const h of hot.items) {
        if (Date.parse(h.acquiredAt) < since || Math.abs(h.lat - lat) > 0.5 || Math.abs(h.lon - lon) > 0.5) continue;
        best = Math.min(best, km(lat, lon, h.lat, h.lon));
      }
      if (Number.isFinite(best)) satelliteKm = Math.round(best * 100) / 100;
    }
  } catch {
    // tanpa pembanding satelit
  }

  const sb = getSupabase();
  if (!sb) return apiError('db_unavailable', 'Database is not configured.', 503);
  const path = `reports/${crypto.randomUUID()}.${kind.ext}`;
  const up = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: kind.mime, upsert: false });
  if (up.error) return apiError('upload_failed', 'Could not upload the photo.', 502);

  const { data, error } = await sb.rpc('submit_report', {
    p_lat: lat,
    p_lon: lon,
    p_category: category,
    p_description: description,
    p_photo_path: path,
    p_photo_taken_at: exif.takenAt ? `${exif.takenAt}+07:00` : null,
    p_exif_km: exifKm,
    p_satellite_km: satelliteKm,
    p_reporter_name: name || null,
    p_contact: contact || null,
  });
  if (error) return apiError('db_error', 'Could not save the report.', 500);
  const matched = (satelliteKm !== null && satelliteKm <= 5) || (exifKm !== null && exifKm <= 5);
  return Response.json({
    id: data as string,
    status: matched ? 'matched' : 'pending',
    satelliteKm,
    exifKm,
    exifTakenAt: exif.takenAt,
    hasExifGps: exif.lat !== null,
  });
}
