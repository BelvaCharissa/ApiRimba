import type { BriefingRequest } from './schemas';

const fmt = (v: number, d = 1) => v.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 });

export function compassName(deg: number): string {
  const names = ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** Koordinat lapangan: 0,4561° LU, 102,0079° BT. */
export function coordText(lat: number, lon: number): string {
  const f = (v: number) => Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return `${f(lat)}° ${lat >= 0 ? 'LU' : 'LS'}, ${f(lon)}° ${lon >= 0 ? 'BT' : 'BB'}`;
}

export const BRIEFING_SYSTEM = `Kamu adalah analis kebencanaan yang menulis briefing untuk koordinator regu pemadam
kebakaran hutan dan lahan (Manggala Agni / BPBD) yang sedang bertugas di lokasi yang disebut dalam data.
Aturan:
- Bahasa Indonesia baku, ringkas, tegas. Tanpa emoji, tanpa bahasa alarmis, tanpa markdown tebal.
- Hanya gunakan angka, nama desa, dan koordinat dari data. Jangan mengarang data baru.
- Spesifik, bukan saran umum: setiap butir menyebut SIAPA/DI MANA (nama desa, koordinat, nama sekat) dan KAPAN (jam).
  Contoh buruk: "Pantau situasi". Contoh baik: "Evakuasi Sungai Buluh (900 jiwa) sebelum jam ke-3; api tiba sekitar 5,5 jam."
- Selalu sebutkan koordinat titik api persis di kalimat pertama SITUASI.
- Untuk sekat, sebutkan titik awal dan titik akhir (koordinat), panjang, dan batas waktu selesai dibangun.
- Saat menyebut luas terbakar, tulis jelas "tanpa sekat" atau "dengan Sekat X".
- Format persis tiga bagian dengan judul berikut, masing-masing di baris sendiri:
SITUASI
(2-3 kalimat)
PRIORITAS TINDAKAN
(3-5 butir, tiap butir diawali "- ", urutkan dari paling mendesak)
CATATAN
(1 kalimat: asumsi model dan risiko api bawah tanah di gambut bila relevan)
- Total maksimal 200 kata.`;

/** Ringkas hasil simulasi menjadi prompt untuk model bahasa. */
export function briefingPrompt(r: BriefingRequest): string {
  const villages = [...r.villages]
    .sort((a, b) => (a.etaHours ?? 99) - (b.etaHours ?? 99))
    .map(
      (v) =>
        `- ${v.name} (${v.population} jiwa${v.lat !== undefined && v.lon !== undefined ? `, ${coordText(v.lat, v.lon)}` : ''}${
          v.distanceKm !== undefined ? `, ${fmt(v.distanceKm)} km di ${v.direction} titik api` : ''
        }): ${v.etaHours === null ? 'tidak terjangkau dalam 12 jam' : `api tiba sekitar ${fmt(v.etaHours)} jam`}, level ${v.level.toUpperCase()}`,
    )
    .join('\n');
  const recs = r.recommendations.length
    ? r.recommendations
        .map(
          (s) =>
            `- Sekat ${s.label}: ${s.from && s.to ? `dari ${coordText(s.from.lat, s.from.lon)} ke ${coordText(s.to.lat, s.to.lon)}, ` : ''}panjang ${fmt(
              s.lengthKm,
            )} km${s.position ? ` (${s.position})` : ''}, menurunkan luas terbakar ${fmt(s.reductionPct)}%, harus selesai dalam ${fmt(
              s.marginHours + 4,
            )} jam (sisa waktu ${fmt(s.marginHours)} jam setelah 4 jam pembangunan), skor ${fmt(s.score, 0)}${
              s.peatBypassRisk ? ', melintasi gambut kering (risiko api bawah tanah)' : ''
            }`,
        )
        .join('\n')
    : `- Belum ada rekomendasi sekat. ${r.emptyReason ?? ''}`;
  const ign = r.ignition
    ? `Titik awal api: ${coordText(r.ignition.lat, r.ignition.lon)}${r.ignition.custom ? ' (dipilih pengguna)' : ''}`
    : '';
  const hot = r.firstHotspot
    ? `Titik panas satelit terkuat: ${coordText(r.firstHotspot.lat, r.firstHotspot.lon)}, ${r.firstHotspot.when}, FRP ${fmt(r.firstHotspot.frp)} MW`
    : '';
  return `Data hasil simulasi ApiRimba AI (prediksi 12 jam):
Wilayah: ${r.scenarioName}, ${r.province}
${ign}
${hot}
Angin: ${fmt(r.windMs)} m/s dari arah ${compassName(r.windFromDeg)} (${Math.round(r.windFromDeg)} derajat), api terdorong ke arah ${compassName(
    r.windFromDeg + 180,
  )}
Indeks kekeringan: ${fmt(r.dryness, 2)} (0 basah, 1 sangat kering)
Perkiraan luas terbakar 12 jam TANPA sekat: ${fmt(r.burnedKm2)} km2
${r.burnedKm2WithFirebreak !== null ? `Perkiraan luas terbakar DENGAN Sekat ${r.appliedFirebreak ?? ''}: ${fmt(r.burnedKm2WithFirebreak)} km2` : 'Sekat belum diterapkan.'}
Desa (urut dari yang paling cepat terjangkau):
${villages}
Rekomendasi sekat bakar:
${recs}

Tulis briefing sesuai format.`;
}

/** Briefing cadangan berbasis aturan, dipakai bila Gemini tidak tersedia. Tetap spesifik lokasi. */
export function fallbackBriefing(r: BriefingRequest): string {
  const threatened = r.villages
    .filter((v) => v.etaHours !== null)
    .sort((a, b) => (a.etaHours ?? 99) - (b.etaHours ?? 99));
  const first = threatened[0];
  const best = r.recommendations.find((x) => x.label === r.appliedFirebreak) ?? r.recommendations[0];
  const lines: string[] = [];
  lines.push('SITUASI');
  lines.push(
    `${r.ignition ? `Api berawal di ${coordText(r.ignition.lat, r.ignition.lon)}. ` : ''}Angin ${fmt(r.windMs)} m/s dari ${compassName(
      r.windFromDeg,
    )} mendorong api ke ${compassName(r.windFromDeg + 180)}; perkiraan luas terbakar 12 jam tanpa sekat ${fmt(r.burnedKm2)} km2${
      r.burnedKm2WithFirebreak !== null ? `, dengan Sekat ${r.appliedFirebreak} ${fmt(r.burnedKm2WithFirebreak)} km2` : ''
    }.${first ? ` ${first.name} terjangkau paling awal, sekitar ${fmt(first.etaHours ?? 0)} jam lagi.` : ' Tidak ada desa yang terjangkau dalam 12 jam.'}`,
  );
  lines.push('PRIORITAS TINDAKAN');
  for (const v of threatened.filter((x) => x.level === 'awas' || x.level === 'siaga')) {
    const lead = Math.max(0, Math.floor((v.etaHours ?? 0) - 1));
    lines.push(
      `- Evakuasi ${v.name} (${v.population} jiwa${v.lat !== undefined && v.lon !== undefined ? `, ${coordText(v.lat, v.lon)}` : ''}) paling lambat jam ke-${lead}; api tiba sekitar ${fmt(
        v.etaHours ?? 0,
      )} jam.`,
    );
  }
  if (best) {
    lines.push(
      `- Bangun Sekat ${best.label} ${best.from && best.to ? `dari ${coordText(best.from.lat, best.from.lon)} ke ${coordText(best.to.lat, best.to.lon)} ` : ''}(${fmt(
        best.lengthKm,
      )} km), selesai dalam ${fmt(best.marginHours + 4)} jam; luas terbakar turun ${fmt(best.reductionPct)}%.`,
    );
    if (best.peatBypassRisk) lines.push(`- Basahi gambut di sepanjang Sekat ${best.label} atau buat sekat kanal agar api bawah tanah tidak lolos.`);
  } else {
    lines.push(`- ${r.emptyReason ?? 'Jalankan pencarian sekat di tab Sekat untuk mendapat lokasi sekat.'}`);
  }
  const waspada = threatened.filter((x) => x.level === 'waspada');
  if (waspada.length) lines.push(`- Siagakan ${waspada.map((v) => v.name).join(' dan ')}; api diperkirakan tiba lebih dari 8 jam lagi.`);
  lines.push('CATATAN');
  lines.push('Disusun otomatis dari prediksi simulasi dengan angin seragam 12 jam; cek ulang di lapangan bila angin berubah.');
  return lines.join('\n');
}
