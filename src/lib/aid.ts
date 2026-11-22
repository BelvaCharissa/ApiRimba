/** Jenis bantuan dan perkiraan kebutuhan per posko provinsi (aman untuk klien dan server). */
import { t } from './i18n';

export type AidType = 'masks' | 'water' | 'food' | 'medical' | 'equipment' | 'shelter';
export type Dropoff = 'posko' | 'pickup' | 'courier';

export interface AidInfo {
  key: AidType;
  label: () => string;
  unit: () => string;
  why: () => string;
  /** kebutuhan per titik panas aktif 72 jam (perkiraan kasar) */
  perHotspot: number;
  min: number;
}

export const AID: AidInfo[] = [
  {
    key: 'masks',
    label: () => t('N95 masks', 'Masker N95'),
    unit: () => t('masks', 'masker'),
    why: () => t('Haze from peat fires is the biggest health risk for nearby villages.', 'Asap gambut adalah risiko kesehatan terbesar bagi desa sekitar.'),
    perHotspot: 40,
    min: 500,
  },
  {
    key: 'water',
    label: () => t('Drinking water', 'Air minum'),
    unit: () => t('litres', 'liter'),
    why: () => t('Crews on the line drink 4-6 litres a day in the heat.', 'Regu di garis api minum 4-6 liter per hari di cuaca panas.'),
    perHotspot: 25,
    min: 300,
  },
  {
    key: 'food',
    label: () => t('Food packs', 'Paket makanan'),
    unit: () => t('packs', 'paket'),
    why: () => t('Ready-to-eat packs for crews and evacuated families.', 'Paket siap makan untuk regu dan keluarga yang mengungsi.'),
    perHotspot: 6,
    min: 80,
  },
  {
    key: 'medical',
    label: () => t('First-aid kits', 'Kotak P3K'),
    unit: () => t('kits', 'kotak'),
    why: () => t('Burns, eye irritation and breathing problems are common near the fire line.', 'Luka bakar, iritasi mata, dan sesak napas sering terjadi di dekat garis api.'),
    perHotspot: 0.6,
    min: 15,
  },
  {
    key: 'equipment',
    label: () => t('Pump & hose sets', 'Set pompa & selang'),
    unit: () => t('sets', 'set'),
    why: () => t('Portable pumps pull water from canals to wet the peat.', 'Pompa portabel menyedot air kanal untuk membasahi gambut.'),
    perHotspot: 0.08,
    min: 2,
  },
  {
    key: 'shelter',
    label: () => t('Tents & mats', 'Tenda & tikar'),
    unit: () => t('tents', 'tenda'),
    why: () => t('Temporary shelter for families moved away from the smoke.', 'Tempat tinggal sementara bagi keluarga yang menjauh dari asap.'),
    perHotspot: 0.12,
    min: 3,
  },
];

export const aidInfo = (k: AidType) => AID.find((a) => a.key === k) ?? AID[0];

export const DROPOFF: { key: Dropoff; label: () => string }[] = [
  { key: 'posko', label: () => t('I will bring it to the post', 'Saya antar ke posko') },
  { key: 'pickup', label: () => t('Please pick it up from me', 'Mohon dijemput') },
  { key: 'courier', label: () => t('I will send it by courier', 'Saya kirim lewat kurir') },
];

export interface Campaign {
  key: string;
  province: string;
  hotspots: number;
  incidents: number;
  topPriority: number;
  lat: number;
  lon: number;
  needs: Record<AidType, number>;
}

export interface AidTotalsRow {
  campaign_key: string;
  aid_type: AidType;
  /** dijanjikan (tidak termasuk yang batal) */
  quantity: number;
  /** sudah diterima posko atau disalurkan ke warga */
  delivered: number;
  donors: number;
}

/** Tahap penyaluran bantuan, diperbarui petugas posko. */
export type PledgeStatus = 'pledged' | 'confirmed' | 'sent' | 'received' | 'distributed' | 'cancelled';

export const PLEDGE_STEPS: { key: Exclude<PledgeStatus, 'cancelled'>; label: () => string; hint: () => string }[] = [
  { key: 'pledged', label: () => t('Pledged', 'Dijanjikan'), hint: () => t('Your pledge is recorded.', 'Janji Anda tercatat.') },
  { key: 'confirmed', label: () => t('Confirmed', 'Dikonfirmasi'), hint: () => t('The post has contacted you and agreed the delivery.', 'Posko sudah menghubungi Anda dan menyepakati pengiriman.') },
  { key: 'sent', label: () => t('On the way', 'Dalam perjalanan'), hint: () => t('The goods are on their way to the post.', 'Barang sedang dikirim ke posko.') },
  { key: 'received', label: () => t('Received', 'Diterima posko'), hint: () => t('The post has received the goods.', 'Posko sudah menerima barang.') },
  { key: 'distributed', label: () => t('Distributed', 'Disalurkan'), hint: () => t('Handed out to crews or residents.', 'Sudah dibagikan ke regu atau warga.') },
];

export function pledgeStatusLabel(s: PledgeStatus): string {
  return s === 'cancelled' ? t('Cancelled', 'Dibatalkan') : (PLEDGE_STEPS.find((x) => x.key === s)?.label() ?? s);
}

/** Indeks tahap (0..4); batal = -1. */
export const pledgeStepIndex = (s: PledgeStatus) => PLEDGE_STEPS.findIndex((x) => x.key === s);

export interface PublicPledge {
  code: string;
  created_at: string;
  campaign_key: string;
  aid_type: AidType;
  quantity: number;
  dropoff: Dropoff;
  status: PledgeStatus;
  status_at: string;
  donor: string | null;
}

export interface PledgeTrack extends Omit<PublicPledge, 'donor'> {
  status_note: string | null;
  events: { status: PledgeStatus; note: string | null; at: string }[];
}

export function needsFor(hotspots: number): Record<AidType, number> {
  const out = {} as Record<AidType, number>;
  for (const a of AID) out[a.key] = Math.max(a.min, Math.ceil(hotspots * a.perHotspot));
  return out;
}

/** Persentase terpenuhi (0-100) dari total semua jenis, dibobot sama per jenis. */
export function campaignPercent(c: Campaign, pledged: Partial<Record<AidType, number>>): number {
  const parts = AID.map((a) => Math.min(1, (pledged[a.key] ?? 0) / c.needs[a.key]));
  return Math.round((parts.reduce((s, v) => s + v, 0) / parts.length) * 100);
}
