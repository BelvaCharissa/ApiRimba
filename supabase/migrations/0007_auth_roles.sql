-- Akun pengguna (Supabase Auth), peran, akun demo hanya-baca, dan pembatas laju.
-- Menggantikan PIN petugas bersama: petugas sekarang masuk dengan akun berperan 'petugas' atau 'admin'.
-- Jalankan SETELAH 0005 dan 0006.

-- ---------------------------------------------------------------- profil & peran
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  role text not null default 'warga' check (role in ('warga', 'petugas', 'admin', 'demo')),
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;

drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles for select to authenticated using (id = (select auth.uid()));
-- Tidak ada kebijakan insert/update/delete: peran hanya bisa diubah lewat fungsi admin di bawah.
revoke insert, update, delete on profiles from anon, authenticated;

create or replace function handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (new.id, left(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

insert into profiles (id) select u.id from auth.users u on conflict (id) do nothing;

-- Peran pengguna yang sedang masuk ('anon' bila belum masuk).
create or replace function my_role() returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role from profiles p where p.id = auth.uid()), 'anon');
$$;

create or replace function update_my_profile(p_display_name text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  update profiles set display_name = left(nullif(trim(p_display_name), ''), 80) where id = auth.uid();
end;
$$;

-- Peran staf untuk pemeriksaan di dalam fungsi (null bila bukan staf).
create or replace function _staff_role() returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from profiles p where p.id = auth.uid() and p.role in ('petugas', 'admin', 'demo');
$$;
revoke all on function _staff_role() from public, anon, authenticated;

-- ---------------------------------------------------------------- kepemilikan data
-- auth.uid() terisi otomatis saat warga yang sedang masuk mengirim laporan, bantuan, atau menyimpan simulasi.
alter table reports add column if not exists user_id uuid default auth.uid() references auth.users (id) on delete set null;
alter table reports add column if not exists reviewed_by uuid references auth.users (id) on delete set null;
alter table aid_pledges add column if not exists user_id uuid default auth.uid() references auth.users (id) on delete set null;
alter table aid_events add column if not exists actor uuid references auth.users (id) on delete set null;
alter table simulations add column if not exists user_id uuid default auth.uid() references auth.users (id) on delete set null;
create index if not exists reports_user_idx on reports (user_id) where user_id is not null;
create index if not exists aid_pledges_user_idx on aid_pledges (user_id) where user_id is not null;
create index if not exists simulations_user_idx on simulations (user_id) where user_id is not null;

drop policy if exists reports_select_own on reports;
create policy reports_select_own on reports for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists aid_pledges_select_own on aid_pledges;
create policy aid_pledges_select_own on aid_pledges for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists simulations_select_own on simulations;
create policy simulations_select_own on simulations for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- dasbor staf (pengganti fungsi PIN)
-- Peran 'demo' boleh melihat dasbor, tetapi nama lengkap dan kontak warga disembunyikan dan tidak bisa mengubah apa pun.
create or replace function staff_list_reports(p_limit integer default 150)
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
declare
  v_role text := _staff_role();
  v_demo boolean := v_role = 'demo';
begin
  if v_role is null then raise exception 'officer_denied'; end if;
  return query
    select r.id, r.created_at, r.lat, r.lon, r.category, r.description, r.photo_path, r.status, r.satellite_km, r.exif_km,
           case when v_demo and r.reporter_name is not null then upper(left(r.reporter_name, 1)) || '.' else r.reporter_name end,
           case when v_demo then null else r.contact end,
           r.ai_label, r.ai_confidence, r.ai_reason, r.photo_source, r.place, r.photo_taken_at, r.reviewed_at, r.review_note
    from reports r
    order by (r.status in ('pending', 'matched')) desc, r.created_at desc
    limit least(greatest(p_limit, 1), 300);
end;
$$;

create or replace function staff_review_report(p_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := _staff_role();
begin
  if v_role is null then raise exception 'officer_denied'; end if;
  if v_role = 'demo' then raise exception 'demo_readonly'; end if;
  if p_status not in ('verified', 'rejected', 'pending') then raise exception 'bad_status'; end if;
  update reports
     set status = p_status,
         reviewed_at = case when p_status = 'pending' then null else now() end,
         reviewed_by = auth.uid(),
         review_note = nullif(left(trim(coalesce(p_note, '')), 300), '')
   where reports.id = p_id;
end;
$$;

create or replace function staff_list_pledges(p_limit integer default 300)
returns table (
  id uuid, code text, created_at timestamptz, campaign_key text, aid_type text, quantity integer, dropoff text,
  donor_name text, contact text, status text, status_at timestamptz, status_note text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := _staff_role();
  v_demo boolean := v_role = 'demo';
begin
  if v_role is null then raise exception 'officer_denied'; end if;
  return query
    select a.id, a.code, a.created_at, a.campaign_key, a.aid_type, a.quantity, a.dropoff,
           case when v_demo and a.donor_name is not null then upper(left(a.donor_name, 1)) || '.' else a.donor_name end,
           case when v_demo then null else a.contact end,
           a.status, a.status_at, a.status_note
    from aid_pledges a
    order by (a.status in ('distributed', 'cancelled')) asc, a.created_at desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;

create or replace function staff_set_pledge(p_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := _staff_role();
  v_note text := nullif(left(trim(coalesce(p_note, '')), 300), '');
begin
  if v_role is null then raise exception 'officer_denied'; end if;
  if v_role = 'demo' then raise exception 'demo_readonly'; end if;
  if p_status not in ('pledged', 'confirmed', 'sent', 'received', 'distributed', 'cancelled') then raise exception 'bad_status'; end if;
  update aid_pledges set status = p_status, status_at = now(), status_note = v_note where aid_pledges.id = p_id;
  if found then
    insert into aid_events (pledge_id, status, note, actor) values (p_id, p_status, v_note, auth.uid());
  end if;
end;
$$;

-- ---------------------------------------------------------------- admin: kelola peran
create or replace function admin_list_users(p_limit integer default 200)
returns table (id uuid, email text, display_name text, role text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if _staff_role() is distinct from 'admin' then raise exception 'admin_only'; end if;
  return query
    select p.id, u.email::text, p.display_name, p.role, p.created_at, u.last_sign_in_at
    from profiles p join auth.users u on u.id = p.id
    order by (p.role = 'warga') asc, p.created_at desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;

create or replace function admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _staff_role() is distinct from 'admin' then raise exception 'admin_only'; end if;
  if p_user = auth.uid() then raise exception 'cannot_change_self'; end if;
  if p_role not in ('warga', 'petugas', 'admin') then raise exception 'bad_role'; end if;
  if exists (select 1 from profiles where id = p_user and role = 'demo') then raise exception 'demo_locked'; end if;
  update profiles set role = p_role where id = p_user;
end;
$$;

-- ---------------------------------------------------------------- pembatas laju
create table if not exists rate_limits (
  bucket text not null,
  subject text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, subject, window_start)
);
alter table rate_limits enable row level security;

-- true = masih boleh; false = melewati batas p_max dalam jendela p_window_seconds.
create or replace function rate_hit(p_bucket text, p_subject text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_hits integer;
begin
  if p_window_seconds not between 10 and 86400 or p_max < 1 or char_length(p_bucket) > 40 or char_length(p_subject) > 128 then
    raise exception 'bad_rate_args';
  end if;
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into rate_limits as rl (bucket, subject, window_start, hits)
  values (p_bucket, p_subject, v_start, 1)
  on conflict (bucket, subject, window_start) do update set hits = rl.hits + 1
  returning rl.hits into v_hits;
  if random() < 0.02 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end;
$$;

-- ---------------------------------------------------------------- hak akses
-- Fungsi PIN lama dimatikan: PIN bersama di cookie diganti akun berperan.
revoke execute on function officer_list_reports(text, integer) from anon, authenticated;
revoke execute on function officer_review_report(text, uuid, text, text) from anon, authenticated;
revoke execute on function officer_list_pledges(text, integer) from anon, authenticated;
revoke execute on function officer_set_pledge(text, uuid, text, text) from anon, authenticated;

revoke all on function my_role() from public;
revoke all on function update_my_profile(text) from public;
revoke all on function staff_list_reports(integer) from public;
revoke all on function staff_review_report(uuid, text, text) from public;
revoke all on function staff_list_pledges(integer) from public;
revoke all on function staff_set_pledge(uuid, text, text) from public;
revoke all on function admin_list_users(integer) from public;
revoke all on function admin_set_role(uuid, text) from public;
revoke all on function rate_hit(text, text, integer, integer) from public;

grant execute on function my_role() to anon, authenticated;
grant execute on function update_my_profile(text) to authenticated;
grant execute on function staff_list_reports(integer) to authenticated;
grant execute on function staff_review_report(uuid, text, text) to authenticated;
grant execute on function staff_list_pledges(integer) to authenticated;
grant execute on function staff_set_pledge(uuid, text, text) to authenticated;
grant execute on function admin_list_users(integer) to authenticated;
grant execute on function admin_set_role(uuid, text) to authenticated;
grant execute on function rate_hit(text, text, integer, integer) to anon, authenticated;

-- Jadikan akun pertama sebagai admin (ganti email, jalankan sekali setelah akun itu mendaftar):
--   update profiles set role = 'admin' where id = (select id from auth.users where email = '<email-anda>');
