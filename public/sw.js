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
const VERSION = 'v4';
const SHELL = `apirimba-shell-${VERSION}`;
const PAGES = 'apirimba-pages';
const STATIC = 'apirimba-static';
const DATA = 'apirimba-data';
const TILES = 'apirimba-tiles';
const MAX_TILES = 3000;
/**
 * Server ubin dan /_next/image mengirim `Vary: Accept`; salinan yang disimpan lewat pesan 'warm' dibuat
 * dengan header Accept berbeda, jadi pencocokan mengabaikan Vary (isinya sama untuk URL yang sama).
 */
const MATCH = { ignoreVary: true };
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
    const cached = (await caches.match(key, { ignoreSearch: true, ignoreVary: true })) || (await caches.match(req, { ignoreSearch: true, ignoreVary: true }));
    if (cached) return cached;
    // Jaringan lambat tetapi belum ada salinan: tunggu jaringan.
    try {
      return await net;
    } catch {
      const offline = await caches.match('/offline', { ignoreVary: true });
      return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  }
}

async function cacheFirst(req, cacheName, max) {
  const cached = await caches.match(req, MATCH);
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
    const cached = await caches.match(req, MATCH);
    if (cached) return cached;
    throw e;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cached = await caches.match(req, MATCH);
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok) store(cacheName, req, res.clone()).catch(() => undefined);
      return res;
    })
    .catch(() => undefined);
  return cached || (await fresh) || Response.error();
}

/**
 * Aturan cache per URL (dipakai saat permintaan biasa dan saat "menghangatkan" cache).
 * null = tidak disimpan.
 */
function routeFor(url) {
  if (url.origin === self.location.origin) {
    // Permintaan RSC (navigasi klien Next.js): tidak disimpan; HTML halaman disimpan lewat pesan 'warm'.
    if (url.searchParams.has('_rsc')) return null;
    const p = url.pathname;
    if (p.startsWith('/_next/static/') || p.startsWith('/_next/image') || p.startsWith('/vendor/') || p.startsWith('/brand/') || p.startsWith('/img/')) {
      return { strategy: 'cacheFirst', cache: STATIC };
    }
    if (p.startsWith('/data/')) return { strategy: 'swr', cache: SHELL };
    if (p.startsWith('/api/') && API_CACHEABLE.some((x) => p.startsWith(x))) return { strategy: 'networkFirst', cache: DATA, max: MAX_DATA };
    if (p === '/icon.png' || p === '/apple-icon.png' || p === '/manifest.webmanifest') return { strategy: 'swr', cache: SHELL };
    return null;
  }
  // Ubin peta dan elevasi dari luar.
  const tileHost = TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  const elevation = url.hostname === 's3.amazonaws.com' && url.pathname.startsWith('/elevation-tiles-prod/');
  if (tileHost || elevation) {
    // Gaya peta (style.json) diperbarui bila online; ubin, glyph, dan sprite disimpan.
    if (url.pathname.endsWith('style.json')) return { strategy: 'networkFirst', cache: TILES };
    return { strategy: 'cacheFirst', cache: TILES, max: MAX_TILES };
  }
  return null;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && req.mode === 'navigate') {
    event.respondWith(handlePage(req));
    return;
  }
  if (req.headers.get('RSC') === '1') return;
  const r = routeFor(url);
  if (!r) return;
  if (r.strategy === 'cacheFirst') event.respondWith(cacheFirst(req, r.cache, r.max));
  else if (r.strategy === 'networkFirst') event.respondWith(networkFirst(req, r.cache, r.max));
  else event.respondWith(staleWhileRevalidate(req, r.cache));
});

/** Simpan HTML halaman (kunci = path). Pengalihan (mis. ke /masuk) dan error tidak disimpan. */
async function warmPage(path) {
  const url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin) return;
  try {
    const res = await fetch(url.href, { credentials: 'same-origin' });
    if (res.ok && !res.redirected && (res.headers.get('content-type') || '').includes('text/html')) {
      await store(PAGES, url.origin + url.pathname, res);
    }
  } catch {
    // offline / gagal: abaikan
  }
}

/** Simpan aset/data yang sudah dimuat halaman sebelum service worker aktif (kunjungan pertama). */
async function warmAsset(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return;
  }
  const r = routeFor(url);
  if (!r) return;
  if (await caches.match(url.href, MATCH)) return;
  try {
    const res = await fetch(url.href, url.origin === self.location.origin ? { credentials: 'same-origin' } : { mode: 'cors', credentials: 'omit' });
    if (res.ok) await store(r.cache, url.href, res, r.max);
  } catch {
    // abaikan
  }
}

async function inBatches(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'warm') {
    const pages = Array.isArray(msg.pages) ? msg.pages : Array.isArray(msg.urls) ? msg.urls : [];
    const assets = Array.isArray(msg.assets) ? msg.assets.slice(0, 2000) : [];
    event.waitUntil(
      Promise.all([inBatches(pages, 4, warmPage), inBatches(assets, 8, warmAsset)]).then(async () => {
        // Beri tahu halaman: apakah halaman yang sedang dibuka sudah tersimpan untuk offline.
        const first = pages[0] ? new URL(pages[0], self.location.origin) : null;
        const saved = first ? !!(await caches.match(first.origin + first.pathname, { ignoreSearch: true, ignoreVary: true })) : false;
        event.source?.postMessage({ type: 'warm-done', path: first?.pathname ?? null, saved });
      }),
    );
  }
  if (msg.type === 'clear-user') {
    // Keluar akun: hapus halaman dan data API yang tersimpan di perangkat ini.
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(DATA)]));
  }
});
