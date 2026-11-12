import type { GridSpec } from './types';

export function cellIndex(grid: GridSpec, x: number, y: number): number {
  return y * grid.w + x;
}

export function cellXY(grid: GridSpec, i: number): [number, number] {
  const x = i % grid.w;
  return [x, (i - x) / grid.w];
}

/** Koordinat pusat sel [lon, lat]. */
export function cellCenter(grid: GridSpec, i: number): [number, number] {
  const [x, y] = cellXY(grid, i);
  return gridToLonLat(grid, x + 0.5, y + 0.5);
}

/** Koordinat grid (boleh pecahan) ke [lon, lat]. */
export function gridToLonLat(grid: GridSpec, x: number, y: number): [number, number] {
  return [grid.originLon + x * grid.cellDegLon, grid.originLat - y * grid.cellDegLat];
}

export function lonLatToCell(grid: GridSpec, lon: number, lat: number): number {
  const x = Math.floor((lon - grid.originLon) / grid.cellDegLon);
  const y = Math.floor((grid.originLat - lat) / grid.cellDegLat);
  if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) return -1;
  return cellIndex(grid, x, y);
}

/** Sel di sepanjang garis (algoritma Bresenham), dengan ketebalan `width` sel. */
export function rasterLine(
  grid: GridSpec,
  a: [number, number],
  b: [number, number],
  width = 2,
): number[] {
  // Sampel rapat di sepanjang garis; tiap sampel mengisi blok width x width sel
  // sehingga tidak ada celah diagonal yang bisa dilewati api.
  const out = new Set<number>();
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(len * 4));
  const off = Math.floor(width / 2);
  for (let s = 0; s <= n; s++) {
    const fx = a[0] + ((b[0] - a[0]) * s) / n;
    const fy = a[1] + ((b[1] - a[1]) * s) / n;
    const cx = Math.floor(fx) - off;
    const cy = Math.floor(fy) - off;
    for (let oy = 0; oy < width; oy++) {
      for (let ox = 0; ox < width; ox++) {
        const px = cx + ox;
        const py = cy + oy;
        if (px >= 0 && py >= 0 && px < grid.w && py < grid.h) out.add(cellIndex(grid, px, py));
      }
    }
  }
  return [...out];
}

/** Base64 dari Int16Array (untuk disimpan sebagai arrival_b64). */
export function int16ToBase64(arr: Int16Array): string {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function base64ToInt16(b64: string): Int16Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}
