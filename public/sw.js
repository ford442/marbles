const CACHE_VERSION = 'marbles3d-v1';
const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/icon.svg',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Large WASM / Filament binaries: network-first so updates propagate and COOP/COEP
    // headers come from the origin server, not a stale cache entry.
    if (url.pathname.endsWith('.wasm') || url.pathname.includes('filament')) {
        event.respondWith(fetch(request));
        return;
    }

    if (request.method !== 'GET') return;

    event.respondWith(
        caches.match(request).then((cached) => {
            const fetchPromise = fetch(request).then((response) => {
                if (response.ok && url.origin === self.location.origin) {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
                }
                return response;
            });
            return cached || fetchPromise;
        })
    );
});
