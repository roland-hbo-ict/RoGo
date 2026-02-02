const CACHE_NAME = `rogo-pwa-v${1}`;

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
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Failed to cache:', asset, err);
        }
      }
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => new Response('', { status: 503 }));
    })
  );
});
