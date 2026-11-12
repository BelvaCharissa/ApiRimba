-- Dibuat oleh scripts/build-scenario-grid.ts. Data demo (ilustrasi, desa fiktif).
set search_path = public, extensions;

insert into scenarios (slug, name, province, description, center, bbox, grid_w, grid_h, cell_size_m, origin_lon, origin_lat, default_wind_ms, default_wind_from_deg, default_seed, grid_url)
values ('riau', 'Riau - Lahan Gambut', 'Riau', 'Beberapa titik panas di kubah gambut kering. Angin barat daya mendorong api ke arah dua desa.',
  ST_SetSRID(ST_MakePoint(102, 0.45), 4326)::geography,
  ST_MakeEnvelope(101.928133, 0.378135, 102.071867, 0.521865, 4326), 64, 64, 250, 101.928133, 0.521865,
  6, 225, 20261112, '/data/scenarios/riau.json')
on conflict (slug) do update set name = excluded.name, description = excluded.description, center = excluded.center,
  bbox = excluded.bbox, origin_lon = excluded.origin_lon, origin_lat = excluded.origin_lat,
  default_wind_ms = excluded.default_wind_ms, default_wind_from_deg = excluded.default_wind_from_deg;
insert into villages (scenario_id, name, location, population_est)
select s.id, v.name, ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)::geography, v.pop
from scenarios s, (values ('Sungai Buluh', 102.007861, 0.455614, 900),
         ('Tanjung Harapan', 102.04604, 0.430911, 1200),
         ('Pematang Baru', 101.951714, 0.39947, 700),
         ('Kuala Lama', 101.983156, 0.48481, 500)) as v(name, lon, lat, pop)
where s.slug = 'riau'
on conflict (scenario_id, name) do update set location = excluded.location, population_est = excluded.population_est;
delete from peat_zones where scenario_id = (select id from scenarios where slug = 'riau');
insert into peat_zones (scenario_id, name, geom, moisture_index)
select id, 'Kubah Gambut Buluh', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[102.024756,0.470049],[102.02639,0.467594],[102.027495,0.46476],[102.028054,0.461597],[102.028055,0.458159],[102.0275,0.454505],[102.026397,0.450696],[102.024766,0.446799],[102.022634,0.44288],[102.020038,0.439006],[102.017022,0.435243],[102.013639,0.431655],[102.009945,0.428305],[102.006004,0.425249],[102.001883,0.422539],[101.997653,0.420223],[101.993387,0.418339],[101.989157,0.416921],[101.985035,0.415991],[101.981093,0.415566],[101.977398,0.415654],[101.974012,0.416252],[101.970994,0.417352],[101.968396,0.418932],[101.966261,0.420968],[101.964627,0.423423],[101.963522,0.426257],[101.962963,0.42942],[101.962962,0.432858],[101.963517,0.436512],[101.96462,0.440321],[101.966251,0.444218],[101.968383,0.448137],[101.970979,0.452011],[101.973995,0.455774],[101.977378,0.459362],[101.981072,0.462712],[101.985013,0.465768],[101.989134,0.468478],[101.993364,0.470794],[101.99763,0.472678],[102.00186,0.474096],[102.005982,0.475026],[102.009924,0.475451],[102.013619,0.475363],[102.017005,0.474765],[102.020023,0.473665],[102.022621,0.472085],[102.024756,0.470049]]]}'), 4326)), 0.22
from scenarios where slug = 'riau';
insert into peat_zones (scenario_id, name, geom, moisture_index)
select id, 'Gambut Harapan', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[102.051348,0.428524],[102.050872,0.426822],[102.050064,0.425209],[102.048937,0.423713],[102.047511,0.422359],[102.04581,0.421171],[102.043863,0.420169],[102.041703,0.419369],[102.039368,0.418787],[102.036898,0.418431],[102.034334,0.418308],[102.03172,0.418419],[102.029102,0.418764],[102.026524,0.419335],[102.02403,0.420124],[102.021663,0.421117],[102.019463,0.422297],[102.017468,0.423643],[102.015712,0.425132],[102.014225,0.42674],[102.013033,0.428438],[102.012156,0.430198],[102.011609,0.431989],[102.011401,0.433781],[102.011537,0.435544],[102.012012,0.437246],[102.01282,0.438859],[102.013947,0.440355],[102.015373,0.441708],[102.017074,0.442897],[102.019021,0.443899],[102.021181,0.444698],[102.023516,0.445281],[102.025986,0.445637],[102.02855,0.44576],[102.031164,0.445648],[102.033782,0.445304],[102.03636,0.444732],[102.038854,0.443943],[102.041221,0.442951],[102.043421,0.441771],[102.045416,0.440425],[102.047172,0.438935],[102.048659,0.437328],[102.049851,0.435629],[102.050728,0.433869],[102.051275,0.432078],[102.051483,0.430286],[102.051348,0.428524]]]}'), 4326)), 0.35
from scenarios where slug = 'riau';

insert into scenarios (slug, name, province, description, center, bbox, grid_w, grid_h, cell_size_m, origin_lon, origin_lat, default_wind_ms, default_wind_from_deg, default_seed, grid_url)
values ('kalteng', 'Kalimantan Tengah - Eks PLG', 'Kalimantan Tengah', 'Lahan gambut eks proyek lahan sejuta hektare dengan kanal. Angin timur membawa api ke barat.',
  ST_SetSRID(ST_MakePoint(113.95, -2.3), 4326)::geography,
  ST_MakeEnvelope(113.878077, -2.371865, 114.021923, -2.228135, 4326), 64, 64, 250, 113.878077, -2.228135,
  6, 90, 20261112, '/data/scenarios/kalteng.json')
on conflict (slug) do update set name = excluded.name, description = excluded.description, center = excluded.center,
  bbox = excluded.bbox, origin_lon = excluded.origin_lon, origin_lat = excluded.origin_lat,
  default_wind_ms = excluded.default_wind_ms, default_wind_from_deg = excluded.default_wind_from_deg;
insert into villages (scenario_id, name, location, population_est)
select s.id, v.name, ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)::geography, v.pop
from scenarios s, (values ('Telaga Kencana', 113.924153, -2.301123, 800),
         ('Pulau Nyiur', 113.924153, -2.256207, 650),
         ('Bukit Raya Baru', 114.014056, -2.301123, 1100),
         ('Sei Gambut', 113.969104, -2.355022, 550)) as v(name, lon, lat, pop)
where s.slug = 'kalteng'
on conflict (scenario_id, name) do update set location = excluded.location, population_est = excluded.population_est;
delete from peat_zones where scenario_id = (select id from scenarios where slug = 'kalteng');
insert into peat_zones (scenario_id, name, geom, moisture_index)
select id, 'Blok Gambut C', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[113.986754,-2.306552],[113.985566,-2.309572],[113.983692,-2.312352],[113.981165,-2.314843],[113.978028,-2.317003],[113.974334,-2.318796],[113.970148,-2.32019],[113.965539,-2.321162],[113.960588,-2.321695],[113.955378,-2.32178],[113.95,-2.321415],[113.944545,-2.320608],[113.939106,-2.31937],[113.933776,-2.317725],[113.928648,-2.315699],[113.923808,-2.313328],[113.919339,-2.310651],[113.915317,-2.307716],[113.911812,-2.304572],[113.908884,-2.301273],[113.906582,-2.297875],[113.904947,-2.294437],[113.904005,-2.291017],[113.903773,-2.287674],[113.904256,-2.284465],[113.905444,-2.281445],[113.907317,-2.278665],[113.909844,-2.276174],[113.912981,-2.274013],[113.916675,-2.272221],[113.920862,-2.270826],[113.92547,-2.269855],[113.930422,-2.269322],[113.935631,-2.269237],[113.94101,-2.269601],[113.946465,-2.270409],[113.951904,-2.271647],[113.957233,-2.273292],[113.962362,-2.275318],[113.967202,-2.277689],[113.971671,-2.280365],[113.975692,-2.283301],[113.979197,-2.286445],[113.982125,-2.289744],[113.984427,-2.293142],[113.986063,-2.29658],[113.987004,-2.3],[113.987236,-2.303343],[113.986754,-2.306552]]]}'), 4326)), 0.2
from scenarios where slug = 'kalteng';
insert into peat_zones (scenario_id, name, geom, moisture_index)
select id, 'Gambut Kanal Utara', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[113.95314,-2.251895],[113.953661,-2.253889],[113.953813,-2.25598],[113.953591,-2.258133],[113.953001,-2.26031],[113.952051,-2.262475],[113.950759,-2.26459],[113.949146,-2.26662],[113.94724,-2.268529],[113.945073,-2.270284],[113.942683,-2.271857],[113.940111,-2.273219],[113.9374,-2.274348],[113.934597,-2.275225],[113.93175,-2.275833],[113.928908,-2.276163],[113.926119,-2.27621],[113.923431,-2.275972],[113.92089,-2.275453],[113.918539,-2.274663],[113.916419,-2.273614],[113.914566,-2.272325],[113.913011,-2.270819],[113.911782,-2.269119],[113.910899,-2.267257],[113.910377,-2.265263],[113.910226,-2.263172],[113.910447,-2.261019],[113.911038,-2.258842],[113.911987,-2.256677],[113.91328,-2.254562],[113.914893,-2.252532],[113.916799,-2.250623],[113.918965,-2.248867],[113.921355,-2.247295],[113.923927,-2.245932],[113.926638,-2.244804],[113.929441,-2.243927],[113.932288,-2.243319],[113.93513,-2.242989],[113.937919,-2.242942],[113.940607,-2.24318],[113.943149,-2.243699],[113.945499,-2.244489],[113.947619,-2.245538],[113.949473,-2.246826],[113.951027,-2.248333],[113.952257,-2.250032],[113.95314,-2.251895]]]}'), 4326)), 0.3
from scenarios where slug = 'kalteng';

insert into scenarios (slug, name, province, description, center, bbox, grid_w, grid_h, cell_size_m, origin_lon, origin_lat, default_wind_ms, default_wind_from_deg, default_seed, grid_url)
values ('sumsel', 'Sumatera Selatan - OKI', 'Sumatera Selatan', 'Gambut pesisir timur Sumatera Selatan. Angin tenggara mengarahkan api ke barat laut.',
  ST_SetSRID(ST_MakePoint(105.4, -3.3), 4326)::geography,
  ST_MakeEnvelope(105.328016, -3.371865, 105.471985, -3.228135, 4326), 64, 64, 250, 105.328016, -3.228135,
  5, 135, 20261112, '/data/scenarios/sumsel.json')
on conflict (slug) do update set name = excluded.name, description = excluded.description, center = excluded.center,
  bbox = excluded.bbox, origin_lon = excluded.origin_lon, origin_lat = excluded.origin_lat,
  default_wind_ms = excluded.default_wind_ms, default_wind_from_deg = excluded.default_wind_from_deg;
insert into villages (scenario_id, name, location, population_est)
select s.id, v.name, ST_SetSRID(ST_MakePoint(v.lon, v.lat), 4326)::geography, v.pop
from scenarios s, (values ('Air Hitam Jaya', 105.389878, -3.289894, 750),
         ('Mekar Sari', 105.414622, -3.251716, 980),
         ('Pasir Putih', 105.446115, -3.346038, 600),
         ('Lubuk Rawa', 105.46861, -3.314598, 520)) as v(name, lon, lat, pop)
where s.slug = 'sumsel'
on conflict (scenario_id, name) do update set location = excluded.location, population_est = excluded.population_est;
delete from peat_zones where scenario_id = (select id from scenarios where slug = 'sumsel');
insert into peat_zones (scenario_id, name, geom, moisture_index)
select id, 'Gambut Air Hitam', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[105.425451,-3.320917],[105.423157,-3.322772],[105.420467,-3.324161],[105.417426,-3.325059],[105.414088,-3.325452],[105.410508,-3.325333],[105.406749,-3.324704],[105.402874,-3.323574],[105.39895,-3.321965],[105.395044,-3.319903],[105.391223,-3.317423],[105.387552,-3.314569],[105.384094,-3.311388],[105.380908,-3.307936],[105.378049,-3.304271],[105.375565,-3.300456],[105.3735,-3.296557],[105.371888,-3.292639],[105.370757,-3.288771],[105.370126,-3.285018],[105.370006,-3.281444],[105.3704,-3.278111],[105.3713,-3.275076],[105.372692,-3.27239],[105.37455,-3.2701],[105.376844,-3.268245],[105.379534,-3.266856],[105.382574,-3.265957],[105.385913,-3.265564],[105.389492,-3.265684],[105.393252,-3.266313],[105.397127,-3.267442],[105.401051,-3.269052],[105.404957,-3.271114],[105.408778,-3.273593],[105.412449,-3.276448],[105.415907,-3.279628],[105.419093,-3.283081],[105.421952,-3.286746],[105.424435,-3.29056],[105.426501,-3.29446],[105.428113,-3.298377],[105.429244,-3.302246],[105.429875,-3.305999],[105.429994,-3.309572],[105.4296,-3.312905],[105.4287,-3.315941],[105.427309,-3.318626],[105.425451,-3.320917]]]}'), 4326)), 0.24
from scenarios where slug = 'sumsel';
insert into peat_zones (scenario_id, name, geom, moisture_index)
select id, 'Gambut Mekar', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[105.433743,-3.259576],[105.43357,-3.261628],[105.433053,-3.263645],[105.432202,-3.265592],[105.431031,-3.267436],[105.429559,-3.269146],[105.427813,-3.270692],[105.425822,-3.272048],[105.42362,-3.27319],[105.421245,-3.2741],[105.418737,-3.274761],[105.41614,-3.275162],[105.413497,-3.275296],[105.410855,-3.275162],[105.408257,-3.274761],[105.40575,-3.2741],[105.403375,-3.27319],[105.401173,-3.272048],[105.399182,-3.270692],[105.397435,-3.269146],[105.395964,-3.267436],[105.394793,-3.265592],[105.393942,-3.263645],[105.393425,-3.261628],[105.393252,-3.259576],[105.393425,-3.257524],[105.393942,-3.255507],[105.394793,-3.25356],[105.395964,-3.251716],[105.397435,-3.250006],[105.399182,-3.24846],[105.401173,-3.247104],[105.403375,-3.245962],[105.40575,-3.245052],[105.408257,-3.244391],[105.410855,-3.24399],[105.413497,-3.243855],[105.41614,-3.24399],[105.418737,-3.244391],[105.421245,-3.245052],[105.42362,-3.245962],[105.425822,-3.247104],[105.427813,-3.24846],[105.429559,-3.250006],[105.431031,-3.251716],[105.432202,-3.25356],[105.433053,-3.255507],[105.43357,-3.257524],[105.433743,-3.259576]]]}'), 4326)), 0.33
from scenarios where slug = 'sumsel';
