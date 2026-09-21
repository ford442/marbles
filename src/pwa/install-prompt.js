import { hasPlayedALevel } from './pwa-state.js';

const DISMISSED_KEY = 'marbles3d_install_prompt_dismissed';

let deferredPrompt = null;
let bannerBound = false;

function isDismissed() {
    try {
        return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
        return false;
    }
}

function setDismissed() {
    try {
        localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
        // private mode / quota
    }
}

function showBanner() {
    const banner = document.getElementById('install-banner');
    if (!banner) return;
    banner.classList.add('visible');

    if (bannerBound) return;
    bannerBound = true;

    document.getElementById('btn-install-app')?.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice.catch(() => {});
        deferredPrompt = null;
        hideBanner();
    });

    document.getElementById('btn-dismiss-install')?.addEventListener('click', () => {
        setDismissed();
        hideBanner();
    });
}

function hideBanner() {
    document.getElementById('install-banner')?.classList.remove('visible');
}

function maybeShowBanner() {
    if (deferredPrompt && !isDismissed() && hasPlayedALevel()) {
        showBanner();
    }
}

/**
 * Capture the browser's install prompt and show a dismissible "Add to Home
 * Screen" banner once the player has finished at least one level, per the
 * install-eligibility heuristic in the PWA plan. No-ops where the event is
 * unsupported (Firefox, Safari — those rely on the browser's own UI).
 */
export function initInstallPrompt() {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event;
        maybeShowBanner();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        hideBanner();
    });
}

/** Re-check eligibility — call after a level completes in case the browser's prompt already fired. */
export function recheckInstallBannerEligibility() {
    maybeShowBanner();
}
