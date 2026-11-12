# AFD - ApiRimba AI

Nov 12, 2026 · @Belva & Salma

## Peta Halaman dan Navigasi

MVP punya 4 halaman utama dan 1 modal. Semua halaman memakai navbar yang sama, sehingga pengguna selalu bisa kembali ke Simulator.

| Rute | Halaman | Tujuan | Datang dari | Menuju |
| --- | --- | --- | --- | --- |
| / | Landing | Menjelaskan masalah dan mengajak memulai | Tautan awal | /simulator, /dashboard |
| /simulator | Simulator (inti) | Simulasi sebaran api, kontrol angin, rekomendasi sekat | Landing, Dashboard, tautan laporan | /report/\[id\], /dashboard |
| /dashboard | Dashboard Hotspot dan Peringatan | Memantau titik panas dan peringatan desa | Navbar, Simulator | /simulator (dengan area terpilih) |
| /report/\[id\] | Laporan | Ringkasan siap cetak dan bagikan | Simulator, tautan bagikan | /simulator |
| Modal Tentang Model | Asumsi dan batasan | Transparansi model | Ikon info di semua halaman | Menutup ke halaman asal |
| 404 | Tidak ditemukan | Pesan ramah dan tombol kembali | Rute tidak valid | / |

**Navbar global:** logo (ke /), Simulator, Dashboard, sakelar Mode Demo (dengan indikator warna), dan ikon info Tentang Model.

**Footer:** sumber data (NASA FIRMS, Open-Meteo), atribusi peta, dan catatan bahwa hasil adalah simulasi dukungan keputusan.

## Alur Utama Pengguna

&#91;embedded content: alur utama · 10 langkah, 1 keputusan\]

Alur ini adalah jalur demo: dari landing ke simulasi, lalu pengguna mengulang ubah angin dan cari sekat sampai hasilnya cukup, baru membuka laporan.

| Langkah | Aksi pengguna | Respons sistem |
| --- | --- | --- |
| 1 | Klik Mulai Simulasi di landing | Membuka /simulator dengan skenario Riau |
| 2 | Memilih skenario | Kamera terbang ke area, hotspot dan zona gambut tampil |
| 3 | (otomatis) Muat data | Skenario, hotspot, dan cuaca dimuat; indikator kesegaran data tampil |
| 4 | Klik Jalankan | Pratinjau simulasi 12 jam dihitung dan animasi mulai |
| 5 | Geser kecepatan atau arah angin, atau scrubber waktu | Area api diperbarui langsung; hasil halus menyusul 300 ms kemudian |
| 6 | Klik Rekomendasikan Sekat | Progress bar, lalu 3 kartu rekomendasi dan garis di peta |
| 7 | Klik Terapkan pada satu kartu | Simulasi ulang dengan sekat; badge Sekat diterapkan |
| 8 | Buka mode Bandingkan | Dua peta berdampingan dengan selisih luas dan waktu tiba desa |
| 9 | Jawab Cukup? ya, klik Buka laporan | Hasil disimpan dan halaman laporan terbuka |
| 9b | Jawab Cukup? tidak | Kembali ke langkah 5 dengan angin atau skenario lain |

## Alur Halaman Landing

Landing harus membuat juri paham masalah dan nilai produk dalam 15 detik, lalu mengarahkan ke simulator.

1. **Hero:** judul 'Lihat ke mana api menjalar, sebelum api sampai', subjudul satu kalimat, dan pratinjau peta gelap dengan partikel angin yang mengalir pelan. Dua tombol: Mulai Simulasi (utama) dan Lihat Dashboard (sekunder).
2. **Masalah:** tiga kartu singkat (hotspot tidak memberi arah, angin berubah cepat, api gambut menembus sekat).
3. **Cara kerja:** tiga langkah berikon (Baca data, Simulasikan 12 jam, Rekomendasikan sekat).
4. **Bukti cepat:** satu cuplikan animasi atau tangkapan layar simulator dengan keterangan.
5. **Sumber data dan catatan model:** daftar singkat sumber dan tautan ke modal Tentang Model.
6. **Ajakan kedua:** tombol Mulai Simulasi di bagian bawah.

**Interaksi dan hasil**

- Mulai Simulasi membuka /simulator?scenario=riau.
- Pratinjau hero memakai canvas ringan; bila pengguna memilih reduced motion, partikel diganti panah angin statis.
- Landing tidak memuat MapLibre penuh (hanya gambar atau canvas) agar cepat.

## Alur Halaman Simulator (Inti)

**Tata letak:** panel kiri (kontrol: skenario, angin, lapisan), peta 2.5D di tengah, panel kanan (hasil: statistik, desa terdampak, rekomendasi), bilah waktu di bawah peta.

**Urutan saat halaman dibuka**

1. Membaca `?scenario=` (default riau); kamera terbang ke area dalam 2 detik.
2. Memuat paralel: detail skenario, hotspot, dan cuaca. Selama memuat tampil skeleton dan peta tetap interaktif.
3. Angin awal diisi dari cuaca terbaru (atau preset skenario bila gagal); pengguna dapat mengubahnya.
4. Tombol Jalankan menjadi aktif setelah skenario dan grid siap.

**Tabel kontrol dan respons**

| Kontrol | Aksi | Respons sistem | Batas dan aturan |
| --- | --- | --- | --- |
| Pilihan skenario | Pilih Riau, Kalimantan Tengah, atau Sumatera Selatan | Kamera terbang, data dimuat ulang, simulasi lama dibuang | Tampil konfirmasi bila ada sekat yang belum disimpan |
| Tombol Jalankan | Klik | Pratinjau dihitung (kurang dari 150 ms), animasi mulai dari jam 0 | Nonaktif saat memuat |
| Slider kecepatan angin | Geser | Pratinjau ulang setelah jeda 120 ms; hasil halus 300 ms setelah berhenti | 0 sampai 20 m/s; hitungan lama dibatalkan |
| Kompas arah angin | Putar atau ketik derajat | Sama dengan slider; panah angin dan partikel ikut berubah | 0 sampai 359 derajat, label arah ASAL angin |
| Bilah waktu | Geser, putar, jeda, kecepatan 1x/2x/4x | Peta dan angka (luas, desa terdampak) sinkron | 0 sampai 12 jam |
| Sakelar lapisan | Hidup atau mati: partikel angin, hotspot, gambut, desa, sekat | Lapisan tampil atau tersembunyi seketika | Partikel mati otomatis bila FPS rendah |
| Klik desa | Klik penanda desa | Popup: nama, estimasi jam tiba, tingkat risiko | Tampil 'aman 12 jam' bila tidak terjangkau |
| Rekomendasikan Sekat | Klik | Progress bar (target kurang dari 5 detik), lalu 3 kartu rekomendasi dan garis di peta | Butuh hasil simulasi; dapat dibatalkan |
| Kartu rekomendasi | Klik atau arahkan kursor | Peta fokus ke garis sekat; kartu menampilkan skor, panjang, margin waktu, penurunan luas | Hanya satu kartu aktif |
| Terapkan | Klik pada kartu | Simulasi ulang dengan sekat; badge Sekat diterapkan; tombol Batalkan sekat | Satu sekat aktif pada satu waktu (MVP) |
| Bandingkan | Sakelar | Dua peta berdampingan: tanpa sekat dan dengan sekat; selisih luas dan waktu tiba | Aktif hanya bila ada sekat diterapkan |
| Simpan dan Laporan | Klik | POST ke /api/simulations lalu membuka /report/\[id\] | Tampil indikator menyimpan |

**Prinsip respons:** pengguna tidak boleh menunggu tanpa tanda. Pratinjau selalu cepat, hasil halus menggantikannya dengan transisi pelan, dan proses yang lebih dari 1 detik menampilkan progress.

## Alur Halaman Dashboard Hotspot dan Peringatan

Dashboard dipakai analis (Bu Sari) untuk memantau area luas dan memutuskan skenario mana yang disimulasikan.

**Tata letak:** kiri tabel hotspot dengan filter, tengah peta ringkasan, kanan feed peringatan.

**Alur**

1. Halaman memuat hotspot semua skenario (data live, cache, atau cadangan) dan menampilkan penanda waktu pembaruan.
2. Pengguna memfilter: skenario atau provinsi, tingkat keyakinan (rendah, nominal, tinggi), dan rentang waktu (24, 48, 72 jam).
3. Klik baris tabel: peta fokus ke titik dan membuka popup (koordinat, waktu deteksi, keyakinan, FRP).
4. Tombol 'Simulasikan dari area ini' membuka /simulator dengan skenario yang sesuai.
5. Feed peringatan menampilkan item dari simulasi terbaru tiap skenario: Desa terancam (dengan estimasi jam tiba), Hotspot baru, dan Angin berubah.
6. Klik item peringatan membuka simulator pada desa atau titik terkait.

**Aturan**

- Tombol Simulasikan hanya aktif bila titik berada di dalam area skenario MVP; selain itu tampil tooltip 'Di luar area skenario MVP'.
- Peringatan diberi warna dan label teks (bukan warna saja): Waspada, Siaga, Awas.
- Tabel dapat diurutkan menurut waktu deteksi atau FRP.

## Alur Halaman Laporan

Laporan adalah satu halaman ringkas yang bisa dicetak ke PDF dan dibagikan lewat tautan.

1. Halaman /report/\[id\] memuat simulasi tersimpan dari /api/simulations/\[id\].
2. Susunan: judul dan waktu simulasi, ringkasan satu paragraf, peta (tangkapan tampilan), tabel desa dan estimasi jam tiba, tiga rekomendasi sekat, asumsi model, serta sumber dan waktu data.
3. Tombol: Cetak atau Simpan PDF (window.print dengan gaya cetak), Salin Tautan, dan Kembali ke Simulator.
4. Bila id tidak ditemukan: halaman 404 dengan tombol kembali.

**Aturan cetak:** latar putih, teks gelap, peta tampil sebagai gambar, navbar dan tombol disembunyikan, margin 16 mm, satu atau dua halaman A4.

## State, Error, dan Edge Case

| Situasi | Halaman | Perilaku |
| --- | --- | --- |
| Memuat data | Simulator, Dashboard | Skeleton pada panel; peta tetap bisa digeser; tombol terkait nonaktif |
| API hotspot gagal | Simulator, Dashboard | Pakai cache lalu cadangan; label 'Data cadangan' dan waktu data; tanpa pesan error besar |
| API cuaca gagal | Simulator | Angin diisi dari preset skenario; label 'Angin preset' |
| Tidak ada hotspot di skenario | Simulator | Pakai titik awal preset; pesan 'Menggunakan titik awal contoh' |
| Jaringan offline | Semua | Banner: 'Anda offline. Aktifkan Mode Demo?' dengan tombol satu klik |
| WebGL tidak tersedia | Simulator | Peta datar 2D dan pesan; simulasi tetap berjalan |
| Worker error | Simulator | Toast 'Simulasi gagal' dan tombol Coba Lagi; log ke console |
| Slider digeser cepat | Simulator | Hitungan lama dibatalkan (id permintaan); hanya hasil terbaru dipakai |
| FPS di bawah 20 selama 3 detik | Simulator | Kurangi partikel dan kualitas; tampil tip 'Mode ringan aktif' |
| Tidak ada sekat valid (api tiba sebelum waktu bangun) | Simulator | Pesan: 'Api tiba sebelum sekat sempat dibangun. Prioritaskan perlindungan dan evakuasi desa' dengan daftar desa dan jam tiba |
| Simulasi sudah diubah setelah sekat dipilih | Simulator | Rekomendasi ditandai 'Perlu dihitung ulang' |
| Gagal menyimpan laporan | Simulator | Toast dan opsi Cetak langsung dari simulator |
| ID laporan tidak ada | Laporan | 404 dengan tombol kembali |
| Reduced motion aktif | Semua | Partikel diganti panah statis; transisi dipersingkat |
| Layar kurang dari 768 px | Simulator | Panel menjadi bottom sheet dengan tab Kontrol, Hasil, Sekat |

## Alur Demo Panggung dan Cadangan

**Sebelum naik panggung**

- [ ] Buka aplikasi di Chrome layar penuh, resolusi proyektor diuji.
- [ ] Jalankan skenario Riau sekali sebagai pemanasan (cache terisi).
- [ ] Pastikan indikator Mode Demo siap dan rekaman layar cadangan terbuka di tab lain.
- [ ] Baterai terisi dan mode hemat daya mati.

**Alur dan rencana B**

| Menit | Aksi | Bila gagal, lakukan |
| --- | --- | --- |
| 0:00 | Landing, klik Mulai Simulasi | Buka /simulator?scenario=riau langsung |
| 0:20 | Skenario Riau dimuat | Aktifkan Mode Demo (data lokal) |
| 0:50 | Jalankan, geser slider angin | Matikan partikel angin; turunkan kualitas peta |
| 1:30 | Putar arah angin 90 derajat | Gunakan preset angin 'Arah ke desa' dari menu |
| 2:00 | Rekomendasikan Sekat | Muat hasil sekat preset dari data demo |
| 2:30 | Terapkan dan Bandingkan | Tampilkan gambar perbandingan yang sudah disimpan |
| 2:50 | Buka laporan | Cetak PDF dari simulator atau tampilkan PDF contoh |

Bila semua gagal, putar rekaman layar cadangan sambil menjelaskan alur yang sama.
