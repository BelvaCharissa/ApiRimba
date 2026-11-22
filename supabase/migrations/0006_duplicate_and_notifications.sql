-- Duplicate photo reports and notification-ready delivery tracking.

alter table reports
  add column if not exists photo_sha256 text
  check (photo_sha256 is null or photo_sha256 ~ '^[0-9a-f]{64}$');

create index if not exists reports_photo_duplicate_idx
  on reports (photo_sha256, created_at)
  where photo_sha256 is not null;

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
  p_place text,
  p_photo_sha256 text
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
  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'report-photos' and o.name = p_photo_path
  ) then
    raise exception 'photo_missing';
  end if;

  if exists (select 1 from reports r where r.photo_path = p_photo_path) then
    raise exception 'photo_reused';
  end if;

  if p_photo_sha256 is not null and exists (
    select 1
    from reports r
    where r.photo_sha256 = p_photo_sha256
      and r.created_at > now() - interval '24 hours'
      and 6371 * 2 * asin(
        sqrt(
          sin(radians((r.lat - p_lat) / 2)) ^ 2
          + cos(radians(p_lat)) * cos(radians(r.lat))
            * sin(radians((r.lon - p_lon) / 2)) ^ 2
        )
      ) <= 5
  ) then
    raise exception 'duplicate_report';
  end if;

  if p_ai_label in ('fire', 'smoke', 'burnt') and v_fresh
     and ((p_satellite_km is not null and p_satellite_km <= 5)
       or (p_exif_km is not null and p_exif_km <= 5)) then
    v_status := 'matched';
  end if;

  insert into reports (
    lat, lon, category, description, photo_path, photo_taken_at, exif_km, satellite_km, status,
    reporter_name, contact, ai_label, ai_confidence, ai_reason, photo_source, place, photo_sha256
  ) values (
    p_lat, p_lon, p_category, trim(p_description), p_photo_path, p_photo_taken_at, p_exif_km, p_satellite_km, v_status,
    nullif(trim(p_reporter_name), ''), nullif(trim(p_contact), ''), p_ai_label, p_ai_confidence,
    left(p_ai_reason, 300), p_photo_source, left(p_place, 80), lower(p_photo_sha256)
  )
  returning reports.id into v_id;

  return query select v_id, v_status;
end;
$$;
