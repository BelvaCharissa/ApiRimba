/**
 * Mengolah Logo.png (latar putih) menjadi aset untuk tema gelap:
 *  - public/brand/logo-full.png       logo lengkap asli (latar putih), untuk laporan cetak
 *  - public/brand/logo-emblem.png     ilustrasi tanpa tulisan, latar transparan
 *  - public/brand/logo-mark.png       ikon persegi (pin api + peta), latar transparan
 *  - src/app/icon.png, src/app/apple-icon.png   favicon (ikon di atas petak hijau tua)
 *
 * Latar putih dihapus dengan flood fill dari tepi gambar, sehingga putih di dalam pin (api) tetap utuh.
 * Jalankan: node scripts/build-logo.mjs
 */
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const SRC = 'Logo.png';
await mkdir('public/brand', { recursive: true });

/** Hapus latar putih yang tersambung ke tepi; tepi dihaluskan agar tidak bergerigi. */
async function knockOut(input, { left, top, width, height }) {
  const { data, info } = await sharp(input).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const isWhite = (i) => data[i * 4] > 232 && data[i * 4 + 1] > 232 && data[i * 4 + 2] > 232;
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || !isWhite(i)) continue;
    seen[i] = 1;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  for (let i = 0; i < w * h; i++) {
    if (seen[i]) {
      data[i * 4 + 3] = 0;
      continue;
    }
    // piksel terang di samping latar: setengah transparan (anti-alias)
    const x = i % w;
    const nearBg = (x > 0 && seen[i - 1]) || (x < w - 1 && seen[i + 1]) || (i >= w && seen[i - w]) || (i + w < w * h && seen[i + w]);
    if (nearBg) {
      const lum = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
      if (lum > 190) data[i * 4 + 3] = Math.round(255 * (1 - (lum - 190) / 65));
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png();
}

// logo lengkap (untuk latar terang)
await sharp(SRC).resize(900).png({ compressionLevel: 9 }).toFile('public/brand/logo-full.png');

// emblem: pohon, peta, pin, satelit (tanpa tulisan)
await (await knockOut(SRC, { left: 100, top: 0, width: 1330, height: 720 }))
  .resize(800)
  .toFile('public/brand/logo-emblem.png');

// ikon persegi: pin api di atas peta
const mark = await knockOut(SRC, { left: 600, top: 225, width: 360, height: 400 });
const markBuf = await mark.toBuffer();
const markSquare = await sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: markBuf, left: 20, top: 0 }])
  .png()
  .toBuffer();
await sharp(markSquare).resize(256).png().toFile('public/brand/logo-mark.png');

// favicon: ikon di atas petak hijau tua membulat
const tile = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="112" fill="#0e2a1c"/></svg>',
);
const markForIcon = await sharp('public/brand/logo-mark.png').resize(440).toBuffer();
for (const [file, size] of [
  ['src/app/icon.png', 512],
  ['src/app/apple-icon.png', 180],
]) {
  // sharp mengubah ukuran sebelum menempel lapisan, jadi tempel dulu baru perkecil
  const full = await sharp(tile).composite([{ input: markForIcon, left: 36, top: 36 }]).png().toBuffer();
  await sharp(full).resize(size).png().toFile(file);
}
console.log('ok');
