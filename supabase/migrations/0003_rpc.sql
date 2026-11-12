-- Fungsi RPC untuk menyimpan dan membaca hasil simulasi.
-- Perbedaan dari BSD: alih-alih service role key di server, penulisan memakai fungsi
-- SECURITY DEFINER dengan validasi di dalam fungsi. Klien tetap tidak bisa membaca daftar
-- simulasi; laporan hanya bisa dibuka dengan UUID-nya.
set search_path = public, extensions;

create or replace function public.save_simulation(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_scenario scenarios%rowtype;
  v_sim_id uuid;
  v_rec jsonb;
  v_risk jsonb;
  v_village_id uuid;
  v_coords jsonb;
  v_line geometry;
  v_eta numeric;
begin
  if p is null or octet_length(p::text) > 200000 then
    raise exception 'payload terlalu besar' using errcode = '22023';
  end if;

  select * into v_scenario from scenarios where slug = p->>'scenarioSlug';
  if not found then
    raise exception 'skenario tidak ditemukan' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p->'recommendations', '[]'::jsonb)) > 3
     or jsonb_array_length(coalesce(p->'villageRisks', '[]'::jsonb)) > 40
     or length(coalesce(p->>'arrivalB64', '')) > 60000
     or length(coalesce(p->>'aiBriefing', '')) > 6000 then
    raise exception 'isi payload melebihi batas' using errcode = '22023';
  end if;

  insert into simulations (scenario_id, label, wind_ms, wind_from_deg, seed, steps, step_minutes,
                           ignitions, params, data_source, summary, arrival_b64, firebreak_applied, ai_briefing)
  values (
    v_scenario.id,
    left(p->>'label', 120),
    (p->>'windMs')::numeric,
    (p->>'windFromDeg')::int,
    (p->>'seed')::int,
    coalesce((p->>'steps')::int, 48),
    coalesce((p->>'stepMinutes')::int, 15),
    coalesce(p->'ignitions', '[]'::jsonb),
    coalesce(p->'params', '{}'::jsonb),
    coalesce(p->>'dataSource', 'live'),
    coalesce(p->'summary', '{}'::jsonb),
    p->>'arrivalB64',
    coalesce((p->>'firebreakApplied')::boolean, false),
    p->>'aiBriefing'
  )
  returning id into v_sim_id;

  for v_rec in select * from jsonb_array_elements(coalesce(p->'recommendations', '[]'::jsonb)) loop
    v_coords := v_rec->'line'->'coordinates';
    v_line := ST_SetSRID(ST_MakeLine(
      ST_MakePoint((v_coords->0->>0)::float8, (v_coords->0->>1)::float8),
      ST_MakePoint((v_coords->1->>0)::float8, (v_coords->1->>1)::float8)
    ), 4326);
    insert into firebreak_recommendations (simulation_id, rank, line, width_m, length_km, score,
                                           reduction_pct, margin_hours, villages_saved, peat_bypass_risk, note, applied)
    values (
      v_sim_id,
      (v_rec->>'rank')::int,
      v_line,
      coalesce((v_rec->>'widthM')::int, 500),
      (v_rec->>'lengthKm')::numeric,
      greatest(0, least(100, (v_rec->>'score')::numeric)),
      (v_rec->>'reductionPct')::numeric,
      greatest(-99, least(99, (v_rec->>'marginHours')::numeric)),
      coalesce((v_rec->>'villagesSaved')::int, 0),
      coalesce((v_rec->>'peatBypassRisk')::boolean, false),
      left(v_rec->>'note', 400),
      coalesce((v_rec->>'applied')::boolean, false)
    );
  end loop;

  for v_risk in select * from jsonb_array_elements(coalesce(p->'villageRisks', '[]'::jsonb)) loop
    select id into v_village_id from villages
      where scenario_id = v_scenario.id and name = v_risk->>'villageName';
    if v_village_id is null then
      continue;
    end if;
    v_eta := nullif(v_risk->>'etaHours', '')::numeric;
    insert into village_risks (simulation_id, village_id, variant, eta_hours, burn_probability, level)
    values (
      v_sim_id, v_village_id,
      coalesce(v_risk->>'variant', 'baseline'),
      v_eta,
      (v_risk->>'burnProbability')::numeric,
      v_risk->>'level'
    )
    on conflict (simulation_id, village_id, variant) do nothing;

    if coalesce(v_risk->>'variant', 'baseline') = 'baseline' and v_risk->>'level' in ('siaga', 'awas') then
      insert into alerts (scenario_id, simulation_id, village_id, type, level, title, body, expires_at)
      values (
        v_scenario.id, v_sim_id, v_village_id, 'village_threat', v_risk->>'level',
        'Desa ' || (v_risk->>'villageName') || ': api diperkirakan tiba dalam ' ||
          replace(to_char(v_eta, 'FM990.0'), '.', ',') || ' jam',
        'Siapkan koordinasi evakuasi dan perlindungan permukiman.',
        now() + interval '24 hours'
      );
    end if;
  end loop;

  return v_sim_id;
end;
$$;

create or replace function public.get_simulation(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'id', s.id,
    'createdAt', s.created_at,
    'label', s.label,
    'scenarioSlug', sc.slug,
    'scenarioName', sc.name,
    'province', sc.province,
    'windMs', s.wind_ms,
    'windFromDeg', s.wind_from_deg,
    'seed', s.seed,
    'steps', s.steps,
    'stepMinutes', s.step_minutes,
    'ignitions', s.ignitions,
    'params', s.params,
    'dataSource', s.data_source,
    'summary', s.summary,
    'arrivalB64', s.arrival_b64,
    'firebreakApplied', s.firebreak_applied,
    'aiBriefing', s.ai_briefing,
    'recommendations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', r.rank,
        'line', ST_AsGeoJSON(r.line)::jsonb,
        'widthM', r.width_m,
        'lengthKm', r.length_km,
        'score', r.score,
        'reductionPct', r.reduction_pct,
        'marginHours', r.margin_hours,
        'villagesSaved', r.villages_saved,
        'peatBypassRisk', r.peat_bypass_risk,
        'note', r.note,
        'applied', r.applied
      ) order by r.rank)
      from firebreak_recommendations r where r.simulation_id = s.id
    ), '[]'::jsonb),
    'villageRisks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'villageName', v.name,
        'variant', vr.variant,
        'etaHours', vr.eta_hours,
        'burnProbability', vr.burn_probability,
        'level', vr.level
      ) order by vr.variant, vr.eta_hours nulls last)
      from village_risks vr join villages v on v.id = vr.village_id
      where vr.simulation_id = s.id
    ), '[]'::jsonb)
  )
  from simulations s join scenarios sc on sc.id = s.scenario_id
  where s.id = p_id;
$$;

revoke all on function public.save_simulation(jsonb) from public;
revoke all on function public.get_simulation(uuid) from public;
grant execute on function public.save_simulation(jsonb) to anon, authenticated;
grant execute on function public.get_simulation(uuid) to anon, authenticated;
