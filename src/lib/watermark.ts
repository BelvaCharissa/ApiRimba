/**
 * Watermark foto laporan (di peramban): tanggal, jam, koordinat, provinsi, dan asal foto
 * dicetak permanen di bagian bawah gambar, ditambah logo ApiRimba. Hasil: JPEG maks 1600 px.
 */
import { t } from './i18n';

const WIT = ['Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Tengah', 'Papua Pegunungan', 'Papua Selatan'];
const WITA = [
  'Bali',
  'Nusa Tenggara Barat',
  'Nusa Tenggara Timur',
  'Kalimantan Selatan',
  'Kalimantan Timur',
  'Kalimantan Utara',
  'Sulawesi Utara',
  'Sulawesi Tengah',
  'Sulawesi Selatan',
  'Sulawesi Tenggara',
  'Sulawesi Barat',
  'Gorontalo',
];

/** Zona waktu Indonesia untuk provinsi (WIB / WITA / WIT). */
export function zoneOf(province: string | null): { label: 'WIB' | 'WITA' | 'WIT'; tz: string } {
  const p = (province ?? '').toLowerCase();
  if (WIT.some((x) => p === x.toLowerCase() || p.startsWith('papua'))) return { label: 'WIT', tz: 'Asia/Jayapura' };
  if (WITA.some((x) => p === x.toLowerCase()) || p.startsWith('sulawesi')) return { label: 'WITA', tz: 'Asia/Makassar' };
  return { label: 'WIB', tz: 'Asia/Jakarta' };
}

export function stampTime(d: Date, province: string | null): string {
  const z = zoneOf(province);
  const s = d.toLocaleString('id-ID', { timeZone: z.tz, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `${s} ${z.label}`;
}

export interface StampInfo {
  lat: number;
  lon: number;
  province: string | null;
  /** Waktu laporan dibuat (sekarang). */
  reportedAt: Date;
  /** Waktu foto diambil, bila diketahui. */
  takenAt: Date | null;
  source: 'camera' | 'gallery';
}

let logoPromise: Promise<HTMLImageElement | null> | null = null;
function loadLogo(): Promise<HTMLImageElement | null> {
  logoPromise ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/brand/logo-sticker.png';
  });
  return logoPromise;
}

async function toDrawable(src: Blob | HTMLCanvasElement): Promise<{ img: CanvasImageSource; w: number; h: number }> {
  if (src instanceof HTMLCanvasElement) return { img: src, w: src.width, h: src.height };
  // imageOrientation mengikuti EXIF agar foto ponsel tidak miring
  const bmp = await createImageBitmap(src, { imageOrientation: 'from-image' });
  return { img: bmp, w: bmp.width, h: bmp.height };
}

/** Cetak watermark ke foto. Mengembalikan JPEG dan URL pratinjau. */
export async function watermarkPhoto(src: Blob | HTMLCanvasElement, info: StampInfo): Promise<Blob> {
  const { img, w: w0, h: h0 } = await toDrawable(src);
  const scale = Math.min(1, 1600 / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);

  const u = Math.max(12, Math.round(Math.min(w, h) / 32)); // satuan ukuran huruf
  const lines = [
    stampTime(info.reportedAt, info.province),
    `${info.lat.toFixed(5)}, ${info.lon.toFixed(5)}${info.province ? ` · ${info.province}` : ''}`,
    info.source === 'camera'
      ? t('Live camera in ApiRimba', 'Kamera langsung ApiRimba')
      : info.takenAt
        ? t(`From gallery · taken ${stampTime(info.takenAt, info.province)}`, `Dari galeri · diambil ${stampTime(info.takenAt, info.province)}`)
        : t('From gallery · capture time unknown', 'Dari galeri · waktu ambil tidak diketahui'),
  ];
  const band = Math.round(u * 1.45 * lines.length + u * 1.4);
  const g = ctx.createLinearGradient(0, h - band * 1.5, 0, h);
  g.addColorStop(0, 'rgba(6,16,9,0)');
  g.addColorStop(0.35, 'rgba(6,16,9,0.72)');
  g.addColorStop(1, 'rgba(6,16,9,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h - band * 1.5, w, band * 1.5);

  const logo = await loadLogo();
  const logoH = Math.round(band * 0.92);
  const logoW = logo ? Math.round((logo.width / logo.height) * logoH) : 0;
  const pad = Math.round(u * 0.8);
  if (logo) ctx.drawImage(logo, w - logoW - pad, h - logoH - pad * 0.6, logoW, logoH);

  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = Math.round(u / 4);
  const maxText = w - logoW - pad * 3;
  lines.forEach((line, i) => {
    ctx.font = `${i === 0 ? 800 : 600} ${i === 0 ? Math.round(u * 1.15) : u}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.fillStyle = i === 0 ? '#ffd24a' : '#ffffff';
    ctx.fillText(line, pad, h - band + pad + u * 1.45 * (i + 0.75), maxText);
  });
  ctx.shadowBlur = 0;

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.86));
}
