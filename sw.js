// QasimFlix Service Worker
// Firebase CDN dosyaları artık burada import edilmez.
// Böylece gstatic erişim hatası olsa bile site/cache/player etkilenmez.
// FCM/Web Push geldiyse native push event ile bildirim gösterilir.

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    try { payload = { notification: { body: event.data.text() } }; } catch (__) {}
  }

  const note = payload.notification || payload.data || {};
  const title = note.title || payload.title || 'QasimFlix';
  const options = {
    body: note.body || payload.body || 'Yeni içerik eklendi',
    icon: note.icon || '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-96.png',
    data: { url: note.url || (payload && payload.data && payload.data.url) || '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

const CACHE_NAME = 'qasimflix-v1.0.9-syntax-fix';
const STATIC = [
  '/', '/index.html', '/auth.html', '/offline.html', '/style.css', '/qf-enhancements.css', '/qf-smart-features.css', '/qf-apk.css', '/qf-apk.js', '/qf-player-apk.js', '/qf-apk-bridge.js', '/qf-player-failsafe.js',
  '/app.js', '/qf-enhancements.js', '/qf-public-pro-tools.js', '/qf-smart-public.js', '/admin.js', '/qf-admin-enhancements.js', '/qf-admin-pro-tools.js', '/qf-smart-admin.js', '/player.html', '/manifest.json', '/version.json', '/favicon.svg',
  '/assets/icons/icon-48.png', '/assets/icons/icon-72.png', '/assets/icons/icon-96.png', '/assets/icons/icon-144.png',
  '/assets/icons/icon-192.png', '/assets/icons/icon-512.png', '/assets/icons/maskable-512.png', '/privacy.html', '/terms.html', '/contact.html', '/dmca.html', '/robots.txt'
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
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'QF_CLEAR_OLD_CACHES') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
    );
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
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
