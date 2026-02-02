const params = new URL(self.location).searchParams;
const VERSION = params.get('v') || 'dev';

const CACHE_NAME = `rogo-pwa-v${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './parser.js',
  './tokens.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    for (const asset of ASSETS) {
      try {
        const req = new Request(asset, { cache: 'reload' });
        const res = await fetch(req);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        await cache.put(req, res);
      } catch (err) {
        console.warn('[SW] Failed to cache:', asset, err);
      }
    }

    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith('rogo-pwa-') && k !== CACHE_NAME)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => new Response('', { status: 503 }));
    })
  );
});