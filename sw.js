// SineQ Service Worker
// Firebase CDN dosyaları artık burada import edilmez.
// Böylece gstatic erişim hatası olsa bile site/cache/player etkilenmez.
// FCM/Web Push geldiyse native push event ile bildirim gösterilir.
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
self.addEventListener('push', function (event) {
    var payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    }
    catch (_) {
        try {
            payload = { notification: { body: event.data.text() } };
        }
        catch (__) { }
    }
    var note = payload.notification || payload.data || {};
    var title = note.title || payload.title || 'SineQ';
    var options = {
        body: note.body || payload.body || 'Yeni içerik eklendi',
        icon: note.icon || '/assets/icons/icon-192.png',
        badge: '/assets/icons/icon-96.png',
        data: { url: note.url || (payload && payload.data && payload.data.url) || '/' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});
var CACHE_NAME = 'sineq-v1.0.11-qfapk-es5-fix';
var STATIC = [
    '/', '/index.html', '/auth.html', '/offline.html', '/style.css', '/qf-enhancements.css', '/qf-smart-features.css', '/qf-apk.css', '/qf-apk.js', '/qf-player-apk.js', '/qf-apk-bridge.js', '/qf-player-failsafe.js',
    '/app.js', '/qf-enhancements.js', '/qf-public-pro-tools.js', '/qf-smart-public.js', '/admin.js', '/qf-admin-enhancements.js', '/qf-admin-pro-tools.js', '/qf-smart-admin.js', '/player.html', '/manifest.json', '/version.json', '/favicon.svg',
    '/assets/icons/icon-48.png', '/assets/icons/icon-72.png', '/assets/icons/icon-96.png', '/assets/icons/icon-144.png',
    '/assets/icons/icon-192.png', '/assets/icons/icon-512.png', '/assets/icons/maskable-512.png', '/privacy.html', '/terms.html', '/contact.html', '/dmca.html', '/robots.txt'
];
self.addEventListener('install', function (event) {
    event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return Promise.all(STATIC.map(function (url) { return fetch(url, { cache: 'reload' }).then(function (res) {
        if (res.ok)
            return cache.put(url, res.clone());
    }).catch(function () { return null; }); })); }));
    self.skipWaiting();
});
self.addEventListener('activate', function (event) {
    event.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); })); }));
    self.clients.claim();
});
self.addEventListener('message', function (event) {
    if (!event.data)
        return;
    if (event.data.type === 'SKIP_WAITING')
        self.skipWaiting();
    if (event.data.type === 'QF_CLEAR_OLD_CACHES') {
        event.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); })); }));
    }
});
self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    var targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
        var e_1, _a;
        try {
            for (var clientList_1 = __values(clientList), clientList_1_1 = clientList_1.next(); !clientList_1_1.done; clientList_1_1 = clientList_1.next()) {
                var client = clientList_1_1.value;
                if ('focus' in client) {
                    client.navigate(targetUrl).catch(function () { });
                    return client.focus();
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (clientList_1_1 && !clientList_1_1.done && (_a = clientList_1.return)) _a.call(clientList_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (clients.openWindow)
            return clients.openWindow(targetUrl);
    }));
});
self.addEventListener('fetch', function (event) {
    var req = event.request;
    var url = new URL(req.url);
    if (req.method !== 'GET' || url.pathname.includes('/api/'))
        return;
    if (req.mode === 'navigate') {
        event.respondWith(fetch(req, { cache: 'no-store' }).then(function (res) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (cache) { return cache.put(req, copy); }).catch(function () { });
            return res;
        }).catch(function () { return caches.match(req).then(function (cached) { return cached || caches.match('/offline.html'); }); }));
        return;
    }
    if (/\.(html|js|css|json)$/i.test(url.pathname)) {
        event.respondWith(fetch(req, { cache: 'no-store' }).then(function (res) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (cache) { return cache.put(req, copy); }).catch(function () { });
            return res;
        }).catch(function () { return caches.match(req).then(function (cached) { return cached || (url.pathname.endsWith('.html') ? caches.match('/offline.html') : undefined); }); }));
        return;
    }
    event.respondWith(caches.match(req).then(function (cached) { return cached || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { return cache.put(req, copy); }).catch(function () { });
        return res;
    }).catch(function () { return undefined; }); }));
});
