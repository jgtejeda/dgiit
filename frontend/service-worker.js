/* SGC PRO — Service Worker v1.0 */

const CACHE_NAME = 'sgc-pro-v1.0';
const CDN_CACHE  = 'sgc-pro-cdn-v1.0';

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
                    caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
                    return res;
                })
                .catch(() => {
                    if (request.mode === 'navigate') return caches.match('/index.html');
                });
        })
    );
});
