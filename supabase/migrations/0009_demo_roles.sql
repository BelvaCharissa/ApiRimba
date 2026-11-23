-- Demo yang bisa dicoba penuh oleh juri, tanpa membuka data pribadi warga.
-- * 'demo'       = Demo Verifier: kini BOLEH memverifikasi laporan dan memperbarui status bantuan.
--                  Nama warga tetap disingkat dan kontak tetap disembunyikan.
-- * 'demo_admin' = Demo Admin: membuka halaman admin, tetapi email akun sungguhan disamarkan dan
--                  hanya boleh mengubah peran akun warga demo (@demo.apirimba.id).
-- Jalankan SETELAH 0007 dan 0008.

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('warga', 'petugas', 'admin', 'demo', 'demo_admin'));

create or replace function _staff_role() returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from profiles p where p.id = auth.uid() and p.role in ('petugas', 'admin', 'demo', 'demo_admin');
$$;
revoke all on function _staff_role() from public, anon, authenticated;

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
  v_demo boolean := v_role in ('demo', 'demo_admin');
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
  v_demo boolean := v_role in ('demo', 'demo_admin');
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
  if p_status not in ('pledged', 'confirmed', 'sent', 'received', 'distributed', 'cancelled') then raise exception 'bad_status'; end if;
  update aid_pledges set status = p_status, status_at = now(), status_note = v_note where aid_pledges.id = p_id;
  if found then
    insert into aid_events (pledge_id, status, note, actor) values (p_id, p_status, v_note, auth.uid());
  end if;
end;
$$;

create or replace function admin_list_users(p_limit integer default 200)
returns table (id uuid, email text, display_name text, role text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_role text := _staff_role();
  v_demo boolean := v_role = 'demo_admin';
begin
  if v_role is null or v_role not in ('admin', 'demo_admin') then raise exception 'admin_only'; end if;
  return query
    select p.id,
           case
             when not v_demo or u.email like '%@demo.apirimba.id' or u.email like '%@apirimba.app' then u.email::text
             else left(u.email, 1) || '***@' || split_part(u.email, '@', 2)
           end,
           case when v_demo and u.email not like '%@demo.apirimba.id' and u.email not like '%@apirimba.app' and p.display_name is not null
                then upper(left(p.display_name, 1)) || '.' else p.display_name end,
           p.role, p.created_at, u.last_sign_in_at
    from profiles p join auth.users u on u.id = p.id
    order by (p.role = 'warga') asc, p.created_at desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;

create or replace function admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role text := _staff_role();
begin
  if v_role is null or v_role not in ('admin', 'demo_admin') then raise exception 'admin_only'; end if;
  if p_user = auth.uid() then raise exception 'cannot_change_self'; end if;
  if p_role not in ('warga', 'petugas', 'admin') then raise exception 'bad_role'; end if;
  if exists (select 1 from profiles where id = p_user and role in ('demo', 'demo_admin')) then raise exception 'demo_locked'; end if;
  -- Demo Admin hanya boleh mengatur akun warga demo, dan tidak boleh membuat admin baru.
  if v_role = 'demo_admin' then
    if p_role = 'admin' then raise exception 'demo_limited'; end if;
    if not exists (select 1 from auth.users u where u.id = p_user and u.email like '%@demo.apirimba.id') then
      raise exception 'demo_limited';
    end if;
  end if;
  update profiles set role = p_role where id = p_user;
end;
$$;

-- CREATE OR REPLACE mempertahankan hak akses lama; pastikan tetap tertutup bagi tamu.
revoke execute on function staff_list_reports(integer) from anon;
revoke execute on function staff_review_report(uuid, text, text) from anon;
revoke execute on function staff_list_pledges(integer) from anon;
revoke execute on function staff_set_pledge(uuid, text, text) from anon;
revoke execute on function admin_list_users(integer) from anon;
revoke execute on function admin_set_role(uuid, text) from anon;
