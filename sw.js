const CACHE_NAME = 'qasimflix-v4';
const STATIC = ['/', '/index.html', '/auth.html', '/style.css', '/favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => {
      return Promise.all(STATIC.map(url =>
        fetch(url).then(r => { if (r.ok) c.put(url, r); }).catch(() => {})
      ));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // app.js, admin.js, API istekleri → her zaman network
  if (
    url.pathname.endsWith('app.js') ||
    url.pathname.endsWith('admin.js') ||
    url.pathname.includes('/api/') ||
    e.request.method !== 'GET'
  ) return;

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() =>
      e.request.mode === 'navigate' ? caches.match('/index.html') : undefined
    ))
  );
});
