const CACHE_NAME = 'qasimflix-v8-apk-mobile';
const STATIC = [
  '/', '/index.html', '/auth.html', '/offline.html', '/style.css', '/qf-apk.css', '/qf-apk.js', '/qf-player-apk.js',
  '/app.js', '/admin.js', '/player.html', '/manifest.json', '/version.json', '/favicon.svg',
  '/assets/icons/icon-48.png', '/assets/icons/icon-72.png', '/assets/icons/icon-96.png', '/assets/icons/icon-144.png',
  '/assets/icons/icon-192.png', '/assets/icons/icon-512.png', '/assets/icons/maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => Promise.all(
      STATIC.map(url => fetch(url, { cache: 'reload' }).then(res => {
        if (res.ok) return cache.put(url, res.clone());
      }).catch(() => null))
    ))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET' || url.pathname.includes('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(cached => cached || caches.match('/offline.html')))
    );
    return;
  }

  if (/\.(html|js|css|json)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(cached => cached || (url.pathname.endsWith('.html') ? caches.match('/offline.html') : undefined)))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => undefined))
  );
});
