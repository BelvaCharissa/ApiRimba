/** Bantuan di sekitar titik api: sumber air dan layanan yang bisa dihubungi (aman untuk klien dan server). */
import { t } from './i18n';

export type WaterKind = 'sungai' | 'kanal' | 'danau' | 'sumur' | 'hidran';
export type ServiceKind = 'damkar' | 'polisi' | 'rumah_sakit' | 'puskesmas' | 'kantor_desa';

export interface WaterPoint {
  id: string;
  kind: WaterKind;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

export interface ServicePoint {
  id: string;
  kind: ServiceKind;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  phone: string | null;
}

export interface BantuanResponse {
  source: 'osm' | 'none';
  lat: number;
  lon: number;
  water: WaterPoint[];
  services: ServicePoint[];
  note?: string;
}

export const WATER_LABEL: Record<WaterKind, string> = {
  get sungai() {
    return t('River', 'Sungai');
  },
  get kanal() {
    return t('Canal', 'Kanal');
  },
  get danau() {
    return t('Lake / pond', 'Danau / embung');
  },
  get sumur() {
    return t('Well / tank', 'Sumur / tandon');
  },
  get hidran() {
    return t('Hydrant', 'Hidran');
  },
};

export const SERVICE_LABEL: Record<ServiceKind, string> = {
  get damkar() {
    return t('Fire station', 'Pemadam kebakaran');
  },
  get polisi() {
    return t('Police', 'Polisi');
  },
  get rumah_sakit() {
    return t('Hospital', 'Rumah sakit');
  },
  get puskesmas() {
    return t('Clinic / puskesmas', 'Puskesmas / klinik');
  },
  get kantor_desa() {
    return t('Village / district office', 'Kantor desa / camat');
  },
};

/** Nomor darurat nasional (bebas pulsa). BPBD dan Manggala Agni setempat bisa dijangkau lewat 112. */
const hot = (number: string, en: string, id: string, hEn: string, hId: string) => ({
  number,
  get label() {
    return t(en, id);
  },
  get hint() {
    return t(hEn, hId);
  },
});

export const HOTLINES: { number: string; label: string; hint: string }[] = [
  hot('112', 'Integrated emergency', 'Darurat terpadu', 'Routed to fire, police, BPBD or ambulance', 'Diteruskan ke damkar, polisi, BPBD, atau ambulans'),
  hot('113', 'Fire brigade', 'Pemadam kebakaran', 'Give the location and wind direction', 'Laporkan lokasi dan arah angin'),
  hot('119', 'Ambulance', 'Ambulans', 'Smoke or burn victims', 'Korban asap atau luka bakar'),
  hot('110', 'Police', 'Polisi', 'Deliberate burning, road closures', 'Pembakaran disengaja, pengamanan jalan'),
  hot('115', 'Basarnas', 'Basarnas', 'Search and evacuation', 'Pencarian dan evakuasi'),
];

export const WATER_COLOR = '#4fb8f0';
export const SERVICE_COLOR = '#ffffff';

/** Jarak (km) haversine. */
export function km(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r;
  const dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
