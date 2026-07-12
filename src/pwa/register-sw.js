/**
 * Register the PWA service worker when supported.
 * COOP/COEP must be set by the host (see vite.config.js / production server).
 */
export function registerServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
            console.warn('[PWA] Service worker registration failed:', err);
        });
    });
}
