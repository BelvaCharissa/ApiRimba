// Sederhanakan GeoJSON 34 provinsi (sumber: github.com/ans-4175/peta-indonesia-geojson) untuk peta pantau.
// Pakai: node scripts/build-provinces.mjs <berkas-sumber.geojson>
import { readFileSync, writeFileSync } from 'node:fs';
import { simplify, bbox } from '@turf/turf';

const NAME = {
  'DI. ACEH': 'Aceh',
  'DAERAH ISTIMEWA YOGYAKARTA': 'DI Yogyakarta',
  'DKI JAKARTA': 'DKI Jakarta',
  'NUSATENGGARA BARAT': 'Nusa Tenggara Barat',
  'BANGKA BELITUNG': 'Kepulauan Bangka Belitung',
};
const title = (s) => NAME[s] ?? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const round = (c) => (typeof c[0] === 'number' ? [Math.round(c[0] * 1000) / 1000, Math.round(c[1] * 1000) / 1000] : c.map(round));
const features = src.features.map((f) => {
  const s = simplify(f, { tolerance: 0.01, highQuality: false });
  return {
    type: 'Feature',
    properties: { name: title(f.properties.Propinsi), bbox: bbox(s).map((v) => Math.round(v * 1000) / 1000) },
    geometry: { type: s.geometry.type, coordinates: round(s.geometry.coordinates) },
  };
});
writeFileSync('public/data/provinces.json', JSON.stringify({ type: 'FeatureCollection', features }));
console.log(features.length, 'provinsi');
