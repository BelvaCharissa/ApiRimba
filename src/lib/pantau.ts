/** Tipe & utilitas bersama Peta Pantau (aman dipakai di klien dan server). */

export interface NatHotspot {
  id: string;
  lat: number;
  lon: number;
  acquiredAt: string;
  confidence: 'low' | 'nominal' | 'high';
  frp: number;
  satellite: string;
  province: string;
  /** Kemungkinan sumber panas tetap (cerobong gas, smelter): muncul di titik yang sama ≥ 3 hari. */
  persistent?: boolean;
  /** Indeks kejadian (kelompok titik berdekatan). */
  incident: number;
}

export type RawHotspot = Omit<NatHotspot, 'incident'>;

export interface Incident {
  id: number;
  lat: number;
  lon: number;
  province: string;
  count: number;
  high: number;
  maxFrp: number;
  sumFrp: number;
  firstSeen: string;
  lastSeen: string;
  /** Radius sebaran titik (km). */
  spreadKm: number;
}

export interface NationalHotspots {
  source: 'nasa-firms' | 'fallback';
  fetchedAt: string;
  stale: boolean;
  note?: string;
  satellites: string[];
  items: RawHotspot[];
}

export interface WindGrid {
  lons: number[];
  lats: number[];
  /** Komponen timur (m/s), indeks [j * lons.length + i]. */
  u: number[];
  /** Komponen utara (m/s). */
  v: number[];
}

export interface CityAir {
  city: string;
  province: string;
  lat: number;
  lon: number;
  pm25: number;
}

export interface NationalWeather {
  fetchedAt: string;
  stale: boolean;
  wind: WindGrid | null;
  air: CityAir[];
}

/* ---------------- ISPU PM2.5 (Permen LHK P.14/2020) ---------------- */
export type IspuLevel = 'baik' | 'sedang' | 'tidak_sehat' | 'sangat_tidak_sehat' | 'berbahaya';

export const ISPU: { key: IspuLevel; label: string; max: number; color: string; ink: string; advice: string }[] = [
  { key: 'baik', label: 'Baik', max: 15.5, color: '#2fb67c', ink: '#0d6b43', advice: 'Aman untuk beraktivitas di luar.' },
  { key: 'sedang', label: 'Sedang', max: 55.4, color: '#1c7ed6', ink: '#0b4f8a', advice: 'Kelompok sensitif kurangi aktivitas berat di luar.' },
  { key: 'tidak_sehat', label: 'Tidak sehat', max: 150.4, color: '#f2b33d', ink: '#8a5a00', advice: 'Pakai masker; kurangi aktivitas di luar.' },
  { key: 'sangat_tidak_sehat', label: 'Sangat tidak sehat', max: 250.4, color: '#e03131', ink: '#b42318', advice: 'Hindari aktivitas di luar; tutup jendela.' },
  { key: 'berbahaya', label: 'Berbahaya', max: Infinity, color: '#212529', ink: '#212529', advice: 'Tetap di dalam ruangan; ikuti arahan evakuasi.' },
];

export function ispuOf(pm25: number) {
  return ISPU.find((x) => pm25 <= x.max) ?? ISPU[ISPU.length - 1];
}

/* ---------------- Umur deteksi ---------------- */
export const AGE_BANDS = [
  { key: 'baru', label: '< 6 jam', maxH: 6, color: '#e03131' },
  { key: 'hari', label: '6–24 jam', maxH: 24, color: '#f76707' },
  { key: 'lama', label: '> 24 jam', maxH: Infinity, color: '#f2b33d' },
] as const;

export function ageBand(ageH: number) {
  return AGE_BANDS.find((b) => ageH < b.maxH) ?? AGE_BANDS[2];
}

export function agoText(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

/** Interpolasi bilinear angin pada lon/lat; null bila di luar grid. */
export function windAt(g: WindGrid, lon: number, lat: number): { u: number; v: number } | null {
  const nx = g.lons.length;
  const ny = g.lats.length;
  const fx = ((lon - g.lons[0]) / (g.lons[nx - 1] - g.lons[0])) * (nx - 1);
  const fy = ((lat - g.lats[0]) / (g.lats[ny - 1] - g.lats[0])) * (ny - 1);
  if (fx < 0 || fy < 0 || fx > nx - 1 || fy > ny - 1) return null;
  const i = Math.min(nx - 2, Math.floor(fx));
  const j = Math.min(ny - 2, Math.floor(fy));
  const tx = fx - i;
  const ty = fy - j;
  const at = (a: number[], ii: number, jj: number) => a[jj * nx + ii];
  const lerp = (a: number[]) =>
    (1 - ty) * ((1 - tx) * at(a, i, j) + tx * at(a, i + 1, j)) + ty * ((1 - tx) * at(a, i, j + 1) + tx * at(a, i + 1, j + 1));
  return { u: lerp(g.u), v: lerp(g.v) };
}

/** Kelompokkan titik panas yang berjarak ≤ linkKm menjadi kejadian (single linkage, grid hash). */
export function clusterIncidents(items: RawHotspot[], linkKm = 2): { items: NatHotspot[]; incidents: Incident[] } {
  const n = items.length;
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const cell = linkKm / 111;
  const grid = new Map<string, number[]>();
  items.forEach((h, i) => {
    const k = `${Math.floor(h.lon / cell)},${Math.floor(h.lat / cell)}`;
    const arr = grid.get(k);
    if (arr) arr.push(i);
    else grid.set(k, [i]);
  });
  items.forEach((h, i) => {
    const cx = Math.floor(h.lon / cell);
    const cy = Math.floor(h.lat / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (j <= i) continue;
          const o = items[j];
          const km = Math.hypot((o.lon - h.lon) * 111 * Math.cos((h.lat * Math.PI) / 180), (o.lat - h.lat) * 111);
          if (km <= linkKm) parent[find(j)] = find(i);
        }
      }
    }
  });
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(i);
    else groups.set(r, [i]);
  }
  const incidents: Incident[] = [];
  const idxOf = new Int32Array(n);
  for (const members of groups.values()) {
    const id = incidents.length;
    let lat = 0;
    let lon = 0;
    let high = 0;
    let maxFrp = 0;
    let sumFrp = 0;
    let first = '9';
    let last = '0';
    const prov = new Map<string, number>();
    for (const i of members) {
      const h = items[i];
      idxOf[i] = id;
      lat += h.lat;
      lon += h.lon;
      if (h.confidence === 'high') high++;
      maxFrp = Math.max(maxFrp, h.frp);
      sumFrp += h.frp;
      if (h.acquiredAt < first) first = h.acquiredAt;
      if (h.acquiredAt > last) last = h.acquiredAt;
      prov.set(h.province, (prov.get(h.province) ?? 0) + 1);
    }
    lat /= members.length;
    lon /= members.length;
    let spread = 0;
    for (const i of members) {
      const h = items[i];
      spread = Math.max(spread, Math.hypot((h.lon - lon) * 111 * Math.cos((lat * Math.PI) / 180), (h.lat - lat) * 111));
    }
    incidents.push({
      id,
      lat,
      lon,
      province: [...prov.entries()].sort((a, b) => b[1] - a[1])[0][0],
      count: members.length,
      high,
      maxFrp,
      sumFrp,
      firstSeen: first,
      lastSeen: last,
      spreadKm: spread,
    });
  }
  return { items: items.map((h, i) => ({ ...h, incident: idxOf[i] })), incidents };
}

/** Skor prioritas kejadian 0–100: banyak titik, api kuat, masih baru, dan keyakinan tinggi. */
export function incidentPriority(inc: Incident, now: number): number {
  const ageH = (now - Date.parse(inc.lastSeen)) / 3600_000;
  const recent = Math.max(0, 1 - ageH / 48);
  const size = Math.min(1, Math.log2(1 + inc.count) / 5);
  const power = Math.min(1, inc.maxFrp / 60);
  const conf = inc.count ? inc.high / inc.count : 0;
  return Math.round(100 * (0.35 * size + 0.25 * power + 0.3 * recent + 0.1 * conf));
}

/** Arah mata angin dalam bahasa Indonesia. */
export function compassId(deg: number): string {
  const names = ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/**
 * Tandai titik yang kemungkinan sumber panas tetap (industri): kelompok ≤ 0,75 km yang
 * terdeteksi pada ≥ 3 tanggal berbeda dengan sebaran sangat kecil. Kebakaran lahan biasanya berpindah.
 */
export function markPersistent(items: RawHotspot[]): RawHotspot[] {
  const { items: tagged, incidents } = clusterIncidents(items, 0.75);
  const days = new Map<number, Set<string>>();
  for (const h of tagged) {
    const set = days.get(h.incident) ?? new Set<string>();
    set.add(h.acquiredAt.slice(0, 10));
    days.set(h.incident, set);
  }
  const flagged = new Set(incidents.filter((i) => (days.get(i.id)?.size ?? 0) >= 3 && i.spreadKm <= 0.75 && i.count >= 3).map((i) => i.id));
  return tagged.map(({ incident, ...h }) => ({ ...h, persistent: flagged.has(incident) }));
}
