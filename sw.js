self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('offline').then(c =>
      c.addAll([
        '/',
        '/index.html',
        '/styles.css',
        '/app.js',
        '/parser.js',
        '/db.js'
      ])
    )
  );
});
 
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});