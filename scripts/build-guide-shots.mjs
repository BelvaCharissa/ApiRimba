/**
 * Potong screenshot asli ApiRimba menjadi gambar 4:3 untuk beranda, cara kerja, dan panduan.
 * Screenshot diambil dari aplikasi yang berjalan (Chrome headless, viewport 1280 px, skala 1,5).
 * Jalankan: node scripts/build-guide-shots.mjs <folder-screenshot>
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC = process.argv[2];
if (!SRC) throw new Error('usage: node scripts/build-guide-shots.mjs <folder>');
const OUT = 'public/img/guide';
await mkdir(OUT, { recursive: true });

// nama keluaran: [berkas sumber, x, y, lebar] (tinggi = lebar x 3/4)
const CROPS = {
  satellite: ['peta.png', 640, 120, 1280],
  'map-click': ['detail.png', 700, 100, 1220],
  wind: ['riau-full.png', 20, 100, 1200],
  timeline: ['riau-map-6.png', 0, 120, 1480],
  villages: ['riau-map-12.png', 370, 190, 1200],
  'wind-turn': ['riau-map-12.png', 560, 300, 960],
  peat: ['riau-map-3.png', 480, 330, 960],
  firebreak: ['riau-sekat-map.png', 380, 240, 1200],
  compare: ['riau-sekat.png', 560, 110, 1360],
  briefing: ['report.png', 285, 120, 1350],
  camera: ['lapor-form.png', 100, 120, 900],
  pin: ['lapor-location.png', 110, 160, 880],
  check: ['lapor-stamped.png', 100, 60, 900],
  officer: ['lapor-top-ready.png', 100, 90, 900],
  aid: ['bantu-dialog.png', 540, 90, 840],
  truck: ['bantu-dialog.png', 540, 600, 840],
  track: ['bantu-posko.png', 60, 150, 900],
};

for (const [name, [file, x, y, w]] of Object.entries(CROPS)) {
  const img = sharp(join(SRC, file));
  const meta = await img.metadata();
  const h = Math.round((w * 3) / 4);
  const left = Math.max(0, Math.min(x, meta.width - w));
  const top = Math.max(0, Math.min(y, meta.height - h));
  await img
    .extract({ left, top, width: Math.min(w, meta.width), height: Math.min(h, meta.height) })
    .resize(960, 720, { fit: 'cover' })
    .webp({ quality: 80 })
    .toFile(join(OUT, `${name}.webp`));
  console.log(name);
}
