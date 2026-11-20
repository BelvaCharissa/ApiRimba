import type { LonLat } from './types';

/** Proyeksi lokal (km) di sekitar titik acuan: cukup akurat untuk area < 100 km. */
export interface Proj {
  toKm: (p: LonLat) => [number, number];
  toLL: (p: [number, number]) => LonLat;
}

export function makeProj(origin: LonLat): Proj {
  const kx = 111.32 * Math.cos((origin[1] * Math.PI) / 180);
  const ky = 110.57;
  return {
    toKm: (p) => [(p[0] - origin[0]) * kx, (p[1] - origin[1]) * ky],
    toLL: (p) => [origin[0] + p[0] / kx, origin[1] + p[1] / ky],
  };
}

export function distKm(a: LonLat, b: LonLat): number {
  const kx = 111.32 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * 110.57);
}

type P = [number, number];

/** Selubung cembung (monotone chain), berlawanan arah jarum jam. */
export function convexHull(pts: P[]): P[] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (s.length < 3) return s;
  const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P[] = [];
  for (const p of s) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P[] = [];
  for (let i = s.length - 1; i >= 0; i--) {
    const p = s[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Penyangga poligon cembung sejauh d km (selubung dari lingkaran kecil di tiap titik). */
export function bufferHull(hull: P[], d: number): P[] {
  const pts: P[] = [];
  const src = hull.length ? hull : [[0, 0] as P];
  for (const [x, y] of src) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      pts.push([x + d * Math.cos(a), y + d * Math.sin(a)]);
    }
  }
  return convexHull(pts);
}

export function pathLength(path: P[]): number {
  let L = 0;
  for (let i = 1; i < path.length; i++) L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return L;
}

export function pathLengthLL(path: LonLat[]): number {
  let L = 0;
  for (let i = 1; i < path.length; i++) L += distKm(path[i - 1], path[i]);
  return L;
}

/** Potongan jalur dari jarak s0 sampai s1 (km). */
export function slicePath(path: P[], s0: number, s1: number): P[] {
  const out: P[] = [];
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const lo = acc;
    const hi = acc + seg;
    if (hi >= s0 && lo <= s1 && seg > 0) {
      const f0 = Math.max(0, (s0 - lo) / seg);
      const f1 = Math.min(1, (s1 - lo) / seg);
      const pa: P = [a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0];
      const pb: P = [a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1];
      if (!out.length) out.push(pa);
      out.push(pb);
    }
    acc = hi;
  }
  return out;
}

/** Titik pada jalur (lon/lat) di pecahan f (0..1) panjangnya. */
export function alongLL(path: LonLat[], f: number): LonLat {
  if (path.length === 0) return [0, 0];
  if (path.length === 1 || f <= 0) return path[0];
  const total = pathLengthLL(path);
  let target = Math.min(1, f) * total;
  for (let i = 1; i < path.length; i++) {
    const seg = distKm(path[i - 1], path[i]);
    if (target <= seg && seg > 0) {
      const g = target / seg;
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * g, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * g];
    }
    target -= seg;
  }
  return path[path.length - 1];
}

/** Potongan jalur lon/lat sampai pecahan f; sisanya dikembalikan terpisah. */
export function splitLL(path: LonLat[], f: number): { done: LonLat[]; todo: LonLat[] } {
  if (path.length < 2) return { done: [], todo: path };
  const ff = Math.max(0, Math.min(1, f));
  const total = pathLengthLL(path);
  let target = ff * total;
  const done: LonLat[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const seg = distKm(path[i - 1], path[i]);
    if (target <= seg) {
      const g = seg > 0 ? target / seg : 0;
      const p: LonLat = [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * g, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * g];
      done.push(p);
      return { done: ff > 0 ? done : [], todo: [p, ...path.slice(i)] };
    }
    target -= seg;
    done.push(path[i]);
  }
  return { done, todo: [] };
}

export function circleLL(center: LonLat, rKm: number, n = 48): LonLat[] {
  const kx = 111.32 * Math.cos((center[1] * Math.PI) / 180);
  const out: LonLat[] = [];
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    out.push([center[0] + (rKm * Math.cos(a)) / kx, center[1] + (rKm * Math.sin(a)) / 110.57]);
  }
  return out;
}

/** Busur lingkaran dari sudut a0 ke a1 (derajat dari utara, searah jarum jam). */
export function arcLL(center: LonLat, rKm: number, a0: number, a1: number, n = 16): LonLat[] {
  const kx = 111.32 * Math.cos((center[1] * Math.PI) / 180);
  const out: LonLat[] = [];
  for (let k = 0; k <= n; k++) {
    const a = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180;
    out.push([center[0] + (rKm * Math.sin(a)) / kx, center[1] + (rKm * Math.cos(a)) / 110.57]);
  }
  return out;
}
