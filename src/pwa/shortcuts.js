import { getLastPlayedLevel } from './pwa-state.js';

/**
 * Applies the manifest's `shortcuts` entries (see public/manifest.webmanifest):
 * "Quick Play" launches straight into the last level the player finished.
 * "Campaign" needs no special handling — it links to `/`, and the level-select
 * screen it lands on is already the default post-init view.
 */
export function applyLaunchShortcut(game) {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('shortcut') !== 'quickplay') return;

    const levelId = getLastPlayedLevel();
    if (levelId && typeof game.loadLevel === 'function') {
        game.hideLevelSelection?.(() => game.loadLevel(levelId));
    }
}
