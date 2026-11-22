import type { LonLat, ResourceUnit, UnitKind, WaterSource } from './types';
import { t } from '../i18n';

/*
 * Aset contoh per skenario. Posisi dan status BUKAN data pelacakan aset sebenarnya:
 * ditempatkan relatif terhadap pusat skenario untuk menunjukkan cara kerja perencana.
 */

export const KIND_LABEL: Record<UnitKind, string> = {
  get regu_ma() {
    return t('Manggala Agni crew', 'Regu Manggala Agni');
  },
  get regu_tni() {
    return t('TNI (army) crew', 'Regu TNI');
  },
  get regu_polri() {
    return t('Police crew', 'Regu Polri');
  },
  get regu_mpa() {
    return t('Village fire crew (MPA)', 'Regu MPA desa');
  },
  get alat_berat() {
    return t('Excavator', 'Ekskavator');
  },
  get tangki() {
    return t('Water tanker', 'Mobil tangki air');
  },
  get perahu() {
    return t('Pump boat', 'Perahu pompa');
  },
  get heli() {
    return t('Water-bombing helicopter', 'Helikopter water bombing');
  },
};

/** Label pendek untuk filter armada. */
const grp = (key: UnitKind, en: string, id: string) => ({
  key,
  get label() {
    return t(en, id);
  },
});
export const KIND_GROUP: { key: UnitKind; label: string }[] = [
  grp('regu_ma', 'Manggala Agni', 'Manggala Agni'),
  grp('regu_tni', 'TNI', 'TNI'),
  grp('regu_polri', 'Police', 'Polri'),
  grp('regu_mpa', 'Village MPA', 'MPA desa'),
  grp('alat_berat', 'Excavator', 'Ekskavator'),
  grp('tangki', 'Tanker', 'Mobil tangki'),
  grp('perahu', 'Pump boat', 'Perahu pompa'),
  grp('heli', 'Helicopter', 'Helikopter'),
];

export const KIND_COLOR: Record<UnitKind, string> = {
  regu_ma: '#c2410c',
  regu_tni: '#3f6212',
  regu_polri: '#1e3a8a',
  regu_mpa: '#7c2d12',
  alat_berat: '#a16207',
  tangki: '#0369a1',
  perahu: '#0e7490',
  heli: '#6d28d9',
};

/** Kecepatan bangun garis kendali basah di gambut (km/jam) per regu. */
export const LINE_RATE: Partial<Record<UnitKind, number>> = {
  regu_ma: 0.22,
  regu_tni: 0.14,
  regu_polri: 0.12,
  regu_mpa: 0.1,
  alat_berat: 0.45,
};

export const ALL_KINDS: UnitKind[] = ['regu_ma', 'regu_tni', 'regu_polri', 'regu_mpa', 'alat_berat', 'tangki', 'perahu', 'heli'];

const KM_LAT = 110.57;
const kmLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

export function offsetKm(origin: LonLat, dxKm: number, dyKm: number): LonLat {
  return [origin[0] + dxKm / kmLon(origin[1]), origin[1] + dyKm / KM_LAT];
}

const NAMES: Record<string, { daops: string; daops2: string; koramil: string; polsek: string; bpbd: string; mitra: string; udara: string }> = {
  riau: {
    daops: 'Daops Manggala Agni Siak',
    daops2: 'Daops Manggala Agni Pekanbaru',
    koramil: 'Koramil Sungai Apit',
    polsek: 'Polsek Bunga Raya',
    bpbd: 'Posko BPBD Kabupaten',
    mitra: 'Mitra perkebunan (alat berat)',
    udara: 'Lanud Roesmin Nurjadin',
  },
  kalteng: {
    daops: 'Daops Manggala Agni Pulang Pisau',
    daops2: 'Daops Manggala Agni Palangka Raya',
    koramil: 'Koramil Kahayan Hilir',
    polsek: 'Polsek Maliku',
    bpbd: 'Posko BPBD Kabupaten',
    mitra: 'Mitra perkebunan (alat berat)',
    udara: 'Bandara Tjilik Riwut',
  },
  live: {
    daops: 'Daops Manggala Agni terdekat',
    daops2: 'Daops Manggala Agni kedua',
    koramil: 'Koramil terdekat',
    polsek: 'Polsek terdekat',
    bpbd: 'Posko BPBD Kabupaten',
    mitra: 'Mitra perkebunan (alat berat)',
    udara: 'Bandara/Lanud terdekat',
  },
  sumsel: {
    daops: 'Daops Manggala Agni OKI',
    daops2: 'Daops Manggala Agni Banyuasin',
    koramil: 'Koramil Pampangan',
    polsek: 'Polsek Pedamaran',
    bpbd: 'Posko BPBD Kabupaten',
    mitra: 'Mitra perkebunan (alat berat)',
    udara: 'Lanud Sri Mulyono Herlambang',
  },
};

interface ScenarioLike {
  slug: string;
  center: LonLat;
  villages: { name: string; lon: number; lat: number }[];
  rivers: GeoJSON.FeatureCollection<GeoJSON.LineString, { name: string }>;
  waterPoints?: { name: string; lon: number; lat: number }[];
}

/** Daftar unit contoh untuk skenario. */
export function scenarioUnits(sc: ScenarioLike): ResourceUnit[] {
  const n = NAMES[sc.slug] ?? NAMES.riau;
  const c = sc.center;
  const at = (dx: number, dy: number) => offsetKm(c, dx, dy);
  const daops = at(-16, -11);
  const daops2 = at(38, 30);
  const koramil = at(13, -14);
  const polsek = at(-7, 15);
  const bpbd = at(21, 9);
  const mitra = at(9, 18);
  const udara = at(-48, -36);
  const u = (
    id: string,
    kind: UnitKind,
    base: LonLat,
    baseName: string,
    personnel: number,
    status: ResourceUnit['status'] = 'siaga',
  ): ResourceUnit => ({ id, code: id, name: `${KIND_LABEL[kind]} ${id}`, kind, base, baseName, personnel, status });

  const units: ResourceUnit[] = [
    u('MA-1', 'regu_ma', daops, n.daops, 15),
    u('MA-2', 'regu_ma', daops, n.daops, 15),
    u('MA-3', 'regu_ma', daops, n.daops, 15, 'bertugas'),
    u('MA-4', 'regu_ma', daops2, n.daops2, 15),
    u('MA-5', 'regu_ma', daops2, n.daops2, 15),
    u('TNI-1', 'regu_tni', koramil, n.koramil, 20),
    u('TNI-2', 'regu_tni', koramil, n.koramil, 20),
    u('POL-1', 'regu_polri', polsek, n.polsek, 15),
    u('TK-1', 'tangki', daops, n.daops, 3),
    u('TK-2', 'tangki', bpbd, n.bpbd, 3),
    u('TK-3', 'tangki', bpbd, n.bpbd, 3, 'bertugas'),
    u('EKS-1', 'alat_berat', mitra, n.mitra, 2),
    u('HELI-1', 'heli', udara, n.udara, 4),
    u('HELI-2', 'heli', udara, n.udara, 4, 'bertugas'),
  ];
  sc.villages.forEach((v, k) => {
    units.push(u(`MPA-${k + 1}`, 'regu_mpa', [v.lon, v.lat], t(`${v.name} village`, `Desa ${v.name}`), 10, k === 3 ? 'bertugas' : 'siaga'));
  });
  const river = sc.rivers.features[0]?.geometry.coordinates;
  if (river && river.length > 1) {
    const mid = river[Math.floor(river.length / 2)] as LonLat;
    units.push(u('PRH-1', 'perahu', mid, t('River jetty', 'Dermaga sungai'), 4));
  } else if (sc.waterPoints?.length) {
    const w = sc.waterPoints[0];
    units.push(u('PRH-1', 'perahu', [w.lon, w.lat], t('River jetty', 'Dermaga sungai'), 4));
  }
  return units;
}

/** Sumber air: titik sampel sungai tiap ±1 km dan sumur bor contoh di sekitar titik api. */
export function scenarioWater(sc: ScenarioLike, ignition: LonLat): WaterSource[] {
  const out: WaterSource[] = [];
  let k = 0;
  for (const w of sc.waterPoints ?? []) out.push({ id: `A${++k}`, name: w.name, kind: 'sungai', pos: [w.lon, w.lat] });
  for (const f of sc.rivers.features) {
    const cs = f.geometry.coordinates as LonLat[];
    for (let i = 0; i < cs.length - 1; i++) {
      const a = cs[i];
      const b = cs[i + 1];
      const dx = (b[0] - a[0]) * kmLon(a[1]);
      const dy = (b[1] - a[1]) * KM_LAT;
      const len = Math.hypot(dx, dy);
      const n = Math.max(1, Math.round(len));
      for (let s = 0; s < n; s++) {
        const p: LonLat = [a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n];
        out.push({ id: `S${++k}`, name: f.properties.name.replace(' (ilustrasi)', ''), kind: 'sungai', pos: p });
      }
    }
  }
  // Sumur bor gambut (program pembasahan) di empat arah, 3,5–5 km dari titik api.
  const ring: [number, number, string][] = [
    [3.6, 0.6, t('Borehole 1', 'Sumur bor 1')],
    [-0.8, 4.4, t('Borehole 2', 'Sumur bor 2')],
    [-4.2, -1.4, t('Borehole 3', 'Sumur bor 3')],
    [1.2, -4.8, t('Borehole 4', 'Sumur bor 4')],
  ];
  ring.forEach(([dx, dy, name], i) => out.push({ id: `W${i + 1}`, name, kind: 'sumur_bor', pos: offsetKm(ignition, dx, dy) }));
  const v = sc.villages[0];
  if (v) out.push({ id: 'E1', name: t(`${v.name} village pond`, `Embung Desa ${v.name}`), kind: 'embung', pos: offsetKm([v.lon, v.lat], 0.4, -0.3) });
  return out;
}
