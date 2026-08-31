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

    window.addEventListener('load', () => {
        navigator.serviceWorker.register(swPath, { scope: normalizedBase }).catch((err) => {
            console.warn('[PWA] Service worker registration failed:', err);
        });
    });
}
