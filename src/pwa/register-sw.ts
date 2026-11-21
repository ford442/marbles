const LEADERBOARD_SYNC_TAG = 'leaderboard-refresh';

/** Periodic Background Sync (Chromium; not in the DOM lib typings). */
interface PeriodicSyncManager {
    register(tag: string, options?: { minInterval?: number }): Promise<void>;
}
const LEADERBOARD_SYNC_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Ask the SW to refresh cached leaderboards ~daily, when the browser supports it. */
async function registerPeriodicLeaderboardSync(registration: ServiceWorkerRegistration): Promise<void> {
    if (!('periodicSync' in registration)) return;
    try {
        // 'periodic-background-sync' is a Chromium-only PermissionName.
        const status = await navigator.permissions?.query({ name: 'periodic-background-sync' as PermissionName });
        if (status && status.state !== 'granted') return;
        const { periodicSync } = registration as ServiceWorkerRegistration & { periodicSync: PeriodicSyncManager };
        await periodicSync.register(LEADERBOARD_SYNC_TAG, {
            minInterval: LEADERBOARD_SYNC_MIN_INTERVAL_MS,
        });
    } catch (err) {
        console.warn('[PWA] Periodic background sync registration failed:', err);
    }
}

/** Relay the SW's "connectivity is back" nudge into a queue flush on the page. */
function listenForCloudFlushRequests(): void {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent<unknown>) => {
        const data = event.data;
        const type = typeof data === 'object' && data !== null ? (data as { type?: unknown }).type : undefined;
        if (type === 'CLOUD_FLUSH_REQUEST') {
            import('../game/network/cloud-client.ts').then(({ scheduleQueueFlush }) => {
                scheduleQueueFlush();
            }).catch(() => {});
        }
    });
}

/**
 * Register the PWA service worker when supported.
 * COOP/COEP must be set by the host (see vite.config.js / production server).
 */
export function registerServiceWorker(): void {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }

    const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/marbles/';
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    const swPath = `${normalizedBase}sw.js`;
    const expectedScope = `${window.location.origin}${normalizedBase}`;

    listenForCloudFlushRequests();

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
            navigator.serviceWorker.register(swPath, { scope: normalizedBase }).then((registration) => {
                void registerPeriodicLeaderboardSync(registration);
            }).catch((err) => {
                console.warn('[PWA] Service worker registration failed:', err);
            });
        });
    });
}
