# TRD - ApiRimba AI

Nov 12, 2026 · @Belva & Salma

## Ringkasan Teknis dan Prinsip

ApiRimba AI adalah aplikasi Next.js dengan simulasi yang berjalan di browser (Web Worker) dan Supabase hanya untuk data skenario, cache, dan penyimpanan hasil. Tujuannya satu: demo yang cepat, konsisten, dan tidak gagal di depan juri.

**Prinsip desain**

1. **Demo-safe:** setiap data eksternal punya rantai cadangan (live, cache, file lokal) dan timeout 5 detik.
2. **Simulasi di klien:** cellular automata dijalankan di Web Worker agar slider angin terasa instan dan UI tidak macet.
3. **Deterministik:** PRNG dengan seed tetap, sehingga skenario demo selalu menghasilkan peta yang sama.
4. **Sederhana dulu:** model grid yang bisa dijelaskan ke juri, bukan fisika penuh. Parameter ditala secara visual, bukan diklaim akurat.
5. **Server tipis:** route handler hanya untuk menyembunyikan kunci API, caching, dan menyimpan hasil.
6. **Satu sumber tipe:** tipe TypeScript dan skema Zod dipakai bersama klien, worker, dan API.

## Arsitektur Sistem

&#91;embedded content: arsitektur · 3 zona, 4 jalur data\]

Data mengalir dari sumber eksternal ke route handler (cache dan cadangan), lalu ke store di browser; Web Worker menghitung simulasi dan hasilnya disimpan ke Supabase lewat /api/simulations.

| Komponen | Tanggung jawab | Tidak boleh |
| --- | --- | --- |
| Peta 2.5D (MapLibre) | Menggambar relief, hotspot, area api, sekat, dan partikel angin | Menghitung simulasi di main thread |
| Web Worker | Simulasi, Monte Carlo, dan rekomendasi sekat | Mengakses DOM atau jaringan |
| Store Zustand | Satu sumber state untuk kontrol, waktu, dan hasil | Menyimpan data besar berulang (cukup arrival map) |
| Route handler | Menyembunyikan kunci, cache, validasi, dan cadangan | Menjalankan simulasi |
| Supabase | Skenario, cache hotspot, dan hasil simulasi | Diakses tulis langsung dari klien |

## Tech Stack dan Library

Versi adalah minimum; saat instalasi pakai rilis stabil terbaru dan kunci lewat lockfile.

| Lapisan | Teknologi | Versi minimum | Alasan |
| --- | --- | --- | --- |
| Framework | Next.js (App Router) | 15 | Satu proyek untuk halaman dan API, deploy mudah di Vercel |
| UI | React + TypeScript (strict) | 19 / 5 | Tipe aman, cocok untuk vibe coding |
| Styling | Tailwind CSS | 4 | Cepat membuat tema gelap dan token desain |
| Komponen dasar | shadcn/ui (Radix) | terbaru | Slider, tab, dialog, tooltip yang aksesibel |
| Peta | MapLibre GL JS | 5 | Peta vektor, terrain 2.5D, tanpa token berbayar |
| Geospasial | Turf.js (@turf/turf) | 7 | Buffer, jarak, poligon, titik dalam poligon |
| State | Zustand | 5 | Store ringan untuk kontrol, waktu, dan hasil |
| Validasi | Zod | 3 | Validasi respons API dan skenario |
| Grafik | Recharts | 2 | Grafik luas terbakar dan garis waktu di dashboard |
| Worker | Web Worker native + Comlink | 4 | Memanggil fungsi simulasi seperti fungsi biasa |
| Database | Supabase (PostgreSQL + PostGIS) | terbaru | Skenario, hotspot cache, hasil simulasi |
| Klien DB | @supabase/supabase-js | 2 | Akses dari route handler |
| Tanggal | date-fns | 4 | Format waktu zona Asia/Jakarta |
| Pengujian | Vitest + Playwright | 3 / terbaru | Uji mesin simulasi dan alur demo |
| Hosting | Vercel + Supabase Cloud | - | Gratis untuk prototipe, deploy dari Git |

## Struktur Folder Proyek

Mesin simulasi (`src/lib/sim`) tidak boleh mengimpor React atau MapLibre, supaya mudah diuji dan dijalankan di worker.

```text
apirimba-ai/
├─ CLAUDE.md                      # aturan proyek untuk Claude Code
├─ .env.local.example
├─ supabase/
│  ├─ migrations/0001_init.sql
│  ├─ migrations/0002_rls.sql
│  └─ seed.sql
├─ scripts/
│  └─ build-scenario-grid.ts      # bake DEM, bahan bakar, gambut menjadi grid JSON
├─ public/data/
│  ├─ scenarios/{riau,kalteng,sumsel}.json
│  ├─ fallback/hotspots-{slug}.json
│  ├─ fallback/weather-{slug}.json
│  └─ geo/{peat,villages,roads}-{slug}.geojson
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx                 # landing
│  │  ├─ simulator/page.tsx       # halaman inti
│  │  ├─ dashboard/page.tsx       # hotspot dan peringatan
│  │  ├─ report/[id]/page.tsx     # laporan siap cetak
│  │  └─ api/
│  │     ├─ hotspots/route.ts
│  │     ├─ weather/route.ts
│  │     ├─ scenarios/route.ts
│  │     ├─ scenarios/[slug]/route.ts
│  │     ├─ simulations/route.ts
│  │     └─ simulations/[id]/route.ts
│  ├─ components/
│  │  ├─ map/        (MapView, WindParticles, FireLayer, HotspotLayer, FirebreakLayer)
│  │  ├─ controls/   (WindControl, TimeScrubber, ScenarioPicker, LayerToggles)
│  │  ├─ panels/     (AlertFeed, VillageList, RecommendationCards, StatsPanel)
│  │  └─ ui/         (komponen shadcn)
│  ├─ lib/
│  │  ├─ sim/        (engine.ts, params.ts, rng.ts, grid.ts, firebreak.ts, risk.ts)
│  │  ├─ geo/        (project.ts, raster.ts)
│  │  ├─ data/       (firms.ts, openmeteo.ts, fallback.ts)
│  │  ├─ supabase/   (server.ts, client.ts)
│  │  └─ schemas.ts  (Zod)
│  ├─ workers/sim.worker.ts
│  ├─ stores/simStore.ts
│  ├─ types/index.ts
│  └─ styles/globals.css
└─ tests/
   ├─ unit/         (engine.test.ts, firebreak.test.ts)
   └─ e2e/          (demo-flow.spec.ts)
```

## Mesin Prediksi Api (Cellular Automata)

Mesin memodelkan area sebagai grid sel. Tiap 15 menit, sel yang menyala dapat menyalakan 8 tetangganya dengan probabilitas yang bergantung pada angin, lereng, bahan bakar, dan kelembapan. Pendekatannya terinspirasi dari model cellular automata kebakaran hutan di literatur (mis. Alexandridis dkk., 2008); semua koefisien adalah nilai awal yang perlu ditala, bukan hasil kalibrasi.

**Parameter grid**

| Parameter | Nilai awal | Catatan |
| --- | --- | --- |
| Ukuran grid | 64 x 64 sel (maks 96 x 96) | Cukup ringan untuk Web Worker |
| Ukuran sel | 250 m | 64 sel setara area sekitar 16 km |
| Langkah waktu | 15 menit | 48 langkah = 12 jam |
| Tetangga | 8 arah | Diagonal berbobot 1/akar 2 |
| Seed acak | Tetap per skenario | PRNG mulberry32 |

**Status sel:** 0 tidak terbakar, 1 menyala, 2 sudah terbakar, 3 sekat bakar, 4 tidak mudah terbakar (air, permukiman padat).

**Probabilitas penyalaan satu tetangga per langkah**

```latex
p = \min\left(0.95,\; p_0 \cdot f_{bahan} \cdot f_{angin} \cdot f_{lereng} \cdot f_{lembap} \cdot f_{jarak}\right)
```

```latex
f_{angin} = e^{c_1 V} \cdot e^{c_2 V (\cos\varphi - 1)}, \quad f_{lereng} = e^{a\,\theta}
```

| Simbol | Arti | Nilai awal |
| --- | --- | --- |
| p0 | Probabilitas dasar per langkah | 0,30 (tala agar api terlihat realistis) |
| V | Kecepatan angin (m/s) | Dari slider atau Open-Meteo |
| phi | Sudut antara arah angin bertiup ke dan arah sel menyala ke tetangga | Dihitung per pasangan sel |
| c1, c2 | Koefisien angin | 0,045 dan 0,131 |
| theta | Sudut lereng ke arah tetangga, dibatasi -30 sampai 30 derajat | Dari DEM |
| a | Koefisien lereng | 0,078 |
| f\_bahan | Faktor bahan bakar per tutupan lahan | Semak 1,2; gambut kering 1,1; hutan sekunder 0,9; sawit 0,8; hutan primer 0,6; lahan terbuka 0,5; permukiman 0,2; air 0 |
| f\_lembap | Faktor kekeringan: 0,4 + 0,8 x D, dengan D dari kelembapan udara dan hujan 7 hari | 0,4 sampai 1,2 |
| f\_jarak | Bobot jarak tetangga | 1 (ortogonal), 0,71 (diagonal) |

**Penting:** arah angin meteorologi (wind\_direction) adalah arah ASAL angin. Ubah dulu menjadi arah TUJUAN: windToDeg = (windFromDeg + 180) mod 360. Kesalahan ini membuat api menjalar ke arah terbalik.

**Gambut.** Sel gambut dengan indeks kelembapan gambut rendah (proksi dari hujan 14 hari: m = min(hujan14 / 150, 1)) menyala lebih lama (durasi bara 4 kali lipat sel biasa) dan dapat menembus sekat: bila sel menyala bersebelahan dengan sel sekat di zona gambut dan m kurang dari 0,4, ada peluang q = 0,35 x (1 - m) per langkah untuk menyalakan sel di sisi seberang sekat. Ini memodelkan api bawah tanah dan menjadi alasan sekat di gambut perlu disertai pembasahan.

**Mode hitung**

| Mode | Isi | Kapan dipakai |
| --- | --- | --- |
| Pratinjau | 1 run, seed tetap | Saat slider digeser (target kurang dari 150 ms) |
| Halus | 12 run Monte Carlo, hasil berupa peta peluang terbakar dan waktu tiba rata-rata | 300 ms setelah slider berhenti |
| Evaluasi sekat | 6 sampai 20 run per kandidat | Saat tombol Rekomendasikan ditekan |

**Pseudo-code inti (src/lib/sim/engine.ts)**

```ts
export function runSimulation(inp: SimInput, seed: number): SimResult {
  const rng = mulberry32(seed);
  const { w, h, steps } = inp.grid;               // 64, 64, 48
  const arrival = new Int16Array(w * h).fill(-1);  // -1 = tidak terbakar
  const burnUntil = new Int16Array(w * h);
  let active: number[] = [];
  for (const i of inp.ignitions) {
    arrival[i] = 0;
    burnUntil[i] = burnDuration(inp, i);
    active.push(i);
  }
  for (let t = 1; t <= steps; t++) {
    const ignited: number[] = [];
    const still: number[] = [];
    for (const i of active) {
      for (const n of neighbors8(i, w, h)) {
        if (arrival[n] !== -1 || inp.blocked[n]) continue;
        if (inp.firebreak[n]) {
          tryPeatBypass(inp, i, n, t, rng, arrival, burnUntil, ignited);
          continue;
        }
        if (rng() < ignitionProb(inp, i, n)) {
          arrival[n] = t;
          burnUntil[n] = t + burnDuration(inp, n);
          ignited.push(n);
        }
      }
      if (burnUntil[i] > t) still.push(i);
    }
    active = still.concat(ignited);
  }
  return { arrival, steps };
}

function ignitionProb(inp: SimInput, from: number, to: number): number {
  const diag = isDiagonal(from, to, inp.grid.w) ? Math.SQRT1_2 : 1;
  const phi = angleDiff(inp.windToDeg, bearing(from, to, inp.grid.w));
  const V = inp.windMs;
  const fWind = Math.exp(0.045 * V) * Math.exp(0.131 * V * (Math.cos(phi) - 1));
  const slope = clamp(slopeDeg(inp, from, to), -30, 30);
  const fSlope = Math.exp(0.078 * slope);
  const p = P0 * inp.fuel[to] * fWind * fSlope * inp.moisture[to] * diag;
  return Math.min(0.95, p);
}
```

Keluaran hanya peta waktu tiba (arrival). Status pada waktu t dihitung saat menggambar: menyala bila arrival kurang dari atau sama dengan t dan arrival + durasi lebih dari t, sudah terbakar bila sebaliknya. Ini membuat scrubber waktu murah dan tidak perlu menyimpan 48 frame.

## Rekomendasi Sekat Bakar (Firebreak)

Sekat dipilih dengan cara sederhana yang bisa dijelaskan: coba banyak kandidat, simulasikan ulang dengan sekat itu, lalu pilih yang paling banyak menurunkan risiko.

1. **Baseline.** Jalankan mode halus (12 run). Hitung peluang terbakar P(c) dan waktu tiba rata-rata T(c) untuk tiap sel c.
2. **Risiko dasar.** L0 = jumlah dari P(c) x bobot(c). Bobot per tutupan: permukiman 100, perkebunan 10, gambut 5, hutan 3, lainnya 1 (nilai awal, dapat diubah).
3. **Kandidat.** Tentukan vektor sebaran dominan d dari pusat titik awal ke pusat sel dengan P lebih dari 0,5. Buat garis tegak lurus d pada jarak 8, 12, 16, 20, dan 24 sel di depan front api, dengan rotasi -30, 0, dan +30 derajat, panjang 4, 6, dan 8 sel, serta geser lateral -2 sampai 2 sel. Lebar sekat 2 sel (sekitar 500 m). Kira-kira 200 sampai 250 kandidat.
4. **Saring.** Buang kandidat yang menyentuh air, atau yang diperkirakan dilewati api sebelum waktu bangun tersedia: T(garis) dikurangi waktu bangun (default 4 jam) harus positif.
5. **Evaluasi cepat.** Untuk tiap kandidat, jalankan 6 run dengan sel sekat berstatus 3, hitung L. Efektivitas E = (L0 - L) / L0.
6. **Evaluasi halus.** Ambil 10 kandidat terbaik, jalankan 20 run, hitung E ulang.
7. **Skor (0-100).** Skor = 100 x E x min(1, margin\_jam / waktu\_bangun\_jam) - 3 x panjang\_km. Margin adalah selisih waktu tiba api di garis dan waktu bangun.
8. **Pilih 3 beragam.** Ambil skor tertinggi, lalu kandidat berikutnya yang jaraknya minimal 1 km dari yang sudah dipilih.
9. **Catatan gambut.** Bila lebih dari separuh garis berada di gambut dengan kelembapan rendah, tampilkan saran tambahan: sekat kanal dan pembasahan (rewetting), karena api bawah tanah dapat melewati sekat permukaan.

**Keluaran per rekomendasi:** garis (GeoJSON LineString), panjang (km), margin waktu (jam), penurunan luas terbakar (%), desa yang terselamatkan, skor, dan alasan satu kalimat.

**Anggaran waktu:** target selesai kurang dari 5 detik dengan progress bar. Mesin hanya memproses sel yang sedang menyala (daftar aktif), bukan seluruh grid, supaya evaluasi 250 kandidat tetap ringan. Worker mengirim pesan progres tiap 10 kandidat.

## Integrasi Data Eksternal dan Fallback

Semua panggilan lewat route handler Next.js (menyembunyikan kunci, memberi cache, dan menyeragamkan format). Urutan sumber selalu: live, lalu cache, lalu file cadangan di `public/data/fallback`.

| Data | Sumber | Contoh pemanggilan | Cache | Cadangan |
| --- | --- | --- | --- | --- |
| Hotspot | NASA FIRMS Area API (VIIRS\_SNPP\_NRT, VIIRS\_NOAA20\_NRT) | `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/VIIRS_SNPP_NRT/{barat,selatan,timur,utara}/1` | 30 menit (s-maxage) | `fallback/hotspots-{slug}.json` |
| Cuaca dan angin | Open-Meteo Forecast API | `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m,precipitation&wind_speed_unit=ms&past_days=14&forecast_days=2&timezone=Asia%2FJakarta` | 60 menit | `fallback/weather-{slug}.json` |
| Relief (visual 2.5D) | Tile terrain Terrarium (AWS Open Data) di MapLibre | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | Browser | Tanpa terrain, peta datar |
| Relief (simulasi) | Sampel DEM per sel | Dibuat sekali lewat `scripts/build-scenario-grid.ts` | Statis | Ada di `scenarios/{slug}.json` |
| Gambut, tutupan lahan, desa | Poligon disederhanakan per skenario | File GeoJSON statis | Statis | Sama dengan sumber |
| Peta dasar | Gaya vektor gratis (mis. OpenFreeMap) atau MapTiler dengan kunci gratis; cek ketentuan atribusi | URL gaya di `NEXT_PUBLIC_MAP_STYLE_URL` | Browser | Gaya gelap minimal tanpa tile untuk mode demo |

**Aturan fallback**

1. Timeout 5 detik per panggilan; satu kali ulang.
2. Respons selalu memuat `source`, `fetchedAt`, dan `stale` (benar bila memakai cache atau cadangan).
3. UI menampilkan label 'Data cadangan' bila `stale` benar.
4. Mode demo (NEXT\_PUBLIC\_DEMO\_MODE=true atau tombol di UI) tidak memanggil jaringan sama sekali.
5. Kolom CSV FIRMS yang dipakai: latitude, longitude, acq\_date, acq\_time, confidence, frp, satellite. Waktu acq\_time adalah UTC.

**Catatan data:** poligon gambut dan tutupan lahan pada MVP adalah penyederhanaan untuk ilustrasi dan harus diberi label demikian di antarmuka. Untuk rilis sungguhan, ganti dengan data resmi dan lakukan kalibrasi model.

## Spesifikasi API Endpoint

Semua respons JSON, divalidasi dengan Zod, dan memakai format kesalahan seragam `{ error: { code, message } }`.

| Method | Path | Fungsi | Query atau body | Cache |
| --- | --- | --- | --- | --- |
| GET | /api/scenarios | Daftar skenario (slug, nama, pusat, bbox) | - | 1 jam |
| GET | /api/scenarios/\[slug\] | Detail skenario: grid, ignitions, desa, gambut, preset angin | - | 1 jam |
| GET | /api/hotspots | Hotspot FIRMS untuk skenario | `scenario` (wajib), `days` (1-3, default 1) | 30 menit |
| GET | /api/weather | Cuaca per jam dan indeks kelembapan | `scenario` atau `lat` dan `lon` | 60 menit |
| POST | /api/simulations | Simpan hasil simulasi dan rekomendasi | Body: SimulationSave | Tanpa cache |
| GET | /api/simulations/\[id\] | Ambil simulasi tersimpan untuk laporan | - | 5 menit |

**Contoh respons /api/hotspots**

```json
{
  "source": "nasa-firms",
  "fetchedAt": "2026-11-12T08:00:00Z",
  "stale": false,
  "items": [
    { "id": "h_001", "lat": -0.52, "lon": 101.44, "acquiredAt": "2026-11-12T05:42:00Z", "confidence": "high", "frp": 12.3, "satellite": "VIIRS" }
  ]
}
```

**Contoh body POST /api/simulations**

```json
{
  "scenarioSlug": "riau",
  "params": { "windMs": 8, "windFromDeg": 120, "seed": 20261112, "steps": 48 },
  "result": { "burnedCellsByStep": [4, 9, 15], "villagesAtRisk": [{ "villageId": "v_03", "etaHours": 5.5 }] },
  "recommendations": [
    { "rank": 1, "line": { "type": "LineString", "coordinates": [[101.40, -0.50], [101.43, -0.52]] }, "score": 78, "reductionPct": 31, "lengthKm": 1.5 }
  ]
}
```

**Kode kesalahan:** `bad_request` (400), `not_found` (404), `upstream_failed` (502, hanya bila cadangan pun tidak ada), `rate_limited` (429), `internal` (500).

## Performa, Keamanan, dan Deployment

**Performa**

- Simulasi dan evaluasi sekat di Web Worker; data grid memakai typed array (Uint8Array, Int16Array, Float32Array).
- Partikel angin di satu elemen canvas di atas peta, maksimal 3000 partikel, devicePixelRatio dibatasi 2, dihentikan saat tab tidak aktif.
- Slider dibuat debounce 120 ms untuk pratinjau dan 300 ms untuk mode halus; hasil lama dibatalkan bila ada perubahan baru (id permintaan).
- Area api digambar sebagai satu sumber GeoJSON yang diperbarui per langkah (hanya sel menyala dan terbakar), atau sebagai canvas bila FPS turun.
- MapLibre dimuat dinamis (`dynamic`, `ssr: false`); halaman landing tidak memuat peta penuh.

**Keamanan**

- `FIRMS_MAP_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` hanya ada di variabel server; tidak diawali NEXT\_PUBLIC.
- Semua input query dan body divalidasi Zod; batasi `days`, ukuran body, dan panjang array.
- RLS aktif di semua tabel (lihat BSD); klien hanya memakai anon key dengan hak baca.
- Batas laju sederhana per IP di route yang menyimpan data.
- Tidak ada data pribadi dan tidak ada login pada MVP.

**Deployment**

1. Buat proyek Supabase, aktifkan ekstensi PostGIS, jalankan migrasi dan seed.
2. Daftarkan MAP\_KEY FIRMS (gratis).
3. Hubungkan repositori ke Vercel, isi environment variables, deploy dari branch main.
4. Setelah deploy, jalankan uji asap: buka /simulator, aktifkan mode demo, jalankan skenario Riau.
5. Simpan juga build lokal (`npm run build && npm start`) dan rekaman layar sebagai cadangan demo.

## Strategi Testing dan Environment Variables

**Pengujian**

| Jenis | Alat | Yang diuji |
| --- | --- | --- |
| Unit | Vitest | Seed sama menghasilkan arrival identik; arah angin asal diubah ke tujuan dengan benar; api tidak menembus air; sekat non-gambut menghentikan api; sekat gambut kering kadang ditembus; slider angin ke arah desa mempercepat waktu tiba |
| Unit | Vitest | Skor rekomendasi turun bila margin waktu negatif; tiga rekomendasi saling berjarak minimal 1 km |
| Performa | Vitest + performance.now | Simulasi 12 jam kurang dari 2 detik; evaluasi sekat kurang dari 5 detik |
| E2E | Playwright | Alur demo: pilih skenario, jalankan, geser angin, rekomendasi, terapkan sekat, buka laporan |
| E2E | Playwright | Mode offline: blokir jaringan, semua skenario tetap jalan |
| Manual | Checklist | Kontras, keyboard, tampilan layar proyektor 1280 x 720 |

**Environment variables (.env.local)**

| Variabel | Sisi | Contoh dan catatan |
| --- | --- | --- |
| NEXT\_PUBLIC\_SUPABASE\_URL | Publik | URL proyek Supabase |
| NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY | Publik | Kunci anon, hak baca lewat RLS |
| SUPABASE\_SERVICE\_ROLE\_KEY | Server | Hanya untuk route handler yang menulis |
| FIRMS\_MAP\_KEY | Server | Kunci NASA FIRMS |
| NEXT\_PUBLIC\_MAP\_STYLE\_URL | Publik | URL gaya peta dasar |
| NEXT\_PUBLIC\_DEMO\_MODE | Publik | false secara default; true memaksa data lokal |
| NEXT\_PUBLIC\_SIM\_SEED | Publik | Seed bawaan, mis. 20261112 |
| NEXT\_PUBLIC\_APP\_URL | Publik | Dipakai untuk tautan laporan |
