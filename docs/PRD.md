# PRD - ApiRimba AI

Nov 12, 2026 · @Belva & Salma

## Ringkasan Produk

ApiRimba AI adalah aplikasi web yang memprediksi arah dan luas sebaran kebakaran hutan dan lahan gambut 12 jam ke depan, lalu merekomendasikan titik sekat bakar (firebreak) yang paling efektif bagi tim pemadam.

Pengguna memilih area kebakaran, menggeser kecepatan dan arah angin, lalu melihat area merah prediksi api membesar atau mengecil secara langsung di peta 2.5D dengan animasi partikel angin.

| Aspek | Isi |
| --- | --- |
| Nama produk | ApiRimba AI |
| Tagline | Lihat ke mana api menjalar, sebelum api sampai. |
| Jenis | Aplikasi web interaktif, desktop-first dan responsif |
| Pengguna utama | Tim pemadam (Manggala Agni, BPBD), analis kebencanaan, masyarakat peduli api |
| Inovasi inti | Simulasi sebaran api berbasis angin, topografi, dan kelembapan gambut, ditambah rekomendasi sekat bakar otomatis |
| Tujuan proyek | Prototipe kompetisi (2-4 minggu) yang bisa didemokan langsung di depan juri |
| Status model | Model sederhana untuk dukungan keputusan, bukan pengganti model operasional yang tervalidasi |

## Latar Belakang dan Masalah

Kebakaran hutan dan lahan di Indonesia berulang setiap musim kemarau, terutama pada tahun El Nino. Di lahan gambut api merambat di bawah permukaan, sulit terlihat dan sulit dipadamkan, dan asapnya melintasi batas wilayah bahkan negara. Tim di lapangan umumnya menerima titik panas (hotspot) yang menunjukkan di mana api berada sekarang, tetapi tidak tahu ke mana api akan menjalar.

**Pernyataan masalah**

1. Hotspot hanya menjawab 'di mana api sekarang', bukan 'ke mana api pergi'.
2. Perubahan arah atau kecepatan angin dapat membelokkan api dalam hitungan jam.
3. Api di lahan gambut dapat menembus sekat permukaan lewat jalur bawah tanah.
4. Keputusan penempatan sekat bakar dan personel sering bergantung pada pengalaman, tanpa pembanding skenario.
5. Desa di sekitar lokasi sering baru tahu setelah api sudah dekat.

**Celah yang diisi ApiRimba AI**

| Kebutuhan lapangan | Kondisi umum saat ini | Jawaban ApiRimba AI |
| --- | --- | --- |
| Tahu arah dan kecepatan sebaran | Pemantauan titik panas tanpa proyeksi | Simulasi 12 jam ke depan di peta |
| Memahami dampak perubahan angin | Perkiraan manual | Slider angin dengan hasil langsung terlihat |
| Menentukan lokasi sekat bakar | Penilaian lapangan | Rekomendasi sekat otomatis dengan skor efektivitas |
| Mengamankan permukiman | Informasi menyusul | Estimasi waktu api tiba di tiap desa |

## Tujuan dan Metrik Keberhasilan

Tujuan MVP: pengguna bisa melihat prediksi sebaran api 12 jam, mengubah angin, dan menerima rekomendasi sekat bakar dalam satu layar, dengan demo yang stabil di depan juri.

| Metrik | Target | Cara ukur |
| --- | --- | --- |
| Waktu muat halaman simulator | Kurang dari 3 detik di laptop biasa | Lighthouse atau stopwatch |
| Waktu hitung simulasi 12 jam (skenario standar) | Kurang dari 2 detik di browser | performance.now() di Web Worker |
| Kelancaran animasi saat slider angin digeser | 30 FPS atau lebih | FPS meter DevTools |
| Jeda update area api setelah slider berhenti | Kurang dari 500 ms | Log waktu |
| Skenario demo yang berjalan tanpa internet | 3 dari 3 skenario | Uji mode offline |
| Penurunan luas terbakar dengan sekat rekomendasi (skenario demo) | 20% atau lebih dibanding tanpa sekat | Dua simulasi seed sama |
| Demo 3 menit dipahami juri | Pertanyaan juri soal dampak dan pengembangan, bukan alur | Latihan demo dengan 3 penonton |

Semua angka di atas adalah target internal tim, bukan klaim akurasi model.

## Target Pengguna dan Persona

Persona di bawah ini fiktif dan dipakai sebagai acuan desain dan skenario demo.

| Persona | Peran | Kebutuhan | Hambatan sekarang | Fitur kunci |
| --- | --- | --- | --- | --- |
| Pak Hendra | Koordinator lapangan pemadam (mis. Manggala Agni) | Tahu ke mana api menjalar dan di mana menaruh sekat dan personel | Hanya punya titik panas dan perkiraan pengalaman | Simulator, rekomendasi sekat bakar, estimasi waktu tiba |
| Bu Sari | Analis kebencanaan di BPBD provinsi | Menyusun laporan risiko dan prioritas desa | Data tersebar, laporan manual | Dashboard hotspot, daftar desa terdampak, laporan ringkas |
| Pak Joko | Kepala desa atau anggota Masyarakat Peduli Api | Tahu kapan api mungkin sampai ke desanya | Informasi datang terlambat | Peringatan desa dan garis waktu estimasi |
| Juri kompetisi | Evaluator teknis dan non-teknis | Memahami masalah, inovasi, dan dampak dalam beberapa menit | Banyak proyek dalam waktu singkat | Demo interaktif dengan efek visual jelas |

Pengguna utama untuk desain adalah Pak Hendra, karena keputusan sekat bakar adalah fitur pembeda terkuat.

## Ruang Lingkup MVP

MVP fokus pada simulator interaktif dan rekomendasi sekat bakar. Hal lain disimulasikan atau ditunda supaya selesai dalam 2-4 minggu.

| Dalam lingkup MVP | Di luar lingkup MVP |
| --- | --- |
| Peta 2.5D (MapLibre) dengan 3 skenario wilayah: Riau, Kalimantan Tengah, Sumatera Selatan | Model fisika api yang divalidasi dengan data kebakaran historis |
| Hotspot aktual dari NASA FIRMS dengan cache dan data cadangan | Sensor IoT, drone, atau kamera |
| Cuaca (angin, suhu, kelembapan, hujan) dari Open-Meteo | Prediksi lebih dari 12 jam |
| Slider kecepatan dan arah angin dengan update langsung | Aplikasi mobile native |
| Simulasi sebaran api 12 jam (cellular automata) di Web Worker | Notifikasi WhatsApp atau SMS sungguhan (hanya tampilan simulasi) |
| Zona gambut dan indeks kelembapan gambut (versi sederhana) | Peta gambut resolusi tinggi resmi |
| Rekomendasi 3 sekat bakar teratas dengan skor efektivitas | Sistem login multi-peran yang kompleks |
| Estimasi waktu tiba api di desa terdampak | Optimasi rute dan logistik personel |
| Dashboard hotspot dan feed peringatan | Integrasi dengan sistem internal instansi |
| Laporan ringkas siap cetak | Kalibrasi model per wilayah |
| Mode demo offline dengan skenario preset | Dukungan banyak bahasa (MVP hanya Indonesia) |

## Fitur Utama dan User Stories

Prioritas memakai MoSCoW: M (Must), S (Should), C (Could). Semua M wajib selesai sebelum demo.

| ID | Fitur | User story | Acceptance criteria | Prioritas |
| --- | --- | --- | --- | --- |
| US-01 | Peta 2.5D dan pilih skenario | Sebagai koordinator, saya memilih area kebakaran agar fokus ke lokasi yang relevan | Peta tampil miring dengan relief; 3 skenario bisa dipilih; kamera terbang ke area dalam 2 detik | M |
| US-02 | Hotspot aktual | Sebagai analis, saya melihat titik panas terbaru agar tahu titik awal api | Titik panas tampil dengan waktu deteksi dan tingkat keyakinan; ada label sumber dan waktu pembaruan | M |
| US-03 | Simulasi sebaran 12 jam | Sebagai koordinator, saya melihat prediksi area terbakar agar bisa merencanakan | Area merah muncul dan tumbuh per langkah waktu; hasil total dalam kurang dari 2 detik | M |
| US-04 | Kontrol angin | Sebagai pengguna, saya mengubah kecepatan dan arah angin agar melihat dampaknya | Slider kecepatan (0-20 m/s) dan kompas arah; area api diperbarui dalam 500 ms setelah perubahan | M |
| US-05 | Animasi partikel angin | Sebagai juri, saya melihat arah angin secara visual agar paham pengaruhnya | Partikel mengalir sesuai arah dan kecepatan angin; bisa dimatikan | M |
| US-06 | Lapisan gambut dan kelembapan | Sebagai analis, saya melihat zona gambut kering agar tahu risiko api bawah tanah | Zona gambut berwarna menurut indeks kelembapan; legenda jelas; memengaruhi hasil simulasi | S |
| US-07 | Rekomendasi sekat bakar | Sebagai koordinator, saya menerima lokasi sekat terbaik agar sumber daya terpakai efektif | Tampil 3 sekat teratas dengan skor, panjang, dan perkiraan penurunan luas terbakar; bisa diterapkan ke simulasi | M |
| US-08 | Garis waktu | Sebagai pengguna, saya menggeser waktu 0-12 jam agar melihat perkembangan | Scrubber dan tombol play/pause; peta dan angka sinkron | M |
| US-09 | Peringatan desa | Sebagai kepala desa, saya tahu kapan api mungkin sampai agar bisa bersiap | Daftar desa terdampak dengan estimasi jam tiba dan tingkat risiko; feed peringatan di sisi kanan | S |
| US-10 | Bandingkan dengan dan tanpa sekat | Sebagai juri, saya melihat efek sekat agar nilai produk jelas | Mode bandingkan menampilkan dua hasil berdampingan dengan selisih luas | S |
| US-11 | Laporan ringkas | Sebagai analis, saya mencetak ringkasan agar bisa dibagikan | Halaman laporan berisi peta, angka kunci, dan rekomendasi; bisa dicetak ke PDF | S |
| US-12 | Mode demo offline | Sebagai presenter, saya tetap bisa demo tanpa internet | Skenario preset berjalan tanpa panggilan jaringan; ada tombol dan indikator mode demo | M |
| US-13 | Dashboard hotspot | Sebagai analis, saya melihat daftar hotspot dan filter agar memantau area luas | Tabel hotspot dengan filter provinsi dan tingkat keyakinan; klik baris membuka area di peta | S |
| US-14 | Indikator kesegaran data | Sebagai pengguna, saya tahu kapan data terakhir diperbarui agar percaya pada hasil | Label waktu pembaruan cuaca dan hotspot di panel; peringatan bila data lebih dari 6 jam | C |

## Kebutuhan Fungsional

| Kode | Kebutuhan | Terkait |
| --- | --- | --- |
| FR-01 | Sistem menampilkan peta 2.5D dengan relief dan kamera miring yang dapat diputar dan di-zoom | US-01 |
| FR-02 | Sistem menyediakan 3 skenario wilayah preset dengan titik awal api, desa, dan zona gambut | US-01, US-12 |
| FR-03 | Sistem mengambil hotspot dari NASA FIRMS untuk bounding box skenario, menyimpannya di cache, dan memakai data cadangan bila gagal | US-02 |
| FR-04 | Sistem mengambil angin, suhu, kelembapan, dan hujan dari Open-Meteo untuk titik pusat skenario | US-04 |
| FR-05 | Sistem menjalankan simulasi grid cellular automata 12 jam dengan langkah 15 menit di Web Worker | US-03 |
| FR-06 | Probabilitas penjalaran dipengaruhi angin, kemiringan, jenis bahan bakar, kelembapan, dan zona gambut | US-03, US-06 |
| FR-07 | Pengguna dapat mengubah kecepatan (0-20 m/s) dan arah angin (0-359 derajat) dan hasil dihitung ulang | US-04 |
| FR-08 | Sistem menggambar animasi partikel angin yang mengikuti vektor angin dan dapat dinyalakan atau dimatikan | US-05 |
| FR-09 | Sistem menggambar area terbakar per langkah waktu dengan warna yang membedakan sedang menyala, sudah terbakar, dan prediksi | US-03 |
| FR-10 | Sistem menghitung rekomendasi sekat bakar dengan mengevaluasi kandidat garis dan memilih 3 terbaik berdasarkan penurunan risiko | US-07 |
| FR-11 | Pengguna dapat menerapkan sekat ke simulasi dan membandingkan hasil dengan tanpa sekat | US-07, US-10 |
| FR-12 | Sistem menghitung estimasi jam tiba api untuk tiap desa dan menyusun feed peringatan | US-09 |
| FR-13 | Sistem menyediakan scrubber waktu 0-12 jam dengan putar, jeda, dan kecepatan putar | US-08 |
| FR-14 | Sistem menampilkan dashboard hotspot dengan tabel, filter, dan sinkron dengan peta | US-13 |
| FR-15 | Sistem menghasilkan halaman laporan yang dapat dicetak ke PDF | US-11 |
| FR-16 | Sistem menyimpan simulasi dan rekomendasi ke database agar dapat dibuka ulang lewat tautan | US-11 |
| FR-17 | Sistem menampilkan label sumber dan waktu pembaruan untuk setiap data eksternal | US-14 |
| FR-18 | Mode demo memakai data lokal tanpa panggilan jaringan | US-12 |

## Kebutuhan Non-Fungsional

| Kode | Kategori | Kebutuhan |
| --- | --- | --- |
| NFR-01 | Performa | Simulasi 12 jam selesai kurang dari 2 detik di laptop biasa; animasi minimal 30 FPS |
| NFR-02 | Performa | Halaman simulator termuat kurang dari 3 detik; peta tidak memuat tile berlebih |
| NFR-03 | Keandalan | Setiap panggilan API eksternal punya timeout 5 detik, cache, dan data cadangan agar demo tidak gagal |
| NFR-04 | Determinisme | Simulasi memakai seed acak tetap supaya hasil demo konsisten dan dapat diulang |
| NFR-05 | Keamanan | Kunci API (FIRMS, service role Supabase) hanya di server; tidak ada rahasia di kode klien |
| NFR-06 | Privasi | Tidak mengumpulkan data pribadi; tidak butuh login untuk fitur utama |
| NFR-07 | Kompatibilitas | Chrome, Edge, Safari, dan Firefox versi terbaru; desktop 1280 px ke atas diutamakan, tablet dan ponsel tetap terbaca |
| NFR-08 | Aksesibilitas | Kontras teks minimal WCAG AA; kontrol dapat dipakai dengan keyboard; peta tidak jadi satu-satunya penyampai informasi |
| NFR-09 | Transparansi | Setiap hasil model diberi label 'prediksi simulasi' dan asumsi utama ditampilkan |
| NFR-10 | Pemeliharaan | TypeScript ketat, struktur modul jelas, mesin simulasi dapat diuji tanpa antarmuka |
| NFR-11 | Lokalisasi | Seluruh teks antarmuka berbahasa Indonesia; satuan metrik (m/s, km, jam) |

## Skenario Demo untuk Juri (3 Menit)

Demo dirancang agar efek 'wow' muncul di menit pertama: juri menggeser angin dan melihat api bereaksi.

| Waktu | Langkah | Yang dikatakan | Yang tampil |
| --- | --- | --- | --- |
| 0:00-0:20 | Buka landing, klik Mulai Simulasi | 'Hotspot memberi tahu di mana api, bukan ke mana api pergi.' | Hero dengan peta dan partikel angin |
| 0:20-0:50 | Pilih skenario Riau | 'Ini lahan gambut dengan beberapa titik panas aktif.' | Kamera terbang, hotspot berdenyut, zona gambut |
| 0:50-1:30 | Tekan Jalankan, geser slider angin | 'Saya ubah angin ke arah desa. Perhatikan area merah.' | Area merah tumbuh ke arah angin; desa berubah status |
| 1:30-2:00 | Putar arah angin 90 derajat | 'Api berbelok dalam hitungan jam.' | Area api berbelok, estimasi jam tiba desa berubah |
| 2:00-2:30 | Klik Rekomendasikan Sekat Bakar | 'AI menguji ratusan kandidat dan memilih tiga terbaik.' | Tiga garis sekat dengan skor dan penurunan luas |
| 2:30-2:50 | Terapkan sekat, buka mode bandingkan | 'Luas terbakar turun sekian persen dan desa aman lebih lama.' | Dua peta berdampingan dengan selisih angka |
| 2:50-3:00 | Buka laporan | 'Hasilnya siap dibagikan ke BPBD.' | Halaman laporan ringkas |

**Cadangan bila internet mati:** aktifkan mode demo dari tombol di pojok kanan atas; seluruh skenario memakai data lokal.

## Risiko, Asumsi, dan Mitigasi

| Risiko atau asumsi | Dampak | Mitigasi |
| --- | --- | --- |
| Juri menganggap model tidak akurat | Kredibilitas turun | Beri label 'simulasi dukungan keputusan', tampilkan asumsi, jelaskan rencana kalibrasi dengan data historis |
| API FIRMS atau Open-Meteo gagal saat demo | Demo macet | Cache server, data cadangan, mode demo offline |
| Peta 2.5D berat di laptop juri | Animasi patah-patah | Grid maksimum 64x64, simulasi di Web Worker, opsi kualitas rendah |
| Waktu pengerjaan molor | Fitur tidak selesai | Prioritas MoSCoW; fase 1-4 harus selesai sebelum polesan |
| Data gambut resmi sulit didapat | Zona gambut kurang akurat | Pakai poligon gambut yang disederhanakan untuk 3 skenario, tandai sebagai ilustrasi |
| Rekomendasi sekat terasa acak | Nilai inti lemah | Gunakan evaluasi simulasi berulang dengan seed tetap dan tampilkan skor dan alasan |
| Asumsi: pengguna tahu istilah hotspot dan sekat bakar | Bingung bagi awam | Tooltip singkat dan glosarium kecil di antarmuka |
| Asumsi: demo dilakukan di laptop dengan Chrome | Perilaku beda di browser lain | Uji di Chrome dan Edge; siapkan rekaman layar cadangan |
