-- Verifikasi petugas, pemeriksaan foto oleh AI, dan pelacakan penyaluran bantuan.
-- Pola sama dengan 0004: tabel dikunci RLS; semua akses lewat fungsi RPC security definer.
-- Fungsi petugas memeriksa PIN petugas (disimpan sebagai hash bcrypt di app_secrets).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- rahasia aplikasi
create table if not exists app_secrets (
  key text primary key,
  hash text not null
);
alter table app_secrets enable row level security;

create or replace function _officer_ok(p_pin text) returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from app_secrets s
    where s.key = 'officer_pin' and p_pin is not null and length(p_pin) >= 6 and s.hash = crypt(p_pin, s.hash)
  );
$$;
revoke all on function _officer_ok(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- laporan: kolom baru
alter table reports
  add column if not exists ai_label text check (ai_label in ('fire', 'smoke', 'burnt', 'none', 'unclear')),
  add column if not exists ai_confidence numeric(4, 3),
  add column if not exists ai_reason text check (char_length(ai_reason) <= 300),
  add column if not exists photo_source text check (photo_source in ('camera', 'gallery')),
  add column if not exists place text check (char_length(place) <= 80),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text check (char_length(review_note) <= 300);

-- submit_report lama (10 argumen) tetap ada agar versi aplikasi lama tidak rusak; versi baru menambah argumen AI.

-- Status 'matched' hanya bila AI melihat api/asap/bekas terbakar DAN (titik panas satelit atau GPS foto <= 5 km)
-- DAN foto tidak lebih tua dari 48 jam. Selain itu 'pending' menunggu petugas.
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
  p_contact text,
  p_ai_label text,
  p_ai_confidence numeric,
  p_ai_reason text,
  p_photo_source text,
  p_place text
) returns table (id uuid, status text)
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_id uuid;
  v_status text := 'pending';
  v_fresh boolean := p_photo_taken_at is null or p_photo_taken_at > now() - interval '48 hours';
begin
  if not exists (select 1 from storage.objects o where o.bucket_id = 'report-photos' and o.name = p_photo_path) then
    raise exception 'photo_missing';
  end if;
  if exists (select 1 from reports r where r.photo_path = p_photo_path) then
    raise exception 'photo_reused';
  end if;
  if p_ai_label in ('fire', 'smoke', 'burnt') and v_fresh
     and ((p_satellite_km is not null and p_satellite_km <= 5) or (p_exif_km is not null and p_exif_km <= 5)) then
    v_status := 'matched';
  end if;
  insert into reports (lat, lon, category, description, photo_path, photo_taken_at, exif_km, satellite_km, status,
                       reporter_name, contact, ai_label, ai_confidence, ai_reason, photo_source, place)
  values (p_lat, p_lon, p_category, trim(p_description), p_photo_path, p_photo_taken_at, p_exif_km, p_satellite_km, v_status,
          nullif(trim(p_reporter_name), ''), nullif(trim(p_contact), ''), p_ai_label, p_ai_confidence, left(p_ai_reason, 300),
          p_photo_source, left(p_place, 80))
  returning reports.id into v_id;
  return query select v_id, v_status;
end;
$$;

drop function if exists list_reports(integer);
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
  reporter text,
  ai_label text,
  ai_confidence numeric,
  photo_source text,
  place text,
  photo_taken_at timestamptz,
  reviewed_at timestamptz,
  review_note text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.created_at, r.lat, r.lon, r.category, r.description, r.photo_path, r.status, r.satellite_km, r.exif_km,
         case when r.reporter_name is null then null else upper(left(r.reporter_name, 1)) || '.' end,
         r.ai_label, r.ai_confidence, r.photo_source, r.place, r.photo_taken_at, r.reviewed_at, r.review_note
  from reports r
  where r.status <> 'rejected'
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- Petugas: semua laporan termasuk kontak dan yang ditolak.
create or replace function officer_list_reports(p_pin text, p_limit integer default 100)
returns table (
  id uuid, created_at timestamptz, lat double precision, lon double precision, category text, description text,
  photo_path text, status text, satellite_km numeric, exif_km numeric, reporter_name text, contact text,
  ai_label text, ai_confidence numeric, ai_reason text, photo_source text, place text, photo_taken_at timestamptz,
  reviewed_at timestamptz, review_note text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not _officer_ok(p_pin) then raise exception 'officer_denied'; end if;
  return query
    select r.id, r.created_at, r.lat, r.lon, r.category, r.description, r.photo_path, r.status, r.satellite_km, r.exif_km,
           r.reporter_name, r.contact, r.ai_label, r.ai_confidence, r.ai_reason, r.photo_source, r.place, r.photo_taken_at,
           r.reviewed_at, r.review_note
    from reports r
    order by (r.status in ('pending', 'matched')) desc, r.created_at desc
    limit least(greatest(p_limit, 1), 300);
end;
$$;

create or replace function officer_review_report(p_pin text, p_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not _officer_ok(p_pin) then raise exception 'officer_denied'; end if;
  if p_status not in ('verified', 'rejected', 'pending') then raise exception 'bad_status'; end if;
  update reports
     set status = p_status,
         reviewed_at = case when p_status = 'pending' then null else now() end,
         review_note = nullif(left(trim(coalesce(p_note, '')), 300), '')
   where id = p_id;
end;
$$;

-- ---------------------------------------------------------------- bantuan: status penyaluran
alter table aid_pledges
  add column if not exists code text,
  add column if not exists status text not null default 'pledged'
    check (status in ('pledged', 'confirmed', 'sent', 'received', 'distributed', 'cancelled')),
  add column if not exists status_at timestamptz not null default now(),
  add column if not exists status_note text check (char_length(status_note) <= 300);

-- kode lacak pendek untuk komitmen lama
update aid_pledges set code = 'AR-' || upper(substr(replace(id::text, '-', ''), 1, 6)) where code is null;
alter table aid_pledges alter column code set default ('AR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)));
alter table aid_pledges alter column code set not null;
create unique index if not exists aid_pledges_code_idx on aid_pledges (code);

create table if not exists aid_events (
  id bigint generated always as identity primary key,
  pledge_id uuid not null references aid_pledges (id) on delete cascade,
  status text not null,
  note text,
  at timestamptz not null default now()
);
create index if not exists aid_events_pledge_idx on aid_events (pledge_id, at);
alter table aid_events enable row level security;

insert into aid_events (pledge_id, status, at)
select p.id, 'pledged', p.created_at from aid_pledges p
where not exists (select 1 from aid_events e where e.pledge_id = p.id);

-- submit_pledge lama tetap ada (kode lacak diisi default kolom); versi baru mengembalikan kode lacak.
create or replace function submit_pledge_v2(
  p_campaign_key text,
  p_aid_type text,
  p_quantity integer,
  p_dropoff text,
  p_donor_name text,
  p_contact text
) returns table (id uuid, code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_code text;
begin
  loop
    v_code := 'AR-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
    exit when not exists (select 1 from aid_pledges a where a.code = v_code);
  end loop;
  insert into aid_pledges (campaign_key, aid_type, quantity, dropoff, donor_name, contact, code)
  values (trim(p_campaign_key), p_aid_type, p_quantity, p_dropoff, nullif(trim(p_donor_name), ''), nullif(trim(p_contact), ''), v_code)
  returning aid_pledges.id into v_id;
  insert into aid_events (pledge_id, status) values (v_id, 'pledged');
  return query select v_id, v_code;
end;
$$;

-- Total per posko dan jenis: dijanjikan (belum batal) dan sudah sampai/disalurkan.
drop function if exists aid_totals();
create or replace function aid_totals()
returns table (campaign_key text, aid_type text, quantity bigint, delivered bigint, donors bigint)
language sql
stable
security definer
set search_path = public
as $$
  select a.campaign_key, a.aid_type,
         sum(a.quantity) filter (where a.status <> 'cancelled')::bigint,
         coalesce(sum(a.quantity) filter (where a.status in ('received', 'distributed')), 0)::bigint,
         count(*) filter (where a.status <> 'cancelled')::bigint
  from aid_pledges a
  group by a.campaign_key, a.aid_type;
$$;

-- Daftar publik penyaluran terbaru (tanpa kontak, nama donatur hanya inisial).
create or replace function list_pledges(p_limit integer default 30)
returns table (
  code text, created_at timestamptz, campaign_key text, aid_type text, quantity integer, dropoff text,
  status text, status_at timestamptz, donor text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.code, a.created_at, a.campaign_key, a.aid_type, a.quantity, a.dropoff, a.status, a.status_at,
         case when a.donor_name is null then null else upper(left(a.donor_name, 1)) || '.' end
  from aid_pledges a
  where a.status <> 'cancelled'
  order by a.status_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- Lacak satu komitmen dengan kodenya: data publik + riwayat status.
create or replace function track_pledge(p_code text)
returns table (
  code text, created_at timestamptz, campaign_key text, aid_type text, quantity integer, dropoff text,
  status text, status_at timestamptz, status_note text, events jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select a.code, a.created_at, a.campaign_key, a.aid_type, a.quantity, a.dropoff, a.status, a.status_at, a.status_note,
         coalesce((select jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'at', e.at) order by e.at)
                   from aid_events e where e.pledge_id = a.id), '[]'::jsonb)
  from aid_pledges a
  where a.code = upper(trim(p_code));
$$;

create or replace function officer_list_pledges(p_pin text, p_limit integer default 200)
returns table (
  id uuid, code text, created_at timestamptz, campaign_key text, aid_type text, quantity integer, dropoff text,
  donor_name text, contact text, status text, status_at timestamptz, status_note text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not _officer_ok(p_pin) then raise exception 'officer_denied'; end if;
  return query
    select a.id, a.code, a.created_at, a.campaign_key, a.aid_type, a.quantity, a.dropoff, a.donor_name, a.contact,
           a.status, a.status_at, a.status_note
    from aid_pledges a
    order by (a.status in ('distributed', 'cancelled')) asc, a.created_at desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;

create or replace function officer_set_pledge(p_pin text, p_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not _officer_ok(p_pin) then raise exception 'officer_denied'; end if;
  if p_status not in ('pledged', 'confirmed', 'sent', 'received', 'distributed', 'cancelled') then raise exception 'bad_status'; end if;
  update aid_pledges
     set status = p_status, status_at = now(), status_note = nullif(left(trim(coalesce(p_note, '')), 300), '')
   where id = p_id;
  if found then
    insert into aid_events (pledge_id, status, note) values (p_id, p_status, nullif(left(trim(coalesce(p_note, '')), 300), ''));
  end if;
end;
$$;

-- ---------------------------------------------------------------- hak akses
revoke all on function submit_report(double precision, double precision, text, text, text, timestamptz, numeric, numeric, text, text, text, numeric, text, text, text) from public;
revoke all on function list_reports(integer) from public;
revoke all on function officer_list_reports(text, integer) from public;
revoke all on function officer_review_report(text, uuid, text, text) from public;
revoke all on function submit_pledge_v2(text, text, integer, text, text, text) from public;
revoke all on function aid_totals() from public;
revoke all on function list_pledges(integer) from public;
revoke all on function track_pledge(text) from public;
revoke all on function officer_list_pledges(text, integer) from public;
revoke all on function officer_set_pledge(text, uuid, text, text) from public;

grant execute on function submit_report(double precision, double precision, text, text, text, timestamptz, numeric, numeric, text, text, text, numeric, text, text, text) to anon, authenticated;
grant execute on function list_reports(integer) to anon, authenticated;
grant execute on function officer_list_reports(text, integer) to anon, authenticated;
grant execute on function officer_review_report(text, uuid, text, text) to anon, authenticated;
grant execute on function submit_pledge_v2(text, text, integer, text, text, text) to anon, authenticated;
grant execute on function aid_totals() to anon, authenticated;
grant execute on function list_pledges(integer) to anon, authenticated;
grant execute on function track_pledge(text) to anon, authenticated;
grant execute on function officer_list_pledges(text, integer) to anon, authenticated;
grant execute on function officer_set_pledge(text, uuid, text, text) to anon, authenticated;

-- PIN petugas diatur terpisah (jangan disimpan di repo):
--   insert into app_secrets (key, hash) values ('officer_pin', extensions.crypt('<PIN>', extensions.gen_salt('bf')))
--   on conflict (key) do update set hash = excluded.hash;
