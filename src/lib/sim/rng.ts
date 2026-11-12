/** PRNG mulberry32: deterministik untuk seed yang sama. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bilangan acak berbasis hash (seed, kunci). Dipakai mesin agar dua simulasi dengan
 * seed sama berbagi "keacakan" per sel, sehingga efek sekat terlihat jelas, bukan noise.
 */
export function hashRand(seed: number, key: number): number {
  let x = (seed ^ Math.imul(key, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  x = Math.imul(x ^ (seed >>> 3), 0x27d4eb2d);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}
