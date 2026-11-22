# ApiRimba AI

**Lihat ke mana api menjalar, sebelum api sampai.**

ApiRimba AI adalah aplikasi web yang memprediksi arah dan luas sebaran kebakaran hutan dan lahan gambut 12 jam ke depan, lalu merekomendasikan titik sekat bakar (firebreak) yang paling efektif bagi tim pemadam. Karya ini dibuat untuk kompetisi Web Development **IT RUSH 2026**, subtema **Mitigasi Bencana dan Perubahan Iklim**.

> Hasil aplikasi adalah prediksi simulasi untuk dukungan keputusan, bukan pengganti penilaian di lapangan.

## Fitur

| Fitur | Keterangan |
| --- | --- |
| Simulator 2.5D | Peta MapLibre miring dengan relief, zona gambut, sungai, desa, titik panas berdenyut, dan partikel angin |
| Simulasi sebaran 12 jam | Cellular automata grid 64 x 64 (sel 250 m, langkah 15 menit), 12 run Monte Carlo, berjalan di Web Worker |
| Kontrol angin dan kekeringan | Slider kecepatan (0-20 m/s), kompas arah, dan indeks kekeringan; area api diperbarui langsung |
| Rekomendasi sekat bakar (AI optimasi) | Menguji 225 kandidat sekat dengan simulasi ulang, memilih 3 terbaik berdasarkan penurunan risiko dan margin waktu |
| Mode bandingkan | Dua peta berdampingan dengan kamera sinkron: tanpa sekat vs dengan sekat |
| AI Briefing (Gemini) | Model bahasa merangkum hasil simulasi menjadi briefing situasi dan prioritas tindakan dalam bahasa Indonesia |
| Estimasi waktu tiba di desa | Level Aman, Waspada, Siaga, Awas untuk tiap desa |
| Dashboard titik panas | Tabel NASA FIRMS dengan filter, peta ringkasan, dan feed peringatan dari Supabase |
| Laporan siap cetak | Hasil disimpan ke Supabase, dapat dibagikan lewat tautan dan dicetak ke PDF |
| Mode Demo | Seluruh data dari berkas lokal, tanpa panggilan ke layanan luar |

## Komponen AI

1. **Optimasi sekat bakar berbasis simulasi (search + Monte Carlo).** Sistem membangkitkan kandidat garis sekat tegak lurus arah sebaran dominan (5 jarak x 3 rotasi x 3 panjang x 5 geser lateral), menyaring kandidat yang tidak sempat dibangun sebelum api tiba, mengevaluasi tiap kandidat dengan simulasi ulang, lalu memilih tiga yang beragam (berjarak minimal 1 km) dengan skor tertinggi.
2. **AI Briefing dengan Google Gemini.** Ringkasan hasil simulasi (angin, luas, desa, rekomendasi) dikirim ke Gemini lewat route handler server; kunci API tidak pernah dikirim ke browser. Bila Gemini tidak tersedia, aplikasi memakai briefing cadangan berbasis aturan.

## Tech stack

| Lapisan | Teknologi |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Styling | Tailwind CSS 4 |
| Peta | MapLibre GL JS 6, tile CARTO (dark matter, positron), relief Terrarium (AWS Open Data) |
| State dan worker | Zustand, Web Worker + Comlink |
| Validasi | Zod |
| Database | Supabase (PostgreSQL + PostGIS), RLS, fungsi RPC |
| Data | NASA FIRMS (titik panas), Open-Meteo (cuaca) |
| AI | Google Gemini API (`gemini-flash-lite-latest`) |
| Pengujian | Vitest |
| Ikon | lucide-react |

## Menjalankan secara lokal

Prasyarat: Node.js 20 atau lebih baru.

```bash
npm install            # juga menyalin worker MapLibre ke public/vendor
cp .env.local.example .env.local
# isi variabel di .env.local (lihat tabel di bawah)
npm run dev            # http://localhost:3000
```

Perintah lain:

```bash
npm test               # 24 tes unit mesin simulasi dan sekat bakar
npm run lint
npm run build && npm start
npm run build:data     # buat ulang data skenario dan supabase/seed.sql
```

### Variabel lingkungan

| Variabel | Sisi | Keterangan |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Publik | URL proyek Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publik | Publishable key (dibatasi RLS) |
| `GEMINI_API_KEY` | Server | Kunci Google AI Studio untuk AI Briefing (opsional, ada cadangan) |
| `GEMINI_MODEL` | Server | Default `gemini-flash-lite-latest` |
| `FIRMS_MAP_KEY` | Server | MAP_KEY NASA FIRMS (opsional, ada data cadangan) |
| `NEXT_PUBLIC_MAP_STYLE_DARK` / `_LIGHT` | Publik | URL gaya peta dasar (opsional) |

### Database Supabase

Migrasi ada di `supabase/migrations/` dan data skenario di `supabase/seed.sql`.

1. Buat proyek Supabase.
2. Jalankan `0001_init.sql`, `0002_rls.sql`, `0003_rpc.sql`, `0004_reports_aid.sql`, `0005_review_tracking.sql`, lalu `seed.sql` (lewat SQL Editor atau Supabase CLI).
3. Atur PIN petugas posko (minimal 6 karakter, jangan disimpan di repo):

   ```sql
   insert into app_secrets (key, hash) values ('officer_pin', extensions.crypt('PIN-ANDA', extensions.gen_salt('bf')))
   on conflict (key) do update set hash = excluded.hash;
   ```

Migrasi `0005` menambahkan pemeriksaan foto oleh AI (kolom `ai_label`, `photo_source`, `place`), verifikasi petugas di `/petugas`, dan pelacakan penyaluran bantuan (kode `AR-xxxxxx`, tahap Dijanjikan > Dikonfirmasi > Dalam perjalanan > Diterima posko > Disalurkan). Tanpa migrasi ini aplikasi tetap berjalan dengan fungsi lama, tetapi pelacakan dan dasbor petugas belum aktif.

Keamanan: semua tabel memakai RLS. Data referensi (skenario, desa, gambut, peringatan) dapat dibaca publik. Tabel hasil simulasi tidak dapat dibaca atau ditulis langsung dari klien; penulisan dan pembacaan hanya lewat fungsi `save_simulation` dan `get_simulation` (SECURITY DEFINER dengan validasi ukuran dan isi), dan laporan hanya dapat dibuka dengan UUID-nya.

## Struktur proyek

```text
src/
  app/                 halaman (/, /simulator, /dashboard, /report/[id]) dan route handler /api/*
  components/          map, simulator, dashboard, report, landing, ui
  lib/sim/             mesin simulasi murni TypeScript (engine, firebreak, risk, grid, params)
  lib/data/            NASA FIRMS, Open-Meteo, data cadangan
  workers/             Web Worker simulasi (Comlink)
  stores/              state Zustand
scripts/               generator data skenario, alat tala parameter
supabase/              migrasi dan seed
tests/unit/            tes Vitest
docs/                  PRD, TRD, AFD, DBD, BSD, IPD
```

## Model dan batasan

- Peluang api menjalar ke tetangga per langkah: `p = min(0,95; p0 x f_bahan x f_angin x f_lereng x f_kering x f_jarak)` dengan `f_angin = e^(c1 V) x e^(c2 V (cos φ - 1))`, terinspirasi Alexandridis dkk. (2008).
- Simulasi dihitung sebagai waktu tunda per jalur sel ke sel (sebaran geometrik dari peluang per langkah) dengan keacakan ber-seed per jalur. Cara ini setara dengan mencoba tiap langkah, tetapi membuat dua simulasi dengan seed sama dapat dibandingkan secara adil (efek sekat tidak tertutup noise).
- Gambut kering menyala 4 kali lebih lama (fase membara dengan peluang menjalar lebih kecil) dan dapat menembus sekat permukaan (api bawah tanah).
- Parameter (`src/lib/sim/params.ts`) ditala secara visual, belum dikalibrasi dengan data kebakaran historis.
- Tutupan lahan, zona gambut, sungai, dan desa pada tiga skenario adalah ilustrasi sintetis; nama desa fiktif.
- Angin dianggap seragam selama 12 jam.

Perubahan dari dokumen rancangan (docs/): koefisien model ditala ulang (p0 0,12; c1 0,10), skor sekat diskalakan ulang agar terbaca, kandidat sekat dibuat lebih panjang (2,5 sampai 6 km), dan penulisan database memakai fungsi RPC alih-alih service role key.

## Penggunaan AI coding assistant, template, dan aset

Sesuai ketentuan IT RUSH 2026:

- **AI coding assistant:** proyek ini dikembangkan dengan bantuan **Claude Code (Anthropic)** untuk penulisan kode, pengujian, dan penyusunan dokumentasi, di bawah arahan dan peninjauan tim.
- **Template:** kerangka awal dari `create-next-app`.
- **Library open-source:** Next.js, React, Tailwind CSS, MapLibre GL JS, Zustand, Comlink, Zod, Supabase JS, Turf.js, date-fns, Recharts, lucide-react, Vitest.
- **Layanan dan data:** NASA FIRMS, Open-Meteo, Terrarium elevation tiles (AWS Open Data), CARTO basemaps, OpenStreetMap contributors, Google Gemini API, Supabase.
- **Aset visual:** ilustrasi isometrik dan logo dibuat sendiri sebagai SVG di dalam kode.

## Tim

Belva & Salma
