/**
 * Menyusun foto satelit untuk latar beranda dari ubin Esri World Imagery.
 * Wilayah: area skenario Riau, diperlebar ke rasio 16:9 dengan area skenario tepat di tengah.
 * Keluaran: public/img/hero-riau.jpg dan public/img/hero-riau.json (posisi area skenario di foto).
 *
 * Jalankan: node scripts/build-hero.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const Z = 14;
const TILE = 256;
const OUT_W = 2400;

const scenario = JSON.parse(await readFile('public/data/scenarios/riau.json', 'utf8'));
const [minLon, minLat, maxLon, maxLat] = scenario.bbox;

const lonToX = (lon) => ((lon + 180) / 360) * TILE * 2 ** Z;
const latToY = (lat) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** Z;
};

// area skenario dalam piksel dunia
const sx0 = lonToX(minLon);
const sx1 = lonToX(maxLon);
const sy0 = latToY(maxLat);
const sy1 = latToY(minLat);
const cx = (sx0 + sx1) / 2;
const cy = (sy0 + sy1) / 2;

// bingkai 16:9, dua kali lebar skenario
const fw = Math.round((sx1 - sx0) * 2);
const fh = Math.round((fw * 9) / 16);
const fx0 = Math.round(cx - fw / 2);
const fy0 = Math.round(cy - fh / 2);

const tx0 = Math.floor(fx0 / TILE);
const ty0 = Math.floor(fy0 / TILE);
const tx1 = Math.floor((fx0 + fw) / TILE);
const ty1 = Math.floor((fy0 + fh) / TILE);

const composites = [];
for (let ty = ty0; ty <= ty1; ty++) {
  for (let tx = tx0; tx <= tx1; tx++) {
    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${Z}/${ty}/${tx}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gagal mengambil ${url}: ${res.status}`);
    composites.push({ input: Buffer.from(await res.arrayBuffer()), left: (tx - tx0) * TILE, top: (ty - ty0) * TILE });
  }
}

const mosaic = await sharp({
  create: { width: (tx1 - tx0 + 1) * TILE, height: (ty1 - ty0 + 1) * TILE, channels: 3, background: '#0c2219' },
})
  .composite(composites)
  .png()
  .toBuffer();

const scale = OUT_W / fw;
const outH = Math.round(fh * scale);
await mkdir('public/img', { recursive: true });
await sharp(mosaic)
  .extract({ left: fx0 - tx0 * TILE, top: fy0 - ty0 * TILE, width: fw, height: fh })
  .resize(OUT_W, outH)
  .jpeg({ quality: 74, mozjpeg: true })
  .toFile('public/img/hero-riau.jpg');

const frame = {
  width: OUT_W,
  height: outH,
  // persegi panjang area skenario (grid simulasi) dalam piksel foto
  scenario: {
    x: Math.round((sx0 - fx0) * scale),
    y: Math.round((sy0 - fy0) * scale),
    w: Math.round((sx1 - sx0) * scale),
    h: Math.round((sy1 - sy0) * scale),
  },
  source: 'Esri World Imagery',
};
await writeFile('public/img/hero-riau.json', JSON.stringify(frame, null, 2) + '\n');
console.log(frame);
