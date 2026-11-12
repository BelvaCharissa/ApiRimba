-- Row Level Security (sumber: docs/BSD.md)
-- Data referensi boleh dibaca publik. Tabel hasil simulasi tidak punya kebijakan anon:
-- hanya bisa ditulis dan dibaca lewat fungsi RPC di 0003_rpc.sql.
alter table scenarios enable row level security;
alter table peat_zones enable row level security;
alter table villages enable row level security;
alter table hotspots enable row level security;
alter table weather_snapshots enable row level security;
alter table alerts enable row level security;
alter table simulations enable row level security;
alter table firebreak_recommendations enable row level security;
alter table village_risks enable row level security;

create policy public_read_scenarios on scenarios for select to anon, authenticated using (true);
create policy public_read_peat_zones on peat_zones for select to anon, authenticated using (true);
create policy public_read_villages on villages for select to anon, authenticated using (true);
create policy public_read_hotspots on hotspots for select to anon, authenticated using (true);
create policy public_read_weather on weather_snapshots for select to anon, authenticated using (true);
create policy public_read_alerts on alerts for select to anon, authenticated using (true);
