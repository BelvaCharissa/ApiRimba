/*
 * Service worker ApiRimba: mode offline.
 *
 * - Halaman yang pernah dibuka: jaringan dulu, cadangan dari cache bila offline.
 * - Aset build Next.js, logo, gambar: cache dulu (nama file berhash, aman disimpan lama).
 * - Data skenario & data cadangan: dari cache, diperbarui di latar belakang.
 * - API baca (titik panas, cuaca, area, daftar laporan): jaringan dulu, cache bila offline.
 * - Ubin peta (CARTO, Esri, elevasi, GIBS): cache dulu, dibatasi jumlahnya.
 * Permintaan selain GET (kirim laporan, login, chat AI) tidak pernah disentuh.
 */
const VERSION = 'v1';
const SHELL = `apirimba-shell-${VERSION}`;
const PAGES = 'apirimba-pages';
const STATIC = 'apirimba-static';
const DATA = 'apirimba-data';
const TILES = 'apirimba-tiles';
const MAX_TILES = 3000;
const MAX_DATA = 300;

const PRECACHE = [
  '/offline',
  '/manifest.webmanifest',
  '/icon.png',
  '/apple-icon.png',
  '/brand/logo-mark.png',
  '/brand/logo-full.png',
  '/vendor/maplibre-gl-worker.mjs',
  '/data/provinces.json',
  '/data/scenarios/riau.json',
  '/data/scenarios/kalteng.json',
  '/data/scenarios/sumsel.json',
  '/data/fallback/hotspots-riau.json',
  '/data/fallback/hotspots-kalteng.json',
  '/data/fallback/hotspots-sumsel.json',
  '/data/fallback/weather-riau.json',
  '/data/fallback/weather-kalteng.json',
  '/data/fallback/weather-sumsel.json',
];

/**
 * API GET yang aman disimpan untuk dibaca offline. Data admin dan petugas tidak disimpan; status akun
 * (/api/auth/me) disimpan per perangkat dan dihapus saat keluar akun (pesan 'clear-user').
 */
const API_CACHEABLE = ['/api/auth/me', '/api/pantau/', '/api/weather', '/api/hotspots', '/api/area/', '/api/lapor', '/api/bantuan'];

const TILE_HOSTS = ['cartocdn.com', 'arcgisonline.com', 'arcgis.com', 'gibs.earthdata.nasa.gov', 'maps.mail.ru'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // Satu berkas gagal tidak boleh menggagalkan seluruh pemasangan.
      await Promise.all(
        PRECACHE.map((url) =>
          fetch(url, { cache: 'reload' })
            .then((res) => (res.ok && !res.redirected ? cache.put(url, res) : undefined))
            .catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, PAGES, STATIC, DATA, TILES]);
      for (const key of await caches.keys()) if (key.startsWith('apirimba-') && !keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

let putCount = 0;
async function store(cacheName, key, res, max) {
  const cache = await caches.open(cacheName);
  await cache.put(key, res);
  if (max && ++putCount % 40 === 0) await trim(cacheName, max);
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

/** Halaman: kunci cache = path saja, jadi /peta?lokasi=... tetap terbuka offline (parameter dibaca di klien). */
async function handlePage(req) {
  const url = new URL(req.url);
  const key = url.origin + url.pathname;
  const net = fetch(req).then((res) => {
    // Jangan simpan pengalihan (mis. ke /masuk) atau error.
    if (res.ok && !res.redirected && res.type === 'basic') store(PAGES, key, res.clone()).catch(() => undefined);
    return res;
  });
  try {
    return await Promise.race([net, timeout(10000)]);
  } catch {
    const cached = (await caches.match(key, { ignoreSearch: true })) || (await caches.match(req, { ignoreSearch: true }));
    if (cached) return cached;
    // Jaringan lambat tetapi belum ada salinan: tunggu jaringan.
    try {
      return await net;
    } catch {
      const offline = await caches.match('/offline');
      return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  }
}

async function cacheFirst(req, cacheName, max) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) store(cacheName, req, res.clone(), max).catch(() => undefined);
  return res;
}

async function networkFirst(req, cacheName, max) {
  try {
    const res = await fetch(req);
    if (res.ok) store(cacheName, req, res.clone(), max).catch(() => undefined);
    return res;
  } catch (e) {
    const cached = await caches.match(req);
    if (cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cached = await caches.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok) store(cacheName, req, res.clone()).catch(() => undefined);
      return res;
    })
    .catch(() => undefined);
  return cached || (await fresh) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Permintaan RSC (navigasi klien Next.js): biarkan; bila gagal, Next.js beralih ke navigasi biasa.
    if (req.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) return;
    if (req.mode === 'navigate') {
      event.respondWith(handlePage(req));
      return;
    }
    if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/_next/image') || url.pathname.startsWith('/vendor/') || url.pathname.startsWith('/brand/') || url.pathname.startsWith('/img/')) {
      event.respondWith(cacheFirst(req, STATIC));
      return;
    }
    if (url.pathname.startsWith('/data/')) {
      event.respondWith(staleWhileRevalidate(req, SHELL));
      return;
    }
    if (url.pathname.startsWith('/api/') && API_CACHEABLE.some((p) => url.pathname.startsWith(p))) {
      event.respondWith(networkFirst(req, DATA, MAX_DATA));
      return;
    }
    if (url.pathname === '/icon.png' || url.pathname === '/apple-icon.png' || url.pathname === '/manifest.webmanifest') {
      event.respondWith(staleWhileRevalidate(req, SHELL));
    }
    return;
  }

  // Ubin peta dan elevasi dari luar.
  const tileHost = TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  const elevation = url.hostname === 's3.amazonaws.com' && url.pathname.startsWith('/elevation-tiles-prod/');
  if (tileHost || elevation) {
    // Gaya peta (style.json) diperbarui bila online; ubin, glyph, dan sprite disimpan.
    if (url.pathname.endsWith('style.json')) event.respondWith(networkFirst(req, TILES));
    else event.respondWith(cacheFirst(req, TILES, MAX_TILES));
  }
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'warm' && Array.isArray(msg.urls)) {
    // Simpan halaman utama setelah masuk, agar tetap terbuka offline walau belum pernah dikunjungi.
    event.waitUntil(
      Promise.all(
        msg.urls.map((path) =>
          fetch(path, { credentials: 'same-origin' })
            .then((res) => {
              if (res.ok && !res.redirected) return store(PAGES, new URL(path, self.location.origin).href, res);
              return undefined;
            })
            .catch(() => undefined),
        ),
      ),
    );
  }
  if (msg.type === 'clear-user') {
    // Keluar akun: hapus halaman dan data API yang tersimpan di perangkat ini.
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(DATA)]));
  }
});
