# BSD - ApiRimba AI

Nov 12, 2026 · @Belva & Salma

## Gambaran Database

Database memakai Supabase (PostgreSQL dengan ekstensi PostGIS). Isinya data referensi skenario, cache hotspot dan cuaca, serta hasil simulasi yang disimpan untuk laporan. Simulasi sendiri tidak dihitung di database.

**Prinsip**

1. Koordinat memakai SRID 4326 (urutan longitude, latitude). Titik memakai `geography` agar jarak dalam meter; poligon dan garis memakai `geometry`.
2. Semua penulisan lewat route handler dengan service role. Klien (anon key) hanya membaca data referensi.
3. Simulasi menyimpan peta waktu tiba api (arrival map) satu kali, bukan 48 frame, karena frame dapat dihitung dari arrival map. Karena itu tabel `simulation_frames` pada rencana awal diganti kolom `arrival_b64`.
4. Data demo (gambut, desa, nama desa) bersifat ilustrasi dan ditandai kolom `is_illustrative` atau `is_fictional`.
5. Nama tabel jamak, huruf kecil, snake\_case; satuan ada di nama kolom (`_ms`, `_deg`, `_km`, `_pct`, `_hours`).

| Tabel | Fungsi | Perkiraan isi |
| --- | --- | --- |
| scenarios | Metadata skenario dan grid | 3 baris |
| peat\_zones | Poligon gambut dan indeks kelembapan | 3 sampai 10 per skenario |
| villages | Titik desa (fiktif untuk demo) | 4 per skenario |
| hotspots | Cache hotspot FIRMS | Puluhan sampai ratusan, dibersihkan berkala |
| weather\_snapshots | Cache cuaca dan angin | Beberapa per hari per skenario |
| simulations | Hasil simulasi tersimpan | Satu per tombol Simpan |
| firebreak\_recommendations | Tiga sekat teratas per simulasi | Maksimal 3 per simulasi |
| village\_risks | Estimasi jam tiba per desa | Satu per desa per varian |
| alerts | Peringatan untuk dashboard | Puluhan |

## ERD dan Relasi

Scenarios adalah pusat; hampir semua tabel menempel padanya. Simulasi memiliki anak berupa rekomendasi sekat dan risiko desa.

```text
scenarios 1 --- * peat_zones
scenarios 1 --- * villages
scenarios 1 --- * hotspots            (scenario_id boleh kosong)
scenarios 1 --- * weather_snapshots
scenarios 1 --- * simulations
simulations 1 --- * firebreak_recommendations   (maks. 3)
simulations 1 --- * village_risks * --- 1 villages
scenarios 1 --- * alerts
alerts * --- 0..1 simulations | villages | hotspots
```

| Relasi | Kunci asing | Saat induk dihapus |
| --- | --- | --- |
| peat\_zones, villages, weather\_snapshots, alerts ke scenarios | scenario\_id | cascade |
| hotspots ke scenarios | scenario\_id | set null |
| simulations ke scenarios | scenario\_id | restrict |
| firebreak\_recommendations, village\_risks ke simulations | simulation\_id | cascade |
| village\_risks ke villages | village\_id | cascade |
| alerts ke simulations, villages, hotspots | simulation\_id, village\_id, hotspot\_id | set null |

## Skema Tabel (SQL)

Simpan sebagai `supabase/migrations/0001_init.sql`.

```sql
create extension if not exists postgis;

create table scenarios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  province text not null,
  description text,
  center geography(Point, 4326) not null,
  bbox geometry(Polygon, 4326) not null,
  grid_w int not null default 64 check (grid_w between 16 and 128),
  grid_h int not null default 64 check (grid_h between 16 and 128),
  cell_size_m int not null default 250,
  origin_lon double precision not null,   -- sudut barat laut grid
  origin_lat double precision not null,
  default_wind_ms numeric(4,1) not null default 6.0,
  default_wind_from_deg int not null default 120 check (default_wind_from_deg between 0 and 359),
  default_seed int not null default 20261112,
  grid_url text not null,                  -- /data/scenarios/{slug}.json
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);

create table peat_zones (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references scenarios(id) on delete cascade,
  name text not null,
  geom geometry(MultiPolygon, 4326) not null,
  moisture_index numeric(3,2) not null default 0.30 check (moisture_index between 0 and 1),
  is_illustrative boolean not null default true
);

create table villages (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references scenarios(id) on delete cascade,
  name text not null,
  location geography(Point, 4326) not null,
  population_est int check (population_est >= 0),
  is_fictional boolean not null default true
);

create table hotspots (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid references scenarios(id) on delete set null,
  external_id text not null unique,        -- md5(lat, lon, acq_date, acq_time, satellite)
  location geography(Point, 4326) not null,
  acquired_at timestamptz not null,        -- UTC
  satellite text,
  confidence text check (confidence in ('low', 'nominal', 'high')),
  frp numeric(7,2),
  source text not null default 'nasa-firms',
  fetched_at timestamptz not null default now()
);

create table weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references scenarios(id) on delete cascade,
  fetched_at timestamptz not null default now(),
  source text not null default 'open-meteo',
  wind_ms numeric(4,1) not null,
  wind_from_deg int not null check (wind_from_deg between 0 and 359),  -- arah ASAL angin
  temp_c numeric(4,1),
  rh_pct numeric(4,1) check (rh_pct between 0 and 100),
  rain_7d_mm numeric(6,1),
  rain_14d_mm numeric(6,1),
  hourly jsonb,
  stale boolean not null default false
);

create table simulations (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references scenarios(id),
  created_at timestamptz not null default now(),
  label text,
  wind_ms numeric(4,1) not null check (wind_ms between 0 and 20),
  wind_from_deg int not null check (wind_from_deg between 0 and 359),
  seed int not null,
  steps int not null default 48,
  step_minutes int not null default 15,
  ignitions jsonb not null,                -- [{ lon, lat }]
  params jsonb not null default '{}'::jsonb,   -- p0, c1, c2, a, dll.
  data_source text not null default 'live' check (data_source in ('live', 'cache', 'fallback', 'demo')),
  summary jsonb not null,                  -- { burnedKm2By12h, burnedCellsByStep[], maxProb }
  arrival_b64 text not null,               -- Int16Array arrival map, base64
  firebreak_applied boolean not null default false
);

create table firebreak_recommendations (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references simulations(id) on delete cascade,
  rank int not null check (rank between 1 and 3),
  line geometry(LineString, 4326) not null,
  width_m int not null default 500,
  length_km numeric(5,2) not null,
  score numeric(5,1) not null check (score between 0 and 100),
  reduction_pct numeric(5,1) not null,
  margin_hours numeric(4,1) not null,
  villages_saved int not null default 0,
  peat_bypass_risk boolean not null default false,
  note text,
  applied boolean not null default false,
  unique (simulation_id, rank)
);

create table village_risks (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references simulations(id) on delete cascade,
  village_id uuid not null references villages(id) on delete cascade,
  variant text not null default 'baseline' check (variant in ('baseline', 'with_firebreak')),
  eta_hours numeric(4,1),                  -- null = tidak terjangkau dalam 12 jam
  burn_probability numeric(3,2) check (burn_probability between 0 and 1),
  level text not null check (level in ('aman', 'waspada', 'siaga', 'awas')),
  unique (simulation_id, village_id, variant)
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references scenarios(id) on delete cascade,
  simulation_id uuid references simulations(id) on delete set null,
  village_id uuid references villages(id) on delete set null,
  hotspot_id uuid references hotspots(id) on delete set null,
  type text not null check (type in ('village_threat', 'new_hotspot', 'wind_shift')),
  level text not null check (level in ('waspada', 'siaga', 'awas')),
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
```

**Catatan kolom penting**

| Kolom | Arti |
| --- | --- |
| scenarios.origin\_lon, origin\_lat | Sudut barat laut grid; sel (x, y) berada di origin + x kali ukuran sel ke timur dan y kali ukuran sel ke selatan |
| weather\_snapshots.wind\_from\_deg | Arah asal angin; mesin mengubahnya menjadi arah tujuan (tambah 180 derajat) |
| simulations.arrival\_b64 | Array Int16 sepanjang grid\_w x grid\_h; -1 berarti tidak terbakar; nilai 0 sampai steps adalah langkah tiba |
| village\_risks.level | Aman (tidak terjangkau), Waspada (tiba lebih dari 8 jam), Siaga (4 sampai 8 jam), Awas (kurang dari 4 jam); ambang dapat diubah di kode |

## Index, PostGIS, dan Performa

Data kecil, jadi cukup index pada kolom yang dipakai filter dan kunci asing. Simpan sebagai bagian dari `0001_init.sql`.

```sql
create index scenarios_bbox_gix on scenarios using gist (bbox);
create index peat_zones_geom_gix on peat_zones using gist (geom);
create index peat_zones_scenario_idx on peat_zones (scenario_id);
create index villages_loc_gix on villages using gist (location);
create index villages_scenario_idx on villages (scenario_id);
create index hotspots_loc_gix on hotspots using gist (location);
create index hotspots_scn_time_idx on hotspots (scenario_id, acquired_at desc);
create index weather_scn_time_idx on weather_snapshots (scenario_id, fetched_at desc);
create index simulations_scn_time_idx on simulations (scenario_id, created_at desc);
create index firebreak_sim_idx on firebreak_recommendations (simulation_id);
create index village_risks_sim_idx on village_risks (simulation_id);
create index alerts_scn_time_idx on alerts (scenario_id, created_at desc);
```

**Contoh kueri**

```sql
-- hotspot 24 jam terakhir pada satu skenario
select h.id, ST_Y(h.location::geometry) as lat, ST_X(h.location::geometry) as lon,
       h.acquired_at, h.confidence, h.frp
from hotspots h
join scenarios s on s.id = h.scenario_id
where s.slug = 'riau' and h.acquired_at > now() - interval '24 hours'
order by h.acquired_at desc;

-- menempelkan hotspot baru ke skenario yang bbox-nya memuatnya
update hotspots h set scenario_id = s.id
from scenarios s
where h.scenario_id is null and ST_Intersects(s.bbox, h.location::geometry);

-- jarak desa ke hotspot terdekat (meter)
select v.name, min(ST_Distance(v.location, h.location)) as jarak_m
from villages v join hotspots h on h.scenario_id = v.scenario_id
group by v.name order by jarak_m;

-- sekat sebagai GeoJSON
select rank, ST_AsGeoJSON(line)::json as geometry, score, reduction_pct
from firebreak_recommendations where simulation_id = $1 order by rank;
```

**Pembersihan:** hapus hotspot dan snapshot cuaca yang lebih tua dari 7 hari lewat pekerjaan terjadwal Supabase (pg\_cron) atau tombol admin sederhana.

**Batas ukuran:** `arrival_b64` untuk grid 64 x 64 sekitar 8 KB (sekitar 11 KB dalam base64), aman disimpan sebagai teks.

## Row Level Security dan Kebijakan Akses

Aturan sederhana: data referensi boleh dibaca publik; hasil simulasi hanya dibaca dan ditulis lewat server. Karena anon key terlihat di browser, tabel hasil sengaja tidak punya kebijakan baca anon, sehingga daftar simulasi tidak bisa diambil langsung dari klien. Laporan dibuka lewat route handler yang memakai service role dan id UUID.

```sql
-- supabase/migrations/0002_rls.sql
alter table scenarios enable row level security;
alter table peat_zones enable row level security;
alter table villages enable row level security;
alter table hotspots enable row level security;
alter table weather_snapshots enable row level security;
alter table alerts enable row level security;
alter table simulations enable row level security;
alter table firebreak_recommendations enable row level security;
alter table village_risks enable row level security;

-- baca publik untuk data referensi dan cache
create policy public_read_scenarios on scenarios for select to anon, authenticated using (true);
create policy public_read_peat_zones on peat_zones for select to anon, authenticated using (true);
create policy public_read_villages on villages for select to anon, authenticated using (true);
create policy public_read_hotspots on hotspots for select to anon, authenticated using (true);
create policy public_read_weather on weather_snapshots for select to anon, authenticated using (true);
create policy public_read_alerts on alerts for select to anon, authenticated using (true);

-- simulations, firebreak_recommendations, village_risks: tanpa kebijakan untuk anon
-- (service role melewati RLS, dipakai oleh route handler)
```

Nama kebijakan ditulis sebagai identifier tanpa spasi (mis. public\_read\_scenarios) sehingga SQL dapat langsung dijalankan.

**Checklist keamanan**

- [ ] RLS aktif pada semua tabel (periksa di dasbor Supabase).
- [ ] Service role key hanya ada di variabel server Vercel.
- [ ] Route POST memvalidasi body dengan Zod dan membatasi ukuran.
- [ ] Tidak ada data pribadi di database; nama desa untuk demo fiktif.

## Seed Data dan Skenario Demo

Tiga skenario disiapkan agar demo selalu punya cerita: dua desa terancam pada angin standar, dua desa aman, dan perubahan arah angin mengubah siapa yang terancam. Koordinat pusat adalah perkiraan area lahan gambut; sesuaikan dengan data yang dipakai. Nama desa fiktif.

| Skenario | Pusat (lat, lon) | Bbox (barat, selatan, timur, utara) | Angin standar (dari, kecepatan) |
| --- | --- | --- | --- |
| Riau | 0,45 ; 102,00 | 101,928 ; 0,378 ; 102,072 ; 0,522 | 225 derajat (barat daya), 6 m/s |
| Kalimantan Tengah | -2,30 ; 113,95 | 113,878 ; -2,372 ; 114,022 ; -2,228 | 90 derajat (timur), 6 m/s |
| Sumatera Selatan | -3,30 ; 105,40 | 105,328 ; -3,372 ; 105,472 ; -3,228 | 135 derajat (tenggara), 5 m/s |

**Desa fiktif dan peran dalam demo**

| Skenario | Desa | Posisi dari titik awal | Peran |
| --- | --- | --- | --- |
| Riau | Sungai Buluh | Timur laut, sekitar 4 km | Terancam lebih dulu |
| Riau | Tanjung Harapan | Timur, sekitar 7 km | Terancam lebih lambat |
| Riau | Pematang Baru | Barat daya, sekitar 5 km | Aman (di arah datang angin) |
| Riau | Kuala Lama | Utara, sekitar 6 km | Aman kecuali angin berputar |
| Kalimantan Tengah | Telaga Kencana | Barat, sekitar 5 km | Terancam lebih dulu |
| Kalimantan Tengah | Pulau Nyiur | Barat laut, sekitar 7 km | Terancam lebih lambat |
| Kalimantan Tengah | Bukit Raya Baru | Timur, sekitar 5 km | Aman |
| Kalimantan Tengah | Sei Gambut | Selatan, sekitar 6 km | Aman kecuali angin berputar |
| Sumatera Selatan | Air Hitam Jaya | Barat laut, sekitar 4 km | Terancam lebih dulu |
| Sumatera Selatan | Mekar Sari | Utara, sekitar 7 km | Terancam lebih lambat |
| Sumatera Selatan | Pasir Putih | Tenggara, sekitar 5 km | Aman |
| Sumatera Selatan | Lubuk Rawa | Timur, sekitar 6 km | Aman kecuali angin berputar |

Jarak dan peran adalah target rancangan; tala posisi desa dan parameter model di `scripts/build-scenario-grid.ts` sampai hasil demo sesuai cerita.

**Contoh seed untuk Riau (supabase/seed.sql)**

```sql
insert into scenarios (slug, name, province, description, center, bbox, origin_lon, origin_lat,
                       default_wind_ms, default_wind_from_deg, grid_url)
values (
  'riau', 'Riau - Lahan Gambut', 'Riau',
  'Skenario demo: beberapa titik panas di lahan gambut dengan dua desa di arah angin.',
  ST_SetSRID(ST_MakePoint(102.00, 0.45), 4326)::geography,
  ST_MakeEnvelope(101.928, 0.378, 102.072, 0.522, 4326),
  101.928, 0.522,
  6.0, 225, '/data/scenarios/riau.json'
);

insert into villages (scenario_id, name, location, population_est)
select s.id, v.name, ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)::geography, v.pop
from scenarios s,
     (values ('Sungai Buluh', 102.025, 0.485, 900),
             ('Tanjung Harapan', 102.060, 0.455, 1200),
             ('Pematang Baru', 101.965, 0.415, 700),
             ('Kuala Lama', 102.000, 0.505, 500)) as v(name, lon, lat, pop)
where s.slug = 'riau';
```

Grid, titik awal api (ignitions), bahan bakar, DEM, dan poligon gambut dibuat oleh skrip dan disimpan di `public/data/scenarios/{slug}.json`; tabel `peat_zones` berisi poligon yang sama agar dapat ditampilkan dan diquery. Isi juga `public/data/fallback/` dengan satu contoh respons hotspot dan cuaca per skenario.

## Pemetaan Tabel ke Endpoint API

| Endpoint | Membaca | Menulis |
| --- | --- | --- |
| GET /api/scenarios | scenarios | - |
| GET /api/scenarios/\[slug\] | scenarios, peat\_zones, villages; berkas grid | - |
| GET /api/hotspots | hotspots (cache); FIRMS bila cache kedaluwarsa | hotspots (upsert berdasarkan external\_id) |
| GET /api/weather | weather\_snapshots (cache); Open-Meteo bila kedaluwarsa | weather\_snapshots |
| POST /api/simulations | scenarios, villages | simulations, firebreak\_recommendations, village\_risks, alerts |
| GET /api/simulations/\[id\] | simulations, firebreak\_recommendations, village\_risks, villages | - |
| GET dashboard (server component) | hotspots, alerts, scenarios | - |

**Aturan cache:** hotspot kedaluwarsa setelah 30 menit dan cuaca setelah 60 menit (berdasarkan fetched\_at). Bila pengambilan live gagal, kembalikan baris terbaru yang ada dengan `stale: true`; bila tabel kosong, pakai berkas cadangan.

**Pembuatan alert saat POST /api/simulations:** untuk tiap desa dengan level siaga atau awas buat satu baris `village_threat` (judul berisi nama desa dan estimasi jam tiba); satu `wind_shift` bila arah angin simulasi berbeda lebih dari 45 derajat dari angin cuaca terbaru.

## Migrasi dan Konvensi

**Alur kerja migrasi (Supabase CLI)**

1. `supabase init` lalu `supabase link --project-ref <ref>`.
2. Simpan berkas SQL di `supabase/migrations/` dengan awalan nomor: `0001_init.sql`, `0002_rls.sql`, `0003_indexes.sql` bila dipisah.
3. Jalankan `supabase db push` untuk menerapkan ke proyek.
4. Isi data: jalankan `supabase/seed.sql` lewat SQL Editor atau `supabase db reset` di lokal.
5. Buat tipe TypeScript: `supabase gen types typescript --project-id <ref> > src/types/database.ts`.

**Konvensi**

| Hal | Aturan |
| --- | --- |
| Nama tabel dan kolom | snake\_case, tabel jamak |
| Kunci utama | uuid dengan default gen\_random\_uuid() |
| Waktu | timestamptz, disimpan UTC; ditampilkan WIB (Asia/Jakarta) di UI |
| Koordinat | longitude lalu latitude pada ST\_MakePoint; SRID 4326 |
| Satuan | tertulis di nama kolom (wind\_ms, length\_km, reduction\_pct, margin\_hours, eta\_hours) |
| Perubahan skema | Selalu migrasi baru, jangan ubah migrasi lama yang sudah dijalankan |
| Data demo | Tandai is\_fictional atau is\_illustrative |
