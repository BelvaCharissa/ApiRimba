# ApiRimba AI

Aplikasi web prediksi sebaran kebakaran hutan dan lahan gambut 12 jam ke depan, dengan rekomendasi sekat bakar dan AI Briefing (Gemini). Karya lomba IT RUSH 2026: tenggat 20 Nov 2026 23.59 WIB.

@AGENTS.md

## Dokumen rujukan
- docs/PRD.md, TRD.md, AFD.md, DBD.md, BSD.md, IPD.md
- README.md bagian "Model dan batasan" mencatat perubahan dari dokumen rancangan.

## Aturan
- Semua teks antarmuka berbahasa Indonesia. Tanpa emoji.
- TypeScript strict, jangan memakai any.
- src/lib/sim murni TypeScript (tanpa React, MapLibre, DOM). Simulasi berjalan di Web Worker.
- Arah angin cuaca = arah ASAL; mesin memakai TUJUAN = (asal + 180) mod 360.
- Rahasia (GEMINI_API_KEY, FIRMS_MAP_KEY) hanya di server; jangan diawali NEXT_PUBLIC.
- Desain campuran: landing, dashboard, laporan terang (token paper/ink/forest); simulator gelap (kelas .theme-dark).
- Sebelum selesai: npm run lint && npm test && npm run build.
