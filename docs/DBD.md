# DBD - ApiRimba AI

Nov 12, 2026 · @Belva & Salma

## Konsep dan Kepribadian Visual

ApiRimba AI tampil seperti pusat komando yang tenang: latar gelap, peta sebagai pusat perhatian, dan api sebagai satu-satunya warna hangat. Nadanya tegas dan terpercaya, bukan panik.

**Kata kunci:** tenang, presisi, mendesak tanpa berteriak.

**Prinsip desain**

1. **Peta adalah pahlawan.** Panel melayang di tepi dan tidak menutupi area api.
2. **Warna hangat hanya untuk api dan risiko.** Oranye dan merah berarti api; biru muda berarti angin dan informasi; hijau berarti aman atau sekat.
3. **Satu aksi utama per layar.** Di simulator aksi utama adalah Jalankan, lalu Rekomendasikan Sekat.
4. **Angka selalu bersatuan.** 8 m/s, 5,5 jam, 12 km2; font mono untuk bacaan data.
5. **Gerak membawa data.** Partikel angin dan denyut hotspot bermakna, bukan hiasan; semuanya dapat dimatikan.
6. **Jujur soal model.** Label 'prediksi simulasi' dan asumsi mudah dijangkau.

**Suasana referensi:** peta cuaca dan kebencanaan bergaya gelap (wind map, pemantauan satelit), bukan dashboard korporat yang ramai.

## Palet Warna dan Design Token

Tema gelap adalah default. Tema terang hanya dipakai untuk halaman laporan cetak.

| Token | Hex | Pemakaian |
| --- | --- | --- |
| bg-base | #0B0F14 | Latar halaman |
| bg-surface | #121821 | Panel dan kartu |
| bg-elevated | #1A2230 | Popover, kartu aktif |
| border | #263041 | Garis pemisah |
| text-primary | #E8EDF4 | Teks utama |
| text-secondary | #9AA7B8 | Teks pendukung |
| text-muted | #6B7889 | Hanya teks non-esensial (kontras lebih rendah) |
| wind | #4FC3F7 | Angin, informasi, fokus, slider |
| fire-core | #FF4D2E | Api menyala |
| fire-mid | #FF9F1C | Peluang terbakar sedang |
| fire-low | #FFD24A | Hotspot, peluang rendah |
| fire-deep | #B3001B | Peluang sangat tinggi |
| burned | #3A2020 | Area sudah terbakar |
| cta | #FF6A3D | Tombol utama (teks gelap di atasnya) |
| firebreak | #3DDC97 | Garis sekat bakar dan status aman |
| peat-dry | #B8793E | Gambut kering |
| peat-wet | #3F6F5E | Gambut basah |
| forest | #1F3A2E | Hutan |
| water | #12324A | Air |
| warn / alert / danger | #FFC53D / #FF8A3D / #FF4D4F | Waspada, Siaga, Awas |

Latar tema terang (laporan): putih #FFFFFF, teks #111827, garis #D7DEE8; api dan sekat memakai warna yang sama dengan outline gelap agar tetap terbaca di kertas.

**Token Tailwind v4 (src/styles/globals.css)**

```css
@import 'tailwindcss';

@theme {
  --color-bg-base: #0B0F14;
  --color-bg-surface: #121821;
  --color-bg-elevated: #1A2230;
  --color-border: #263041;
  --color-text-primary: #E8EDF4;
  --color-text-secondary: #9AA7B8;
  --color-text-muted: #6B7889;
  --color-wind: #4FC3F7;
  --color-fire-core: #FF4D2E;
  --color-fire-mid: #FF9F1C;
  --color-fire-low: #FFD24A;
  --color-fire-deep: #B3001B;
  --color-burned: #3A2020;
  --color-cta: #FF6A3D;
  --color-firebreak: #3DDC97;
  --color-peat-dry: #B8793E;
  --color-peat-wet: #3F6F5E;
  --color-warn: #FFC53D;
  --color-alert: #FF8A3D;
  --color-danger: #FF4D4F;
  --radius-card: 8px;
  --radius-panel: 12px;
}

html { color-scheme: dark; background: var(--color-bg-base); color: var(--color-text-primary); }
```

Teks utama dan pendukung terhadap latar wajib diperiksa minimal kontras 4,5 banding 1; text-muted tidak boleh dipakai untuk informasi penting.

## Tipografi

Dua font saja, dimuat lewat next/font agar cepat dan tanpa kedipan: **Inter** untuk antarmuka dan **JetBrains Mono** untuk angka, koordinat, dan waktu.

| Peran | Ukuran / tinggi baris | Bobot | Font | Catatan |
| --- | --- | --- | --- | --- |
| Display (hero) | 48 / 56 | 700 | Inter | Hanya di landing |
| H1 | 32 / 40 | 700 | Inter | Judul halaman |
| H2 | 24 / 32 | 600 | Inter | Judul panel |
| H3 | 18 / 28 | 600 | Inter | Judul kartu |
| Body | 16 / 24 | 400 | Inter | Teks bacaan |
| Small | 14 / 20 | 400 | Inter | Label kontrol |
| Caption | 12 / 16 | 500 | Inter | Catatan, sumber data |
| Data | 14 sampai 28 / 1,2 | 500 | JetBrains Mono | Angka bersatuan, tabular-nums |

- Format angka dengan Intl id-ID: koma desimal (5,5 jam), pemisah ribuan titik.
- Satuan dengan spasi tipis: 8 m/s, 12 km2.
- Semua huruf kapital hanya untuk label status pendek (WASPADA, SIAGA, AWAS).

## Layout, Grid, dan Spacing

**Simulator (layar penuh, 1280 px ke atas)**

| Area | Ukuran | Isi |
| --- | --- | --- |
| Header | Tinggi 56 px | Logo, navigasi, Mode Demo, Tentang Model |
| Panel kiri | Lebar 320 px, melayang 16 px dari tepi | Skenario, kontrol angin, lapisan |
| Peta | Mengisi sisa layar | Peta 2.5D dan kanvas partikel |
| Panel kanan | Lebar 360 px | Statistik, desa terdampak, rekomendasi, feed peringatan |
| Bilah waktu | Tinggi 88 px, di bawah peta | Scrubber, putar, kecepatan |

**Landing dan dashboard:** kontainer maksimal 1280 px, grid 12 kolom, jarak antar kolom 24 px.

**Skala spasi (basis 4 px):** 4, 8, 12, 16, 24, 32, 48, 64. Padding kartu 16, padding panel 20.

**Radius:** 8 px kartu dan tombol, 12 px panel, 999 px pil dan badge.

**Elevasi:** panel melayang memakai border 1 px dan bayangan lembut gelap (0 8 24 rgba 0,0,0,0.4); tidak ada gradasi dekoratif di panel.

**Lapisan (z-index):** peta 0, kanvas partikel 10, panel 20, popover 30, modal 40, toast 50.

**Breakpoint:** 640, 768, 1024, 1280, 1536 px.

## Komponen UI

| Komponen | Spesifikasi | State |
| --- | --- | --- |
| Tombol utama | Latar cta (#FF6A3D), teks bg-base, tinggi 44, radius 8, bobot 600 | Hover lebih terang 8%, fokus ring wind 2 px, nonaktif opacity 40%, memuat dengan spinner dan teks tetap |
| Tombol sekunder | Transparan, border dan teks text-primary | Hover bg-elevated |
| Tombol ghost | Tanpa border, teks text-secondary | Hover teks text-primary |
| Slider angin | Track 4 px, thumb 20 px warna wind, nilai di label mono, tick tiap 5 m/s | Fokus: ring; keyboard panah 1 m/s, Shift+panah 5 m/s |
| Kompas arah angin | Lingkaran 120 px, jarum menunjuk arah TUJUAN, label teks 'Angin dari 120 derajat (tenggara)' | Seret atau ketik derajat |
| Kartu rekomendasi | Lencana peringkat, nama (Sekat A), cincin skor 0-100, tiga baris metrik (Panjang, Margin waktu, Penurunan luas), tombol Terapkan | Aktif: border firebreak; Perlu dihitung ulang: label kuning |
| Badge status | Pil dengan ikon dan teks: Waspada, Siaga, Awas, Aman | Tidak pernah hanya warna |
| Item peringatan | Garis status 4 px di kiri, judul, waktu relatif, isi satu kalimat, tombol Lihat di peta | Baru: titik wind di kiri |
| Statistik | Label caption, nilai mono 28, perubahan terhadap baseline | Dihitung ulang: nilai berkedip pelan sekali |
| Bilah waktu | Track dengan tick tiap jam, label +00 sampai +12, tombol putar atau jeda, chip 1x 2x 4x | Fokus pada thumb |
| Legenda | Bilah gradasi peluang 0-100 persen, daftar simbol (hotspot, api menyala, terbakar, sekat, gambut kering dan basah, desa) | Dapat dilipat |
| Sakelar lapisan | Daftar sakelar dengan ikon kecil | Mati: ikon redup |
| Sakelar Mode Demo | Pil dengan titik status: hijau (siap offline), abu (mati) | Hidup menampilkan label 'Data lokal' |
| Toast | Kanan bawah, maksimal 3, hilang 5 detik, tombol tutup | Sukses, info, galat |
| Skeleton | Blok bg-elevated dengan kilau pelan | Dimatikan pada reduced motion |
| Modal Tentang Model | Lebar 560, isi: cara kerja, asumsi, batasan, sumber | Esc menutup, fokus terkunci |

## Desain Peta, Partikel Angin, dan Area Api

Bagian ini penting untuk efek 'wow' di depan juri; ikuti angka di bawah sebagai titik awal lalu tala secara visual.

| Elemen | Spesifikasi visual |
| --- | --- |
| Peta dasar | Gaya gelap, desaturasi; hillshade lembut; terrain exaggeration 1,5; kamera pitch 55 derajat, bearing -20, zoom 9 sampai 11; terbang 2 detik easeInOut |
| Partikel angin | Kanvas di atas peta; 2500 partikel (desktop), 1200 (mode ringan); garis 1,2 px warna wind; jejak memudar (alpha 0,96 per frame); umur 60 sampai 120 frame; kecepatan sebanding kecepatan angin; opasitas lapisan 0,7; berhenti pada reduced motion dan diganti panah |
| Hotspot | Lingkaran 6 sampai 10 px warna fire-low sesuai FRP; cincin berdenyut 1,6 detik dari 10 ke 20 px, alpha 0,5 ke 0; yang berkeyakinan tinggi memiliki outline putih tipis |
| Api menyala | Sel fire-core alpha 0,85 dengan glow 4 px |
| Sudah terbakar | Sel burned alpha 0,7 dengan tepi bara tipis |
| Peluang terbakar (mode halus) | Peluang 10-30 persen fire-low alpha 0,35; 30-60 persen fire-mid alpha 0,5; 60-90 persen fire-core alpha 0,65; di atas 90 persen fire-deep alpha 0,75 |
| Front api | Garis tepi area menyala, 1,5 px, warna #FFB199, dash 4 2 |
| Transisi pratinjau ke halus | Crossfade 300 ms |
| Sekat bakar | Garis 6 px warna firebreak dengan outline gelap 2 px; kandidat lain 40 persen opasitas; saat dipilih, garis digambar dalam 600 ms (stroke-dashoffset); label 'Sekat A, skor 78' |
| Desa | Ikon rumah 14 px; warna sesuai status (aman, waspada, siaga, awas); label estimasi 'Tiba 5,5 jam' dengan latar bg-elevated |
| Gambut | Arsiran diagonal halus opasitas 0,35, warna peat-dry sampai peat-wet menurut kelembapan |
| Mode bandingkan | Pembagi vertikal 50/50 dengan pegangan geser; label 'Tanpa sekat' dan 'Dengan sekat'; kamera sinkron |
| Penanda angin | Panah di pojok peta dengan kecepatan dan arah tertulis |

**Aturan:** warna tidak menjadi satu-satunya pembeda; tiap simbol punya bentuk atau label, dan legenda selalu dapat dibuka.

## Wireframe per Halaman

**Landing**

```text
+--------------------------------------------------------------+
| ApiRimba AI     Simulator  Dashboard      [Mode Demo o]  (i) |
+--------------------------------------------------------------+
|  Lihat ke mana api menjalar,        +----------------------+ |
|  sebelum api sampai.                |  pratinjau peta gelap | |
|  [Mulai Simulasi] [Lihat Dashboard] |  + partikel angin     | |
|                                     +----------------------+ |
+--------------------------------------------------------------+
|  Masalah:  [kartu 1]  [kartu 2]  [kartu 3]                   |
|  Cara kerja:  1 Baca data > 2 Simulasi 12 jam > 3 Sekat bakar |
|  Sumber data dan catatan model                               |
|  [Mulai Simulasi]                                            |
+--------------------------------------------------------------+
```

**Simulator**

```text
+--------------------------------------------------------------+
| ApiRimba AI   Simulator  Dashboard      [Mode Demo o]   (i)  |
+-----------+----------------------------------+---------------+
| SKENARIO  |                                  | HASIL         |
| [Riau  v] |                                  | Luas 12 jam   |
|           |      PETA 2.5D                   | 18,4 km2      |
| ANGIN     |      api + partikel angin        | Desa terdampak|
| 8 m/s     |      sekat bakar                 |  - Desa A 5,5j|
| (kompas)  |                                  |  - Desa B 9,0j|
|           |                          [panah] | REKOMENDASI   |
| LAPISAN   |                                  | [Sekat A 78]  |
| [x] angin |                                  | [Sekat B 71]  |
| [x] gambut|                                  | [Sekat C 64]  |
| [Jalankan]|                                  | [Bandingkan]  |
+-----------+----------------------------------+---------------+
| [>] |----o------------------------| +05:30  1x 2x 4x       |
+--------------------------------------------------------------+
```

**Dashboard**

```text
+--------------------------------------------------------------+
| Filter: [Skenario v] [Keyakinan v] [24 jam v]   Diperbarui 08:00|
+--------------------+--------------------------+--------------+
| TABEL HOTSPOT      |   PETA RINGKASAN         | PERINGATAN   |
| waktu | lat | FRP  |   titik berdenyut        | Siaga: Desa A|
| ...                |                          | Hotspot baru |
| [Simulasikan]      |                          | Angin berubah|
+--------------------+--------------------------+--------------+
```

**Laporan (terang, A4)**

```text
+--------------------------------------+
| Laporan Simulasi - Riau - 12 Nov 2026|
| Ringkasan satu paragraf              |
| [Peta]                               |
| Tabel desa dan estimasi jam tiba     |
| 3 rekomendasi sekat bakar            |
| Asumsi model dan sumber data         |
+--------------------------------------+
```

## Responsif, Aksesibilitas, dan Kontras

**Responsif**

| Lebar | Perilaku |
| --- | --- |
| 1280 px ke atas | Tiga kolom penuh (panel kiri, peta, panel kanan) |
| 1024 sampai 1279 px | Panel kanan menjadi laci yang dapat dibuka |
| 768 sampai 1023 px | Kedua panel menjadi laci; bilah waktu tetap di bawah |
| Di bawah 768 px | Peta penuh; kontrol di bottom sheet dengan tab Kontrol, Hasil, Sekat; partikel dikurangi |

**Aksesibilitas (target WCAG 2.1 AA)**

- [ ] Atribut lang='id' pada html.
- [ ] Cincin fokus 2 px warna wind pada semua kontrol; urutan tab mengikuti urutan visual.
- [ ] Slider dan kompas dapat dipakai dengan keyboard; scrubber: panah geser 15 menit, spasi putar atau jeda.
- [ ] Hasil simulasi diumumkan lewat aria-live polite (mis. 'Luas terbakar 12 jam: 18,4 km persegi').
- [ ] Panel Ringkasan Teks memuat isi peta untuk pembaca layar (desa, estimasi jam tiba, sekat).
- [ ] Warna tidak jadi satu-satunya penanda; status selalu disertai ikon dan teks.
- [ ] Target sentuh minimal 44 x 44 px pada layar sentuh.
- [ ] prefers-reduced-motion mematikan partikel, denyut, dan kilau skeleton.
- [ ] Kontras teks minimal 4,5 banding 1; elemen grafis penting minimal 3 banding 1.

## Tone of Voice dan Microcopy

Bahasa Indonesia yang ringkas, tegas, dan sopan. Hindari bahasa alarmis dan emoji. Gunakan istilah baku: titik panas (hotspot), sekat bakar, estimasi, margin waktu. Nama desa pada contoh bersifat fiktif.

| Konteks | Teks |
| --- | --- |
| Tombol utama | Mulai Simulasi; Jalankan; Rekomendasikan Sekat Bakar; Terapkan Sekat; Bandingkan; Buka Laporan |
| Label data | Hotspot: diperbarui 08:00 WIB; Cuaca: diperbarui 08:00 WIB |
| Data cadangan | Data langsung tidak tersedia. Menampilkan data cadangan (diperbarui 12 Nov 2026, 08:00 WIB). |
| Mode demo | Mode Demo aktif: memakai data lokal tanpa internet. |
| Disclaimer model | Prediksi simulasi untuk dukungan keputusan, bukan pengganti penilaian di lapangan. |
| Sedang menghitung | Menghitung sebaran api 12 jam... |
| Rekomendasi berjalan | Menguji 220 kandidat sekat bakar... (angka mengikuti jumlah sebenarnya) |
| Hasil rekomendasi | Sekat A diperkirakan menurunkan luas terbakar 31%, dengan margin waktu 3,5 jam. |
| Tidak ada sekat valid | Api diperkirakan tiba sebelum sekat sempat dibangun. Prioritaskan perlindungan dan evakuasi desa. |
| Peringatan desa | Desa Sungai Buluh (contoh): perkiraan api tiba dalam 5,5 jam. Siapkan koordinasi evakuasi. |
| Gambut kering | Gambut kering: api dapat merambat di bawah sekat. Sertakan pembasahan atau sekat kanal. |
| Kosong | Belum ada simulasi. Pilih skenario lalu tekan Jalankan. |
| Gagal | Simulasi gagal dijalankan. Coba lagi, atau aktifkan Mode Demo. |
| Offline | Anda sedang offline. Aktifkan Mode Demo untuk melanjutkan. |
| Tooltip istilah | Sekat bakar: jalur tanpa bahan bakar untuk menghentikan api. |
