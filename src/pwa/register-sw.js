/**
 * Register the PWA service worker when supported.
 * COOP/COEP must be set by the host (see vite.config.js / production server).
 */
export function registerServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }

    const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/marbles/';
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    const swPath = `${normalizedBase}sw.js`;
    const expectedScope = `${window.location.origin}${normalizedBase}`;

    window.addEventListener('load', () => {
        // Unregister any stale service workers registered outside our scope
        // (e.g. old root-scope SW from a previous deployment at /), then register
        // the current SW once cleanup has settled.
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            const cleanups = registrations
                .filter((reg) => reg.scope !== expectedScope)
                .map((reg) => reg.unregister().catch(() => {}));
            return Promise.allSettled(cleanups);
        }).catch(() => {}).then(() => {
            navigator.serviceWorker.register(swPath, { scope: normalizedBase }).catch((err) => {
                console.warn('[PWA] Service worker registration failed:', err);
            });
        });
    });
}
