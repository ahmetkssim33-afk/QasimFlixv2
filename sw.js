const CACHE_NAME = 'qasimflix-v7-mobile-player';
const STATIC = ['/', '/index.html', '/auth.html', '/style.css', '/app.js', '/admin.js', '/player.html', '/favicon.svg'];

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

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET' || url.pathname.includes('/api/')) return;

  // HTML/JS/CSS her zaman önce network'ten gelsin; böylece Vercel deploy sonrası telefon eski kodu göstermez.
  if (req.mode === 'navigate' || /\.(html|js|css)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
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
