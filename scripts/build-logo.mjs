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

/**
 * Logo utuh tanpa dipotong, latar putih dihapus, untuk latar gelap.
 * Putih di dalam pin (api) dipertahankan. Di bawahnya ada garis tepi putih ala stiker
 * agar tulisan hijau tua tetap terbaca di latar hutan gelap.
 */
async function transparentFull(outline) {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const flame = { x0: 700, x1: 830, y0: 250, y1: 450 };
  for (let i = 0; i < w * info.height; i++) {
    const x = i % w;
    const y = (i - x) / w;
    if (x >= flame.x0 && x <= flame.x1 && y >= flame.y0 && y <= flame.y1) continue;
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const min = Math.min(r, g, b);
    const sat = Math.max(r, g, b) - min;
    // putih / abu sangat terang tanpa warna = latar; transisi halus agar tepi tidak bergerigi
    if (sat < 40 && min > 205) data[i * 4 + 3] = min >= 232 ? 0 : Math.round((255 * (232 - min)) / 27);
  }
  const art = await sharp(data, { raw: { width: w, height: info.height, channels: 4 } }).png().toBuffer();
  if (!outline) return art;
  const pad = 24;
  const W = w + pad * 2;
  const H = info.height + pad * 2;
  // topeng alfa dengan tepi kosong selebar pad, lalu dilebarkan (blur + ambang) menjadi garis tepi
  const mask = Buffer.alloc(W * H);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < w; x++) mask[(y + pad) * W + x + pad] = data[(y * w + x) * 4 + 3];
  const grown = await sharp(mask, { raw: { width: W, height: H, channels: 1 } }).blur(8).extractChannel(0).raw().toBuffer();
  const rgba = Buffer.alloc(W * H * 4, 255);
  // ambang lunak agar tepi garis halus
  for (let i = 0; i < W * H; i++) rgba[i * 4 + 3] = Math.max(0, Math.min(255, (grown[i] - 18) * 6));
  const white = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  // sharp mengubah ukuran sebelum menempel lapisan, jadi hasil tempelan dijadikan buffer dulu
  return sharp(white).composite([{ input: art, left: pad, top: pad }]).png().toBuffer();
}
await sharp(await transparentFull(true)).resize(900).png({ compressionLevel: 9 }).toFile('public/brand/logo-sticker.png');
await sharp(await transparentFull(false)).resize(900).png({ compressionLevel: 9 }).toFile('public/brand/logo-transparent.png');

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
