/* DGIIT | SECTURI — Service Worker v1.0 */

const CACHE_NAME = 'dgiit-secturi-v1.7';
const CDN_CACHE  = 'dgiit-secturi-cdn-v1.7';

const APP_SHELL = [
    '/',
    '/index.html',
    '/styles.css',
    '/manifest.json',
    '/js/api-client.js',
    '/js/app-db.js',
    '/icons/icon.svg',
    '/icons/icon-maskable.svg'
];

const CDN_DOMAINS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'unpkg.com',
    'cdn.jsdelivr.net',
    'npmcdn.com'
];

/* ── INSTALL: precache app shell ─────────────────────────── */
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            cache.addAll(APP_SHELL).catch(err =>
                console.warn('[SW] Precache partial failure:', err)
            )
        )
    );
});

/* ── ACTIVATE: remove stale caches ───────────────────────── */
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(k => k !== CACHE_NAME && k !== CDN_CACHE)
                    .map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

/* ── FETCH: cache strategies ─────────────────────────────── */
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;
    if (!url.protocol.startsWith('http')) return;

    /* CDN resources — stale-while-revalidate */
    if (CDN_DOMAINS.some(d => url.hostname.includes(d))) {
        event.respondWith(
            caches.open(CDN_CACHE).then(cache =>
                cache.match(request).then(cached => {
                    const networkFetch = fetch(request)
                        .then(res => { if (res.ok) cache.put(request, res.clone()); return res; })
                        .catch(() => cached);
                    return cached || networkFetch;
                })
            )
        );
        return;
    }

    /* App shell — cache-first, fallback to network then index.html */
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;
            return fetch(request)
                .then(res => {
                    if (!res.ok) return res;
                    const resToCache = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(request, resToCache));
                    return res;
                })
                .catch(() => {
                    if (request.mode === 'navigate') return caches.match('/index.html');
                });
        })
    );
});

/* ── PUSH NOTIFICATIONS ──────────────────────────────────── */
self.addEventListener('push', event => {
    let data = { title: 'DGIIT | SECTURI', body: 'Nueva actualización' };
    
    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch (e) {
        console.warn('[SW] Push data error:', e);
        if (event.data) data.body = event.data.text();
    }

    const options = {
        body: data.body,
        icon: '/icons/icon.svg',
        badge: '/icons/icon.svg',
        vibrate: [100, 50, 100],
        data: {
            url: data.data && data.data.taskId ? `/?taskId=${data.data.taskId}` : '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

/* ── NOTIFICATION CLICK: open app ────────────────────────── */
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    const targetUrl = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Si hay una ventana abierta, enfocarla y navegar
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.postMessage({ type: 'NAVIGATE', url: targetUrl });
                    return client.focus();
                }
            }
            // Si no hay ventana abierta, abrir una nueva
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
