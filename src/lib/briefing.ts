import type { BriefingRequest } from './schemas';

const fmt = (v: number, d = 1) => v.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 });

export function compassName(deg: number): string {
  const names = ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'];
  return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

export const BRIEFING_SYSTEM = `Kamu adalah analis kebencanaan yang menulis briefing singkat untuk koordinator tim pemadam
kebakaran hutan dan lahan (Manggala Agni / BPBD) di Indonesia.
Aturan:
- Bahasa Indonesia baku, ringkas, tegas, sopan. Tanpa emoji. Tanpa bahasa alarmis.
- Hanya gunakan angka dari data yang diberikan. Jangan mengarang angka, nama, atau lokasi baru.
- Tegaskan bahwa ini prediksi simulasi untuk dukungan keputusan, bukan pengganti penilaian lapangan.
- Format persis tiga bagian dengan judul berikut, masing-masing di baris sendiri:
SITUASI
(2-3 kalimat)
PRIORITAS TINDAKAN
(3-5 butir, tiap butir diawali "- ", urutkan dari paling mendesak)
CATATAN
(1-2 kalimat: asumsi model, risiko api bawah tanah di gambut bila relevan)
- Total maksimal 170 kata.`;

/** Ringkas hasil simulasi menjadi prompt untuk model bahasa. */
export function briefingPrompt(r: BriefingRequest): string {
  const villages = r.villages
    .map(
      (v) =>
        `- ${v.name} (penduduk sekitar ${v.population}): ${
          v.etaHours === null ? 'tidak terjangkau dalam 12 jam' : `api tiba sekitar ${fmt(v.etaHours)} jam`
        }, level ${v.level.toUpperCase()}`,
    )
    .join('\n');
  const recs = r.recommendations.length
    ? r.recommendations
        .map(
          (s) =>
            `- Sekat ${s.label}: skor ${fmt(s.score)}, menurunkan luas terbakar ${fmt(s.reductionPct)}%, margin waktu ${fmt(
              s.marginHours,
            )} jam, panjang ${fmt(s.lengthKm)} km${s.peatBypassRisk ? ', melintasi gambut kering (risiko api bawah tanah)' : ''}`,
        )
        .join('\n')
    : `- Belum ada rekomendasi sekat. ${r.emptyReason ?? ''}`;
  return `Data hasil simulasi ApiRimba AI (prediksi 12 jam):
Wilayah: ${r.scenarioName}, ${r.province}
Angin: ${fmt(r.windMs)} m/s dari arah ${compassName(r.windFromDeg)} (${Math.round(r.windFromDeg)} derajat), api terdorong ke arah ${compassName(
    r.windFromDeg + 180,
  )}
Indeks kekeringan: ${fmt(r.dryness, 2)} (0 basah, 1 sangat kering)
Perkiraan luas terbakar 12 jam tanpa sekat: ${fmt(r.burnedKm2)} km2
${r.burnedKm2WithFirebreak !== null ? `Dengan sekat ${r.appliedFirebreak ?? ''} diterapkan: ${fmt(r.burnedKm2WithFirebreak)} km2` : 'Sekat belum diterapkan.'}
Desa:
${villages}
Rekomendasi sekat bakar:
${recs}

Tulis briefing sesuai format.`;
}

/** Briefing cadangan berbasis aturan, dipakai bila Gemini tidak tersedia. */
export function fallbackBriefing(r: BriefingRequest): string {
  const threatened = r.villages
    .filter((v) => v.etaHours !== null)
    .sort((a, b) => (a.etaHours ?? 99) - (b.etaHours ?? 99));
  const first = threatened[0];
  const best = r.recommendations[0];
  const lines: string[] = [];
  lines.push('SITUASI');
  lines.push(
    `Angin ${fmt(r.windMs)} m/s dari ${compassName(r.windFromDeg)} mendorong api ke arah ${compassName(
      r.windFromDeg + 180,
    )}. Perkiraan luas terbakar dalam 12 jam sekitar ${fmt(r.burnedKm2)} km2${
      first ? `, dengan ${first.name} sebagai desa pertama yang terjangkau (sekitar ${fmt(first.etaHours ?? 0)} jam)` : ''
    }.`,
  );
  lines.push('PRIORITAS TINDAKAN');
  for (const v of threatened.filter((x) => x.level === 'awas' || x.level === 'siaga')) {
    lines.push(`- Siapkan koordinasi evakuasi dan jalur aman untuk ${v.name} (level ${v.level.toUpperCase()}).`);
  }
  if (best) {
    lines.push(
      `- Bangun Sekat ${best.label} (${fmt(best.lengthKm)} km) dalam margin ${fmt(best.marginHours)} jam; perkiraan penurunan luas terbakar ${fmt(
        best.reductionPct,
      )}%.`,
    );
    if (best.peatBypassRisk) lines.push('- Sertakan pembasahan gambut atau sekat kanal di sepanjang sekat.');
  } else {
    lines.push(`- ${r.emptyReason ?? 'Fokuskan sumber daya pada perlindungan permukiman.'}`);
  }
  lines.push('- Pantau perubahan arah angin tiap jam dan jalankan ulang simulasi bila angin bergeser.');
  lines.push('CATATAN');
  lines.push(
    'Briefing ini disusun otomatis dari prediksi simulasi untuk dukungan keputusan, bukan pengganti penilaian di lapangan.',
  );
  return lines.join('\n');
}
