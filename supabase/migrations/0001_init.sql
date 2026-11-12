-- ApiRimba AI: skema awal (sumber: docs/BSD.md)
create extension if not exists postgis with schema extensions;
set search_path = public, extensions;

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
  grid_url text not null,
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
  is_fictional boolean not null default true,
  unique (scenario_id, name)
);

create table hotspots (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid references scenarios(id) on delete set null,
  external_id text not null unique,
  location geography(Point, 4326) not null,
  acquired_at timestamptz not null,
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
  wind_from_deg int not null check (wind_from_deg between 0 and 359),
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
  ignitions jsonb not null,
  params jsonb not null default '{}'::jsonb,
  data_source text not null default 'live' check (data_source in ('live', 'cache', 'fallback', 'demo')),
  summary jsonb not null,
  arrival_b64 text not null,
  firebreak_applied boolean not null default false,
  ai_briefing text
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
  eta_hours numeric(4,1),
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
create index village_risks_village_idx on village_risks (village_id);
create index alerts_scn_time_idx on alerts (scenario_id, created_at desc);
create index alerts_sim_idx on alerts (simulation_id);
create index alerts_village_idx on alerts (village_id);
create index alerts_hotspot_idx on alerts (hotspot_id);
