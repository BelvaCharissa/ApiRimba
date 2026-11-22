import { km } from '@/lib/bantuan';
import { getNationalHotspots, provinceOf } from '@/lib/data/national';
import { readExif } from '@/lib/exif';
import { apiError } from '@/lib/schemas';
import { getSupabase } from '@/lib/supabase/server';
import { checkFirePhoto, isClearlyNotFire } from '@/lib/vision';
import { createHash } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;
const BUCKET = 'report-photos';
const MAX_AGE_H = 48;

interface ReportRow {
  id: string;
  created_at: string;
  lat: number;
  lon: number;
  category: 'fire' | 'smoke' | 'burnt';
  description: string;
  photo_path: string;
  status: 'matched' | 'pending' | 'verified';
  satellite_km: number | string | null;
  exif_km: number | string | null;
  reporter: string | null;
  ai_label?: string | null;
  ai_confidence?: number | string | null;
  photo_source?: string | null;
  place?: string | null;
  photo_taken_at?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
}

const num = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));

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
  const reports = ((data as ReportRow[] | null) ?? []).map(({ photo_path, ...r }) => ({
    ...r,
    satellite_km: num(r.satellite_km),
    exif_km: num(r.exif_km),
    ai_label: r.ai_label ?? null,
    ai_confidence: num(r.ai_confidence),
    photo_source: r.photo_source ?? null,
    place: r.place ?? null,
    photo_taken_at: r.photo_taken_at ?? null,
    reviewed_at: r.reviewed_at ?? null,
    review_note: r.review_note ?? null,
    photo_url: base + photo_path,
  }));
  return Response.json({ reports, storage: 'supabase' }, { headers: { 'Cache-Control': 'no-store' } });
}

const finite = (v: FormDataEntryValue | null) => {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** "2026-11-22T15:47:00" (waktu lokal kamera, dianggap WIB) atau ISO lengkap -> ms. */
function parseTime(s: string | null): number | null {
  if (!s) return null;
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}+07:00`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Laporan baru dengan foto wajib. Pemeriksaan otomatis:
 * 1) file benar-benar gambar (byte awal), maks 8 MB;
 * 2) lokasi harus di daratan Indonesia;
 * 3) AI memeriksa apakah foto memperlihatkan api, asap, atau bekas terbakar (foto yang jelas
 *    bukan kebakaran ditolak dan tidak disimpan);
 * 4) GPS dan waktu foto asli (EXIF, dibaca di perangkat sebelum diberi watermark) dibandingkan
 *    dengan lokasi laporan; foto lebih tua dari 48 jam tidak bisa "cocok";
 * 5) jarak ke titik panas satelit NASA FIRMS terdekat dalam 48 jam terakhir.
 * "matched" bila (3) melihat tanda api DAN (4) atau (5) <= 5 km; selain itu menunggu petugas.
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
  const source = form.get('source') === 'camera' ? 'camera' : 'gallery';
  const photo = form.get('photo');

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return apiError('bad_location', 'Pick the fire location on the map.', 400);
  const place = provinceOf(lon, lat);
  if (!place) return apiError('outside_indonesia', 'The location must be on land in Indonesia.', 400);
  if (!['fire', 'smoke', 'burnt'].includes(category)) return apiError('bad_category', 'Unknown report type.', 400);
  if (description.length < 10 || description.length > 1000) return apiError('bad_description', 'Description must be 10-1000 characters.', 400);
  if (!(photo instanceof File) || photo.size === 0) return apiError('photo_required', 'A photo is required.', 400);
  if (photo.size > MAX_BYTES) return apiError('photo_too_large', 'The photo must be 8 MB or smaller.', 400);

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const photoSha256 = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
  const kind = sniff(bytes);
  if (!kind) return apiError('photo_type', 'The photo must be a JPEG, PNG or WebP image.', 400);

  // EXIF foto asli: dibaca di perangkat sebelum watermark (watermark menghapus EXIF); bila tidak ada, coba dari file.
  const fileExif = kind.mime === 'image/jpeg' ? readExif(bytes) : { lat: null, lon: null, takenAt: null };
  const exifLat = finite(form.get('exifLat')) ?? fileExif.lat;
  const exifLon = finite(form.get('exifLon')) ?? fileExif.lon;
  const exifKm = exifLat !== null && exifLon !== null ? Math.round(km(lat, lon, exifLat, exifLon) * 100) / 100 : null;
  // Waktu ambil: kamera langsung = saat dipotret di aplikasi; galeri = waktu EXIF bila ada.
  const takenRaw = source === 'camera' ? String(form.get('capturedAt') ?? '') : String(form.get('exifTakenAt') ?? '') || fileExif.takenAt;
  let takenMs = parseTime(takenRaw || null);
  if (takenMs !== null && takenMs > Date.now() + 10 * 60_000) takenMs = null; // jam perangkat salah
  const ageH = takenMs === null ? null : (Date.now() - takenMs) / 3600_000;
  const tooOld = ageH !== null && ageH > MAX_AGE_H;

  // AI: apakah foto memperlihatkan api / asap / bekas terbakar
  const ai = await checkFirePhoto(bytes, kind.mime);
  if (isClearlyNotFire(ai)) {
    return Response.json(
      {
        error: {
          code: 'not_fire',
          message: `The photo does not appear to show fire, smoke or burnt land. ${ai?.reason ?? ''}`.trim(),
        },
        ai,
      },
      { status: 422 },
    );
  }

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

  const takenIso = takenMs === null ? null : new Date(takenMs).toISOString();
  const base = {
    p_lat: lat,
    p_lon: lon,
    p_category: category,
    p_description: description,
    p_photo_path: path,
    p_photo_taken_at: takenIso,
    p_exif_km: exifKm,
    p_satellite_km: satelliteKm,
    p_reporter_name: name || null,
    p_contact: contact || null,
  };
  let id: string | null = null;
  let status: 'matched' | 'pending' = 'pending';
  const v2 = await sb.rpc('submit_report', {
    ...base,
    p_ai_label: ai?.label ?? null,
    p_ai_confidence: ai?.confidence ?? null,
    p_ai_reason: ai?.reason ?? null,
    p_photo_source: source,
    p_place: place,
    p_photo_sha256: photoSha256,
  });
  if (!v2.error) {
    const row = (v2.data as { id: string; status: 'matched' | 'pending' }[] | null)?.[0];
    id = row?.id ?? null;
    status = row?.status ?? 'pending';
  } else {
    if (v2.error.message?.includes('duplicate_report')) {
      await sb.storage.from(BUCKET).remove([path]);
      return apiError('duplicate_report', 'This same photo was reported near this location recently.', 409);
    }
    // basis data belum dimigrasi ke 0005: pakai fungsi lama (tanpa kolom AI)
    const v1 = await sb.rpc('submit_report', base);
    if (v1.error) return apiError('db_error', 'Could not save the report.', 500);
    id = v1.data as string;
    const aiOk = !ai || ['fire', 'smoke', 'burnt'].includes(ai.label);
    status = aiOk && !tooOld && ((satelliteKm !== null && satelliteKm <= 5) || (exifKm !== null && exifKm <= 5)) ? 'matched' : 'pending';
  }
  return Response.json({
    id,
    status,
    satelliteKm,
    exifKm,
    hasExifGps: exifLat !== null,
    takenAt: takenIso,
    tooOld,
    source,
    place,
    ai,
  });
}
