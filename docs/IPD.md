# IPD - ApiRimba AI

Nov 12, 2026 · @Belva & Salma

## Ringkasan dan Strategi Pengerjaan

Rencana ini membagi pembangunan ApiRimba AI menjadi 6 fase kecil yang masing-masing dikerjakan dalam satu sesi Claude Code, diakhiri tes dan commit. Hasilnya selalu bisa dijalankan, jadi demo cadangan ada sejak minggu pertama.

**Aturan emas vibe coding untuk proyek ini**

1. **Simpan 6 dokumen di repositori.** Ekspor PRD, TRD, AFD, DBD, BSD, dan IPD ke Markdown dan taruh di `docs/`. Claude Code membaca dokumen itu sebagai sumber kebenaran.
2. **CLAUDE.md dulu.** Salin isi pada bagian Setup Awal ke `CLAUDE.md` di akar proyek.
3. **Satu fase, satu sesi.** Mulai fase baru dengan sesi bersih, lalu minta Claude membaca CLAUDE.md dan bagian dokumen yang disebut di prompt.
4. **Rencana sebelum kode** untuk tugas besar: minta Claude menyusun rencana dan tunggu persetujuan.
5. **Bangun yang paling berisiko lebih dulu:** mesin simulasi diuji tanpa antarmuka sebelum dipasang ke peta.
6. **Tes dan commit tiap fase.** Jalankan lint, test, dan build; commit kecil dengan pesan jelas.
7. **Periksa hasil sendiri.** Jalankan aplikasi, coba alur demo, dan baca diff sebelum lanjut.

**Hal yang perlu dikonfirmasi tim (mengubah jadwal atau lingkup)**

| Pertanyaan | Mengapa penting |
| --- | --- |
| Tenggat dan bentuk penilaian lomba (demo langsung, video, atau tautan) | Menentukan Gate B dan perlunya rekaman layar |
| Siapa mengerjakan apa (frontend, simulasi, data, presentasi) | Fase 3 dan 4 bisa dipecah ke dua orang |
| Wilayah fokus cerita (Riau saja atau tiga skenario) | Menentukan jumlah data skenario yang disiapkan |
| Boleh memakai data nyata FIRMS saat demo atau hanya data lokal | Menentukan seberapa dalam mode live dites |

## Timeline 4 Minggu

&#91;embedded content: jadwal · 6 fase, 2 gate, 28 hari\]

Jadwal ini memprioritaskan bagian paling berisiko lebih dulu: mesin simulasi dan animasi angin selesai sebelum rekomendasi sekat dan polesan.

| Minggu | Fokus | Yang bisa dilihat di akhir minggu |
| --- | --- | --- |
| 1 | Setup, fondasi, peta 2.5D | Peta miring dengan hotspot dan zona gambut, tema gelap, navbar |
| 2 | Data dan mesin simulasi | Api tumbuh di peta dari simulasi; skenario Riau berjalan |
| 3 | Kontrol angin, partikel, scrubber, desa | Slider angin mengubah area api langsung (Gate A) |
| 4 | Sekat, dashboard, laporan, polish, demo | Alur demo penuh dan mode offline (Gate B) |

**Bila waktu mepet, potong dalam urutan ini (dari yang pertama dikorbankan):**

1. Fitur Could: indikator kesegaran data lanjutan (US-14).
2. Dashboard hotspot (US-13); sisakan feed peringatan di simulator.
3. Laporan (US-11); ganti dengan cetak langsung dari simulator.
4. Mode bandingkan (US-10); tampilkan angka selisih saja.
5. Skenario Kalimantan Tengah dan Sumatera Selatan; cukup Riau.

Jangan dipotong: simulasi 12 jam, slider angin, partikel angin, rekomendasi sekat, dan mode demo offline.

## Fase 0: Setup Awal dan CLAUDE.md

**Siapkan lebih dulu**

- [ ] Node.js LTS terbaru, Git, dan Claude Code terpasang.
- [ ] Akun Supabase (proyek baru, PostGIS aktif), Vercel, dan GitHub.
- [ ] Kunci NASA FIRMS (MAP\_KEY) dari situs FIRMS.
- [ ] Enam dokumen diekspor ke Markdown.

**Perintah awal**

```bash
npx create-next-app@latest apirimba-ai --typescript --tailwind --eslint --app --src-dir --import-alias '@/*'
cd apirimba-ai
npm i maplibre-gl @turf/turf zustand zod recharts comlink date-fns @supabase/supabase-js
npm i -D vitest @playwright/test
npx shadcn@latest init
mkdir docs
# salin PRD.md, TRD.md, AFD.md, DBD.md, BSD.md, IPD.md ke folder docs/
git init && git add -A && git commit -m 'chore: scaffold proyek'
```

**Isi CLAUDE.md (salin ke akar proyek)**

```markdown
# ApiRimba AI

Aplikasi web prediksi sebaran kebakaran hutan dan lahan gambut 12 jam ke depan, dengan rekomendasi sekat bakar. Prototipe kompetisi, harus stabil saat demo.

## Dokumen rujukan (baca bagian yang relevan sebelum bekerja)
- docs/PRD.md: fitur, user story, ruang lingkup
- docs/TRD.md: arsitektur, stack, mesin simulasi, API, struktur folder
- docs/AFD.md: alur pengguna dan state halaman
- docs/DBD.md: token warna, tipografi, komponen, microcopy
- docs/BSD.md: skema database dan RLS
- docs/IPD.md: rencana per fase

## Aturan
- Semua teks antarmuka berbahasa Indonesia. Tanpa emoji.
- TypeScript strict. Jangan memakai any.
- Folder src/lib/sim murni TypeScript: tidak boleh mengimpor React, MapLibre, atau DOM.
- Simulasi berjalan di Web Worker. Hasil cukup berupa arrival map (Int16Array).
- Simulasi deterministik: selalu pakai PRNG dengan seed.
- Arah angin dari cuaca adalah arah ASAL. Mesin memakai arah TUJUAN = (asal + 180) mod 360.
- Satuan: m/s, derajat, km, jam. Format angka id-ID (koma desimal).
- Rahasia (FIRMS_MAP_KEY, SUPABASE_SERVICE_ROLE_KEY) hanya di server. Jangan pernah memakai NEXT_PUBLIC untuk rahasia.
- Setiap data eksternal punya rantai: live, cache, berkas cadangan, dengan timeout 5 detik. Mode demo tidak boleh memanggil jaringan.
- Warna dan font hanya dari token di docs/DBD.md. Jangan menulis hex langsung di komponen.
- Jangan menambah library di luar TRD tanpa bertanya dulu.
- Jangan mengklaim akurasi ilmiah. Tampilkan label 'prediksi simulasi' dan asumsi model.

## Cara bekerja
- Kerjakan satu fase pada satu waktu sesuai docs/IPD.md. Untuk tugas besar, buat rencana dan minta persetujuan dulu.
- Tulis tes untuk logika (terutama src/lib/sim) sebelum atau bersamaan dengan kodenya.
- Sebelum menyatakan selesai: npm run lint && npm run test && npm run build harus lolos.
- Commit kecil dengan pesan format: tipe(area): ringkasan, mis. feat(sim): tambah probabilitas angin.
- Bila ada konflik antar dokumen atau informasi kurang, tanyakan; jangan menebak.
```

## Fase 1: Fondasi (Hari 3-6)

**Tujuan:** kerangka aplikasi, tema gelap, komponen dasar, skema database, dan tipe data siap, sehingga fase berikutnya hanya menambah fitur.

**Tugas**

- [ ] Struktur folder sesuai TRD.
- [ ] Token warna dan font (Inter, JetBrains Mono) sesuai DBD.
- [ ] Komponen dasar: tombol, slider, badge, toast, modal Tentang Model.
- [ ] Navbar, footer, dan halaman placeholder: /, /simulator, /dashboard, /report/\[id\], 404.
- [ ] Tipe TypeScript dan skema Zod untuk entitas inti.
- [ ] Migrasi dan seed Supabase, klien Supabase server dan browser.

**Prompt Claude Code**

```text
Baca CLAUDE.md, lalu docs/TRD.md (bagian Tech Stack dan Struktur Folder), docs/DBD.md (Palet Warna, Tipografi, Komponen UI), dan docs/BSD.md (Skema Tabel, RLS, Seed).

Tugas Fase 1 (fondasi). Buat rencana dulu dan tunggu persetujuan saya, lalu kerjakan:
1. Rapikan struktur folder sesuai TRD (folder kosong boleh diberi .gitkeep).
2. Terapkan token warna Tailwind v4 dari DBD ke src/styles/globals.css, tema gelap sebagai default. Muat font Inter dan JetBrains Mono lewat next/font di layout.tsx.
3. Buat komponen dasar di src/components/ui berbasis shadcn/ui sesuai DBD: Button (primary, secondary, ghost), Slider, Badge status (Waspada, Siaga, Awas, Aman), Toast, dan Modal TentangModel (isi: cara kerja, asumsi, batasan, sumber).
4. Buat Navbar (logo, Simulator, Dashboard, sakelar Mode Demo, ikon info) dan Footer (sumber data dan disclaimer). Buat halaman placeholder untuk /, /simulator, /dashboard, /report/[id], dan not-found.
5. Buat src/types/index.ts dan src/lib/schemas.ts (Zod) untuk: Scenario, Village, PeatZone, Hotspot, WeatherSnapshot, SimInput, SimResult, Recommendation, VillageRisk, Alert.
6. Buat supabase/migrations/0001_init.sql dan 0002_rls.sql dari BSD. Perbaiki sintaks kebijakan RLS: nama kebijakan harus identifier atau memakai kutip ganda. Buat supabase/seed.sql untuk 3 skenario dan desa fiktifnya sesuai BSD. Buat klien Supabase di src/lib/supabase/server.ts (service role) dan client.ts (anon).
7. Buat .env.local.example sesuai TRD (Strategi Testing dan Environment Variables).

Kriteria selesai: npm run lint dan npm run build lolos, semua halaman placeholder terbuka, tema gelap tampil benar. Ringkas perubahan di akhir.
```

**Selesai bila**

- [ ] Aplikasi berjalan dan semua rute terbuka tanpa error.
- [ ] Tema, font, dan komponen dasar sesuai DBD.
- [ ] Migrasi dan seed berjalan di Supabase; tipe terbentuk.
- [ ] Commit: feat: fondasi aplikasi.

## Fase 2: Peta dan Data (Hari 7-11)

**Tujuan:** peta 2.5D yang tampil bagus, dengan hotspot, zona gambut, desa, dan data cuaca; semua dengan rantai cadangan sehingga bisa jalan tanpa internet.

**Tugas**

- [ ] MapView (MapLibre, dimuat dinamis tanpa SSR) dengan relief, pitch 55, dan terbang antar skenario.
- [ ] Lapisan hotspot berdenyut, zona gambut berarsir, penanda desa.
- [ ] Route handler: /api/scenarios, /api/scenarios/\[slug\], /api/hotspots, /api/weather dengan cache dan cadangan.
- [ ] Skrip pembuat grid skenario dan berkas cadangan.
- [ ] Store Zustand untuk skenario, data, dan Mode Demo.

**Prompt Claude Code**

```text
Baca CLAUDE.md, docs/TRD.md (Arsitektur, Integrasi Data Eksternal dan Fallback, Spesifikasi API), docs/DBD.md (Desain Peta, Partikel Angin, dan Area Api) dan docs/AFD.md (Alur Halaman Simulator, State dan Edge Case).

Tugas Fase 2 (peta dan data). Buat rencana dulu, lalu kerjakan:
1. scripts/build-scenario-grid.ts: hasilkan public/data/scenarios/{riau,kalteng,sumsel}.json berisi grid 64x64 (ukuran sel 250 m): kelas bahan bakar per sel, elevasi per sel (versi awal: fungsi bukit lembut sintetis; boleh diganti DEM nanti), indeks kelembapan gambut per sel, 2 sampai 3 titik awal api (ignitions), poligon gambut, dan 4 desa fiktif sesuai tabel seed di docs/BSD.md. Hasilkan juga public/data/fallback/hotspots-{slug}.json dan weather-{slug}.json, serta public/data/geo/*.geojson.
2. Route handler sesuai TRD: /api/scenarios, /api/scenarios/[slug], /api/hotspots (ambil CSV FIRMS di server, parse, cache 30 menit, fallback ke berkas), /api/weather (Open-Meteo, hitung hujan 7 dan 14 hari, cache 60 menit, fallback). Semua respons divalidasi Zod dan memuat source, fetchedAt, stale. Timeout 5 detik.
3. src/components/map/MapView.tsx: MapLibre dimuat dengan dynamic import dan ssr false; gaya peta dari NEXT_PUBLIC_MAP_STYLE_URL dengan gaya gelap minimal tanpa tile sebagai cadangan; terrain raster-dem Terrarium dengan exaggeration 1,5; pitch 55, bearing -20. Lapisan: HotspotLayer (lingkaran berdenyut), PeatLayer (arsir), VillageLayer (ikon dan label).
4. ScenarioPicker yang menerbangkan kamera ke skenario (2 detik, easeInOut). Store Zustand src/stores/simStore.ts untuk skenario aktif, data, status memuat, dan demoMode.
5. Halaman /simulator menampilkan peta, panel kiri (pilihan skenario, lapisan) dan indikator kesegaran data. Mode Demo memaksa semua data dari berkas lokal tanpa panggilan jaringan.

Kriteria selesai: di /simulator peta miring tampil, hotspot berdenyut, zona gambut dan desa terlihat, mengganti skenario menerbangkan kamera, dan dengan Mode Demo aktif serta jaringan dimatikan semuanya tetap tampil. npm run lint, test, build lolos.
```

**Selesai bila**

- [ ] Tiga skenario dapat dipilih dan tampil benar.
- [ ] Hotspot live tampil bila FIRMS tersedia; label Data cadangan muncul bila tidak.
- [ ] Mode Demo bekerja tanpa jaringan (uji dengan mematikan Wi-Fi).
- [ ] Commit: feat: peta 2.5D dan data.

## Fase 3: Simulator Api (Hari 12-18)

**Tujuan:** inti produk. Slider angin mengubah area api secara langsung di peta, dengan partikel angin dan bilah waktu. Selesai fase ini adalah Gate A.

**Tugas**

- [ ] Mesin simulasi murni TypeScript beserta tes unit (dikerjakan dan diuji sebelum UI).
- [ ] Web Worker dengan mode pratinjau dan halus (Monte Carlo), pembatalan permintaan lama.
- [ ] FireLayer yang menggambar arrival map pada waktu t.
- [ ] WindParticles (kanvas), WindControl (slider dan kompas), TimeScrubber.
- [ ] Panel hasil: luas terbakar, desa terdampak dan estimasi jam tiba.

**Prompt 3a: mesin simulasi (tanpa UI)**

```text
Baca CLAUDE.md dan docs/TRD.md bagian Mesin Prediksi Api (Cellular Automata) dengan teliti, termasuk rumus, tabel parameter, konversi arah angin, perilaku gambut, dan pseudo-code.

Implementasikan mesin di src/lib/sim (engine.ts, params.ts, rng.ts, grid.ts, risk.ts) tanpa impor React atau MapLibre:
- rng.ts: mulberry32 dengan seed.
- engine.ts: runSimulation(input, seed) mengembalikan arrival (Int16Array) sesuai TRD; runMonteCarlo(input, seeds) mengembalikan peta peluang terbakar dan waktu tiba rata-rata.
- Konversi arah angin ASAL ke TUJUAN. Hanya sel menyala (daftar aktif) yang diproses tiap langkah.
- Perilaku gambut: durasi bara 4x pada gambut kering dan peluang tembus sekat (tryPeatBypass).
- risk.ts: estimasi jam tiba per desa dan level (aman, waspada, siaga, awas) dengan ambang dari BSD.
Tulis tes Vitest di tests/unit/engine.test.ts: seed sama memberi arrival identik; api tidak menembus sel air; angin ke timur membuat luas ke timur lebih besar daripada ke barat; sekat non-gambut menghentikan api; sekat di gambut kering kadang ditembus; kecepatan angin lebih tinggi memperbesar luas terbakar rata-rata; simulasi 12 jam pada grid 64x64 selesai kurang dari 2 detik. Jalankan tes sampai lolos dan laporkan angka waktu.
```

**Prompt 3b: worker dan antarmuka**

```text
Baca docs/TRD.md (Arsitektur, Performa), docs/AFD.md (Alur Halaman Simulator dan State, Error, Edge Case), dan docs/DBD.md (Desain Peta, Partikel Angin, dan Area Api; Komponen UI).

Tugas: pasang mesin ke antarmuka.
1. src/workers/sim.worker.ts dengan Comlink: metode preview(input) (1 run) dan refine(input) (12 run), keduanya membawa id permintaan; hasil lama dibuang bila id berubah.
2. Store: windMs, windFromDeg, timeHour, isPlaying, result, status. Slider memicu preview setelah debounce 120 ms dan refine 300 ms setelah berhenti.
3. FireLayer: gambar area api pada waktu t dari arrival map (menyala, terbakar, peluang) sesuai warna DBD; crossfade 300 ms dari pratinjau ke halus.
4. WindParticles: kanvas di atas peta, 2500 partikel, jejak memudar, kecepatan sebanding angin, dapat dimatikan, otomatis dikurangi bila FPS di bawah 20, statis bila reduced motion.
5. WindControl (slider 0-20 m/s dan kompas), TimeScrubber (0-12 jam, putar, jeda, 1x 2x 4x), panel hasil (luas terbakar, daftar desa dengan estimasi jam tiba), sakelar lapisan.
Kriteria: menggeser slider angin mengubah area api dalam kurang dari 500 ms dan animasi minimal 30 FPS di laptop biasa. Jalankan lint, test, build.
```

**Selesai bila (Gate A)**

- [ ] Demo menit 0:50 sampai 1:30 pada skenario Riau berjalan mulus: slider angin mengubah area api, desa berubah status.
- [ ] Semua tes mesin lolos; waktu simulasi di bawah 2 detik.
- [ ] Hasil identik tiap kali dijalankan dengan seed yang sama.
- [ ] Commit: feat: simulator api.

## Fase 4: Sekat Bakar dan Rekomendasi (Hari 19-23)

**Tujuan:** fitur pembeda: sistem menguji banyak kandidat sekat dan menampilkan tiga terbaik, lalu pengguna menerapkan dan membandingkannya.

**Tugas**

- [ ] Algoritma rekomendasi sekat di worker dengan progres.
- [ ] RecommendationCards dan FirebreakLayer.
- [ ] Terapkan sekat, batalkan, dan mode Bandingkan (peta terbelah).
- [ ] Feed peringatan desa dan status Tidak ada sekat valid.

**Prompt Claude Code**

```text
Baca CLAUDE.md, docs/TRD.md bagian Rekomendasi Sekat Bakar (Firebreak), docs/AFD.md (Alur Halaman Simulator: baris Rekomendasikan Sekat, Terapkan, Bandingkan; State, Error, dan Edge Case) dan docs/DBD.md (kartu rekomendasi, sekat bakar, mode bandingkan).

Tugas Fase 4. Buat rencana dulu, lalu kerjakan:
1. src/lib/sim/firebreak.ts sesuai TRD: baseline Monte Carlo, risiko L0 dengan bobot tutupan, pembuatan kandidat (jarak di depan front, rotasi, panjang, geser lateral), penyaringan (air, margin waktu dengan waktu bangun 4 jam), evaluasi cepat 6 run, evaluasi halus 20 run untuk 10 terbaik, skor, dan pemilihan 3 yang beragam (jarak minimal 1 km). Tandai peatBypassRisk dan tambahkan catatan pembasahan bila sekat banyak di gambut kering.
2. Tambahkan ke worker metode recommend(input, onProgress) yang melaporkan progres tiap 10 kandidat dan dapat dibatalkan.
3. Tes di tests/unit/firebreak.test.ts: kandidat dengan margin negatif dibuang; tiga hasil saling berjarak minimal 1 km; menerapkan sekat terbaik menurunkan luas terbakar rata-rata pada skenario Riau seed tetap; hasil deterministik.
4. UI: RecommendationCards (peringkat, skor, panjang, margin waktu, penurunan luas, tombol Terapkan), FirebreakLayer (garis, label, animasi menggambar 600 ms), tombol Rekomendasikan Sekat dengan progress bar, tombol Batalkan sekat, dan mode Bandingkan (peta terbelah dengan kamera sinkron dan selisih angka).
5. Desa dan peringatan: VillageList dengan estimasi jam tiba dan level; AlertFeed di panel kanan; pesan khusus saat tidak ada sekat valid sesuai AFD.
Kriteria: rekomendasi selesai kurang dari 5 detik; sekat yang diterapkan menurunkan luas terbakar di skenario Riau (catat persentase dan tampilkan di kartu). Jalankan lint, test, build.
```

**Selesai bila**

- [ ] Demo menit 2:00 sampai 2:50 berjalan: rekomendasi, terapkan, bandingkan.
- [ ] Penurunan luas terbakar pada Riau minimal sekitar 20 persen (bila kurang, tala parameter, bukan hasilnya).
- [ ] Tes firebreak lolos.
- [ ] Commit: feat: rekomendasi sekat bakar.

## Fase 5: Dashboard, Laporan, Polish, dan Demo (Hari 24-28)

**Tujuan:** melengkapi halaman, menyimpan hasil, memoles tampilan, dan memastikan demo tahan gangguan. Selesai fase ini adalah Gate B.

**Tugas**

- [ ] Halaman Landing sesuai AFD dan DBD.
- [ ] Dashboard hotspot dengan filter dan feed peringatan.
- [ ] API simpan dan baca simulasi, halaman laporan dengan gaya cetak.
- [ ] Semua state error dan edge case dari AFD.
- [ ] Polish: animasi, aksesibilitas, performa, mode ringan.
- [ ] Uji E2E, deploy Vercel, rekaman layar cadangan.

**Prompt 5a: landing, dashboard, laporan**

```text
Baca CLAUDE.md, docs/AFD.md (Alur Halaman Landing, Dashboard, Laporan), docs/DBD.md (Wireframe, Komponen, Tone of Voice dan Microcopy), docs/TRD.md (Spesifikasi API Endpoint) dan docs/BSD.md (Pemetaan Tabel ke Endpoint API).

Tugas:
1. Landing (/): hero dengan pratinjau canvas ringan dan partikel angin, kartu masalah, cara kerja, sumber data, ajakan kedua. Tanpa MapLibre penuh.
2. Dashboard (/dashboard): tabel hotspot dengan filter skenario, keyakinan, dan rentang 24/48/72 jam; peta ringkasan; feed peringatan; tombol Simulasikan yang aktif hanya bila titik berada di area skenario.
3. API: POST /api/simulations (validasi Zod, simpan ke simulations, firebreak_recommendations, village_risks, buat alerts sesuai BSD) dan GET /api/simulations/[id], memakai service role di server.
4. Laporan (/report/[id]) sesuai AFD dengan tombol Cetak, Salin Tautan, dan gaya cetak A4 berlatar putih.
5. Tombol Simpan dan Laporan di simulator.
Jalankan lint, test, build.
```

**Prompt 5b: ketahanan, polish, dan demo**

```text
Baca docs/AFD.md (State, Error, dan Edge Case; Alur Demo Panggung dan Cadangan), docs/DBD.md (Responsif, Aksesibilitas, dan Kontras) dan docs/PRD.md (Skenario Demo, Kebutuhan Non-Fungsional).

Tugas:
1. Implementasikan semua baris tabel State, Error, dan Edge Case di AFD (data cadangan, offline, WebGL, worker error, mode ringan, tidak ada sekat valid, laporan tidak ditemukan, reduced motion, bottom sheet di bawah 768 px).
2. Mode Demo: sakelar global; saat aktif, tidak ada panggilan jaringan, skenario dan hasil sekat preset tersedia.
3. Aksesibilitas sesuai DBD: fokus terlihat, keyboard untuk slider dan scrubber, aria-live untuk hasil, Panel Ringkasan Teks, kontras.
4. Performa: periksa FPS, ukuran bundel, dan waktu muat halaman simulator; kurangi yang berlebihan.
5. Tes E2E Playwright tests/e2e/demo-flow.spec.ts untuk alur demo penuh dan satu tes mode offline.
6. Siapkan README: cara menjalankan, variabel lingkungan, dan skrip demo.
Jalankan lint, test, build, dan E2E; laporkan hasil.
```

**Selesai bila (Gate B)**

- [ ] Alur demo 3 menit berjalan dari awal sampai akhir tiga kali berturut-turut tanpa gangguan.
- [ ] Mode offline dan rekaman layar cadangan siap.
- [ ] Deploy Vercel berjalan dan variabel lingkungan benar.
- [ ] Commit dan tag: v1.0-demo.

## Checklist QA dan Demo

**QA fungsional**

- [ ] Setiap user story berprioritas Must (US-01 sampai US-05, US-07, US-08, US-12) memenuhi acceptance criteria di PRD.
- [ ] Tiga skenario berjalan; hasil sama pada seed yang sama.
- [ ] Arah angin: mengubah ke arah desa memperpendek estimasi jam tiba, menjauh memperpanjang.
- [ ] Sekat yang diterapkan menurunkan luas terbakar dan mengubah status desa sesuai.
- [ ] Laporan dapat dibuka dari tautan dan dicetak ke PDF.

**QA teknis**

- [ ] npm run lint, test, build, dan E2E lolos.
- [ ] Simulasi 12 jam kurang dari 2 detik; rekomendasi kurang dari 5 detik; animasi minimal 30 FPS.
- [ ] Tidak ada rahasia di bundel klien (periksa Network dan kode sumber).
- [ ] RLS aktif; klien anon tidak bisa membaca atau menulis tabel hasil.
- [ ] Tidak ada galat di console pada alur demo.

**QA tampilan dan aksesibilitas**

- [ ] Tampil benar di 1280 x 720 (proyektor) dan layar penuh laptop.
- [ ] Kontras, fokus keyboard, dan reduced motion sesuai DBD.
- [ ] Semua teks berbahasa Indonesia dan sesuai microcopy.

**Checklist demo (H-1 dan hari H)**

- [ ] Jalankan seluruh alur 3 kali; waktu total sekitar 3 menit.
- [ ] Cache terisi (jalankan skenario Riau sekali dengan internet).
- [ ] Mode Demo diuji tanpa internet.
- [ ] Rekaman layar cadangan tersimpan di perangkat dan tab terpisah.
- [ ] Build lokal cadangan siap (npm run build lalu npm start).
- [ ] Baterai penuh, notifikasi mati, layar tidak tidur.
- [ ] Kalimat pembuka dan penutup dihafal; jawaban untuk 5 pertanyaan juri disiapkan: akurasi model, sumber data, skalabilitas, siapa penggunanya, rencana kalibrasi.

## Tips Vibe Coding dan Troubleshooting

**Tips bekerja dengan Claude Code**

- Mulai tiap fase dengan sesi bersih dan prompt dari dokumen ini; bila konteks mulai penuh, ringkas lalu lanjutkan atau mulai sesi baru yang membaca CLAUDE.md lagi.
- Minta rencana dulu untuk tugas besar, baca, lalu setujui atau koreksi.
- Jika hasil kurang tepat, kutip bagian dokumen yang dilanggar dan minta perbaikan, bukan menulis ulang prompt dari nol.
- Tempel pesan galat lengkap atau tangkapan layar saat meminta perbaikan.
- Baca diff sebelum commit; tolak library baru yang tidak ada di TRD.
- Tala parameter model (p0, durasi bara, bobot) di satu berkas params.ts, jangan tersebar.
- Rekam layar tiap akhir fase sebagai cadangan demo.

**Masalah umum**

| Gejala | Penyebab umum | Perbaikan |
| --- | --- | --- |
| Api menjalar ke arah terbalik | Arah ASAL angin dipakai langsung | Ubah ke arah TUJUAN: (asal + 180) mod 360 |
| Peta kosong atau tidak muncul | CSS MapLibre belum diimpor, atau render di server | Impor maplibre-gl/dist/maplibre-gl.css; dynamic import dengan ssr false |
| Terrain tidak tampil | setTerrain dipanggil sebelum style siap, atau encoding salah | Panggil setelah event load; sumber raster-dem dengan encoding terrarium |
| Worker gagal dimuat | Cara impor worker di Next | new Worker(new URL('../workers/sim.worker.ts', import.meta.url)) di komponen klien |
| Animasi patah-patah | Grid terlalu besar, partikel berlebih, simulasi di main thread | Grid 64, partikel 1200, pastikan di worker, gunakan typed array |
| Hasil berbeda tiap run | Math.random dipakai | Ganti ke PRNG ber-seed |
| FIRMS gagal dari browser | CORS dan kunci terlihat | Panggil dari route handler di server |
| Galat hydration | Nilai waktu atau acak berbeda antara server dan klien | Render bagian itu hanya di klien |
| Supabase permission denied saat simpan | Memakai anon key untuk menulis | Tulis dari route handler dengan service role |
| Sekat tidak berpengaruh | Sel sekat tidak ditandai blocked, atau gambut kering tembus | Periksa status 3 pada grid; tes unit sekat non-gambut |
| Slider terasa lambat | Refine dipicu tiap gerakan | Debounce dan batalkan permintaan lama dengan id |

Bila bagian dokumen perlu diubah (mis. parameter berubah), perbarui dokumen di docs/ lebih dulu agar Claude Code selalu membaca versi terbaru.
