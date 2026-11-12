// Salin worker MapLibre ke public/ agar dapat dimuat sebagai berkas statis (lihat MapView setWorkerUrl).
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('public/vendor', { recursive: true });
copyFileSync('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'public/vendor/maplibre-gl-worker.mjs');
