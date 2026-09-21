const CACHE_VERSION = 'marbles3d-v3';
const API_CACHE = 'marbles3d-api-v1';
const SW_SCOPE = new URL('./', self.location.href).pathname;
const PRECACHE_MANIFEST_URL = `${SW_SCOPE}precache-manifest.json`;

// Fallback list used when the build-time manifest (dist/precache-manifest.json,
// see vite.config.js) isn't reachable — e.g. during `npm run dev`.
const SHELL_ASSETS = [
    SW_SCOPE,
    `${SW_SCOPE}index.html`,
    `${SW_SCOPE}manifest.webmanifest`,
    `${SW_SCOPE}icon.svg`,
];

// Large binaries and game content: cache-first, refreshed in the background.
const ASSET_CACHE_RE = /\.(wasm|glb|gltf|filmat|filament|mat|ktx2?|js|css)$/i;
// Cloud backend calls (progress, ghosts, leaderboards, workshop publish).
const API_PATH_RE = /\/v1\/marbles\//;

async function precacheAssets() {
    const cache = await caches.open(CACHE_VERSION);
    let urls = SHELL_ASSETS;
    try {
        const res = await fetch(PRECACHE_MANIFEST_URL, { cache: 'no-store' });
        if (res.ok) {
            const manifest = await res.json();
            if (Array.isArray(manifest) && manifest.length) {
                urls = [...new Set([...SHELL_ASSETS, ...manifest])];
            }
        }
    } catch {
        // Manifest not built (dev mode) — fall back to the shell-only list.
    }

    await Promise.all(urls.map((url) => (
        cache.add(url).catch((err) => console.warn('[SW] Precache miss:', url, err))
    )));
}

self.addEventListener('install', (event) => {
    event.waitUntil(precacheAssets().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((k) => k !== CACHE_VERSION && k !== API_CACHE).map((k) => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        // Refresh the cache in the background so the next load picks up updates.
        fetch(request).then((response) => {
            if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response));
        }).catch(() => {});
        return cached;
    }

    const response = await fetch(request);
    if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
    }
    return response;
}

async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response.ok && request.method === 'GET') {
            const clone = response.clone();
            caches.open(cacheName).then((cache) => cache.put(request, clone));
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw err;
    }
}

async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);
    const fetchPromise = fetch(request).then((response) => {
        if (response.ok && new URL(request.url).origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
    });
    return cached || fetchPromise;
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (API_PATH_RE.test(url.pathname)) {
        if (request.method === 'GET') {
            event.respondWith(networkFirst(request, API_CACHE));
        }
        // Non-GET (PUT/POST) API calls are handled by CloudClient's own
        // queue + background sync; let them hit the network directly.
        return;
    }

    if (request.method !== 'GET') return;

    if (ASSET_CACHE_RE.test(url.pathname) || url.pathname.includes('filament')) {
        event.respondWith(cacheFirst(request));
        return;
    }

    event.respondWith(staleWhileRevalidate(request));
});

async function notifyClients(message) {
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) client.postMessage(message);
}

// CloudClient (src/game/network/cloud-client.ts) queues progress/ghost writes
// in localStorage — inaccessible from the SW — and registers this tag when it
// enqueues an item while offline. We can't flush the queue ourselves without
// that storage, so we ask any open page to run its own flush once the browser
// tells us connectivity is back.
self.addEventListener('sync', (event) => {
    if (event.tag === 'cloud-flush') {
        event.waitUntil(notifyClients({ type: 'CLOUD_FLUSH_REQUEST' }));
    }
});

// Refreshes cached ghost-leaderboard GET responses roughly once a day so
// scores are reasonably fresh even if the app isn't opened in between.
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'leaderboard-refresh') {
        event.waitUntil(refreshLeaderboardCache());
    }
});

async function refreshLeaderboardCache() {
    const cache = await caches.open(API_CACHE);
    const requests = await cache.keys();
    await Promise.all(requests
        .filter((req) => /\/leaderboards\//.test(new URL(req.url).pathname))
        .map(async (req) => {
            try {
                const response = await fetch(req);
                if (response.ok) await cache.put(req, response);
            } catch {
                // Offline — keep the stale cached entry.
            }
        }));
}
