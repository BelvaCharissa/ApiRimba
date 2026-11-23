/**
 * Peringatan dini ke warga desa (mockup WhatsApp).
 *
 * Fungsi murni: menentukan desa yang perlu diperingatkan dan menyusun isi pesannya. Saat ini hanya
 * ditampilkan sebagai mockup (tidak ada pesan yang benar-benar dikirim). Bentuknya sudah mengikuti aturan
 * template WhatsApp Business (5 parameter satu baris), jadi bisa disambungkan ke API resmi nanti.
 */

export type AlertLevel = 'awas' | 'siaga' | 'waspada';
export type AlertKind = 'api' | 'asap' | 'api_asap';

export interface VillageAlert {
  village: string;
  lat: number;
  lon: number;
  population: number | null;
  level: AlertLevel;
  kind: AlertKind;
  /** Jam sampai api tiba (null = api tidak sampai dalam 12 jam). */
  fireEtaHours: number | null;
  /** Peluang terbakar 0..1. */
  fireProb: number | null;
  /** Jam sampai asap mencapai level tidak sehat (null = tidak). */
  smokeHours: number | null;
  /** Puncak PM2.5 dari asap (µg/m³). */
  smokePeak: number | null;
}

export interface AlertSourceVillage {
  name: string;
  lat: number;
  lon: number;
  population?: number | null;
  fireEtaHours: number | null;
  fireProb?: number | null;
  /** Jam asap mulai tidak sehat (null = tidak). */
  smokeUnhealthyHours?: number | null;
  smokePeak?: number | null;
}

const RANK: Record<AlertLevel, number> = { waspada: 1, siaga: 2, awas: 3 };
export const levelRank = (l: AlertLevel) => RANK[l];
const maxLevel = (a: AlertLevel | null, b: AlertLevel | null): AlertLevel | null => (!a ? b : !b ? a : RANK[a] >= RANK[b] ? a : b);

/**
 * Level dari jam tiba api (sama dengan level desa di simulator): < 4 jam Awas, 4-8 Siaga, 8-12 Waspada.
 * Asap: tidak sehat dalam 12 jam = Waspada; sangat tidak sehat (> 150 µg/m³) dalam 6 jam = Siaga;
 * berbahaya (> 250 µg/m³) dalam 3 jam = Awas.
 */
export function alertLevel(v: AlertSourceVillage): AlertLevel | null {
  let fire: AlertLevel | null = null;
  if (v.fireEtaHours !== null && v.fireEtaHours <= 12) fire = v.fireEtaHours < 4 ? 'awas' : v.fireEtaHours < 8 ? 'siaga' : 'waspada';
  let smoke: AlertLevel | null = null;
  const sh = v.smokeUnhealthyHours ?? null;
  const peak = v.smokePeak ?? 0;
  if (sh !== null && sh <= 12) {
    smoke = 'waspada';
    if (peak > 150 && sh <= 6) smoke = 'siaga';
    if (peak > 250 && sh <= 3) smoke = 'awas';
  }
  return maxLevel(fire, smoke);
}

/** Desa yang perlu diberi peringatan, paling mendesak di atas. */
export function villageAlerts(villages: AlertSourceVillage[]): VillageAlert[] {
  const out: VillageAlert[] = [];
  for (const v of villages) {
    const level = alertLevel(v);
    if (!level) continue;
    const fire = v.fireEtaHours !== null && v.fireEtaHours <= 12;
    const smoke = (v.smokeUnhealthyHours ?? null) !== null && (v.smokeUnhealthyHours as number) <= 12;
    out.push({
      village: v.name,
      lat: v.lat,
      lon: v.lon,
      population: v.population ?? null,
      level,
      kind: fire && smoke ? 'api_asap' : fire ? 'api' : 'asap',
      fireEtaHours: fire ? v.fireEtaHours : null,
      fireProb: v.fireProb ?? null,
      smokeHours: smoke ? (v.smokeUnhealthyHours as number) : null,
      smokePeak: smoke ? (v.smokePeak ?? null) : null,
    });
  }
  const soonest = (a: VillageAlert) => Math.min(a.fireEtaHours ?? 99, a.smokeHours ?? 99);
  return out.sort((a, b) => RANK[b.level] - RANK[a.level] || soonest(a) - soonest(b));
}

/* ---------------- Zona waktu ---------------- */
const WITA = ['Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Sulawesi'];
const WIT = ['Maluku', 'Papua'];

/** Zona waktu Indonesia dari nama provinsi (bawaan WIB). */
export function zoneOf(province: string | null | undefined): { label: 'WIB' | 'WITA' | 'WIT'; tz: string } {
  const p = province ?? '';
  if (WIT.some((x) => p.includes(x))) return { label: 'WIT', tz: 'Asia/Jayapura' };
  if (WITA.some((x) => p.includes(x))) return { label: 'WITA', tz: 'Asia/Makassar' };
  return { label: 'WIB', tz: 'Asia/Jakarta' };
}

function clock(ms: number, tz: string): string {
  return new Date(ms).toLocaleTimeString('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');
}

function hoursText(h: number): string {
  if (h < 0.75) return 'kurang dari 1 jam';
  const r = Math.round(h * 2) / 2;
  return `±${String(r).replace('.', ',')} jam`;
}

const LEVEL_TITLE: Record<AlertLevel, string> = { awas: 'AWAS', siaga: 'SIAGA', waspada: 'WASPADA' };

/** Kategori ISPU PM2.5 singkat untuk pesan. */
function ispuText(pm: number): string {
  if (pm > 250.4) return 'Berbahaya';
  if (pm > 150.4) return 'Sangat tidak sehat';
  if (pm > 55.4) return 'Tidak sehat';
  return 'Sedang';
}

export interface AlertContext {
  /** Nama provinsi (untuk zona waktu dan konteks). */
  province: string | null;
  nowMs: number;
  /** Tautan peta risiko (absolut). */
  mapUrl: string;
}

export interface AlertMessage {
  /** Parameter template WhatsApp {{1}}..{{5}} (masing-masing satu baris). */
  params: [string, string, string, string, string];
  /** Teks lengkap seperti yang tampil di WhatsApp (format *tebal* / _miring_). */
  text: string;
}

/**
 * Teks template WhatsApp "peringatan_dini_kebakaran" (bahasa Indonesia) yang ditampilkan di mockup.
 */
export const WA_TEMPLATE_BODY =
  '⚠️ *PERINGATAN DINI {{1}}*\nDesa *{{2}}*\n\n{{3}}\n\n*Yang perlu dilakukan:* {{4}}\n\nPeta risiko: {{5}}\n\nDarurat 112 · Damkar 113\n_Perkiraan simulasi ApiRimba, bukan perintah resmi. Ikuti arahan BPBD dan kepala desa._';

export function renderTemplate(params: readonly string[]): string {
  return WA_TEMPLATE_BODY.replace(/\{\{(\d)\}\}/g, (_, i) => params[Number(i) - 1] ?? '');
}

/** Parameter template tidak boleh berisi baris baru, tab, atau lebih dari 4 spasi berurutan. */
function oneLine(s: string, max = 600): string {
  return s.replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, max);
}

export function alertMessage(a: VillageAlert, ctx: AlertContext): AlertMessage {
  const z = zoneOf(ctx.province);
  const parts: string[] = [];
  if (a.fireEtaHours !== null) {
    parts.push(
      `🔥 Api diperkirakan tiba dalam ${hoursText(a.fireEtaHours)} (sekitar pukul ${clock(ctx.nowMs + a.fireEtaHours * 3600_000, z.tz)} ${z.label})` +
        (a.fireProb !== null ? `, peluang ${Math.round(a.fireProb * 100)}%.` : '.'),
    );
  }
  if (a.smokeHours !== null) {
    const when = a.smokeHours < 0.75 ? 'mulai kurang dari 1 jam lagi' : `mulai ${hoursText(a.smokeHours)} lagi (pukul ${clock(ctx.nowMs + a.smokeHours * 3600_000, z.tz)} ${z.label})`;
    parts.push(`💨 Asap tidak sehat ${when}` + (a.smokePeak ? `, puncak ${ispuText(a.smokePeak)}.` : '.'));
  }

  const actions: string[] = [];
  if (a.level === 'awas' && a.fireEtaHours !== null) actions.push('Bersiap mengungsi sekarang, bawa dokumen, obat, dan air minum');
  else if (a.fireEtaHours !== null) actions.push('Siapkan tas siaga dan rute evakuasi');
  if (a.smokeHours !== null) actions.push('pakai masker N95/KN95 dan tutup jendela');
  actions.push('utamakan lansia, anak, ibu hamil, dan penderita asma');
  if (a.fireEtaHours !== null) actions.push('jangan mendekati api');
  const act = actions.join('; ');

  const params: [string, string, string, string, string] = [
    oneLine(`${LEVEL_TITLE[a.level]} ${a.kind === 'asap' ? 'ASAP' : a.kind === 'api' ? 'KEBAKARAN' : 'KEBAKARAN & ASAP'}`, 60),
    oneLine(a.village, 80),
    oneLine(parts.join(' ')),
    oneLine(act.charAt(0).toUpperCase() + act.slice(1) + '.'),
    oneLine(ctx.mapUrl, 300),
  ];
  return { params, text: renderTemplate(params) };
}

