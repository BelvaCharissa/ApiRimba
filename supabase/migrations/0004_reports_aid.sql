-- Laporan warga (wajib foto) dan komitmen bantuan.
-- Pola sama dengan 0002/0003: tabel dikunci RLS tanpa kebijakan anon; tulis/baca lewat fungsi RPC.

-- ---------------------------------------------------------------- laporan warga
create table reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lat double precision not null check (lat between -15 and 15),
  lon double precision not null check (lon between 90 and 145),
  category text not null check (category in ('fire', 'smoke', 'burnt')),
  description text not null check (char_length(description) between 10 and 1000),
  photo_path text not null check (photo_path like 'reports/%'),
  -- hasil pemeriksaan otomatis (diisi server)
  photo_taken_at timestamptz,
  exif_km numeric(7, 2),
  satellite_km numeric(7, 2),
  status text not null default 'pending' check (status in ('matched', 'pending', 'verified', 'rejected')),
  reporter_name text check (char_length(reporter_name) <= 80),
  contact text check (char_length(contact) <= 120)
);
create index reports_time_idx on reports (created_at desc);
alter table reports enable row level security;

-- ---------------------------------------------------------------- komitmen bantuan
create table aid_pledges (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  campaign_key text not null check (char_length(campaign_key) between 2 and 80),
  aid_type text not null check (aid_type in ('masks', 'water', 'food', 'medical', 'equipment', 'shelter')),
  quantity integer not null check (quantity between 1 and 100000),
  dropoff text not null check (dropoff in ('posko', 'pickup', 'courier')),
  donor_name text check (char_length(donor_name) <= 80),
  contact text check (char_length(contact) <= 120)
);
create index aid_pledges_campaign_idx on aid_pledges (campaign_key, aid_type);
alter table aid_pledges enable row level security;

-- ---------------------------------------------------------------- foto laporan
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- anon hanya boleh mengunggah ke folder reports/ di bucket ini; tidak boleh menimpa atau menghapus
create policy report_photos_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'report-photos' and (storage.foldername(name))[1] = 'reports');

-- ---------------------------------------------------------------- RPC
-- Laporan baru. Ditolak bila foto belum benar-benar ada di storage (tidak bisa lapor tanpa foto).
-- Status 'matched' hanya bila foto ada DAN titik panas satelit atau GPS foto berada <= 5 km.
create or replace function submit_report(
  p_lat double precision,
  p_lon double precision,
  p_category text,
  p_description text,
  p_photo_path text,
  p_photo_taken_at timestamptz,
  p_exif_km numeric,
  p_satellite_km numeric,
  p_reporter_name text,
  p_contact text
) returns uuid
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_id uuid;
  v_status text := 'pending';
begin
  if not exists (select 1 from storage.objects where bucket_id = 'report-photos' and name = p_photo_path) then
    raise exception 'photo_missing';
  end if;
  if exists (select 1 from reports where photo_path = p_photo_path) then
    raise exception 'photo_reused';
  end if;
  if (p_satellite_km is not null and p_satellite_km <= 5) or (p_exif_km is not null and p_exif_km <= 5) then
    v_status := 'matched';
  end if;
  insert into reports (lat, lon, category, description, photo_path, photo_taken_at, exif_km, satellite_km, status, reporter_name, contact)
  values (p_lat, p_lon, p_category, trim(p_description), p_photo_path, p_photo_taken_at, p_exif_km, p_satellite_km, v_status,
          nullif(trim(p_reporter_name), ''), nullif(trim(p_contact), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Daftar laporan publik: tanpa kontak, nama pelapor hanya inisial.
create or replace function list_reports(p_limit integer default 50)
returns table (
  id uuid,
  created_at timestamptz,
  lat double precision,
  lon double precision,
  category text,
  description text,
  photo_path text,
  status text,
  satellite_km numeric,
  exif_km numeric,
  reporter text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.created_at, r.lat, r.lon, r.category, r.description, r.photo_path, r.status, r.satellite_km, r.exif_km,
         case when r.reporter_name is null then null else upper(left(r.reporter_name, 1)) || '.' end
  from reports r
  where r.status <> 'rejected'
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

create or replace function submit_pledge(
  p_campaign_key text,
  p_aid_type text,
  p_quantity integer,
  p_dropoff text,
  p_donor_name text,
  p_contact text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into aid_pledges (campaign_key, aid_type, quantity, dropoff, donor_name, contact)
  values (trim(p_campaign_key), p_aid_type, p_quantity, p_dropoff, nullif(trim(p_donor_name), ''), nullif(trim(p_contact), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Total komitmen per posko dan jenis bantuan (tanpa data pribadi donatur).
create or replace function aid_totals()
returns table (campaign_key text, aid_type text, quantity bigint, donors bigint)
language sql
stable
security definer
set search_path = public
as $$
  select campaign_key, aid_type, sum(quantity)::bigint, count(*)::bigint
  from aid_pledges
  group by campaign_key, aid_type;
$$;

revoke all on function submit_report(double precision, double precision, text, text, text, timestamptz, numeric, numeric, text, text) from public;
revoke all on function list_reports(integer) from public;
revoke all on function submit_pledge(text, text, integer, text, text, text) from public;
revoke all on function aid_totals() from public;
grant execute on function submit_report(double precision, double precision, text, text, text, timestamptz, numeric, numeric, text, text) to anon, authenticated;
grant execute on function list_reports(integer) to anon, authenticated;
grant execute on function submit_pledge(text, text, integer, text, text, text) to anon, authenticated;
grant execute on function aid_totals() to anon, authenticated;
