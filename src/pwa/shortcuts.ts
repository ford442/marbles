import type { LevelLoader } from '../game/systems/level-loader.ts';
import type { InitLevelMenu } from '../init/level-menu.ts';
import { getLastPlayedLevel } from './pwa-state.js';

/** What the launch shortcut calls on the game (both guarded, as in early boot). */
export type LaunchShortcutGame = Partial<Pick<LevelLoader, 'loadLevel'> & Pick<InitLevelMenu, 'hideLevelSelection'>>;

/**
 * Applies the manifest's `shortcuts` entries (see public/manifest.webmanifest):
 * "Quick Play" launches straight into the last level the player finished.
 * "Campaign" needs no special handling — it links to `/`, and the level-select
 * screen it lands on is already the default post-init view.
 */
export function applyLaunchShortcut(game: LaunchShortcutGame): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('shortcut') !== 'quickplay') return;

    const levelId = getLastPlayedLevel();
    if (levelId && typeof game.loadLevel === 'function') {
        // Re-checked inside the callback: narrowing doesn't survive the closure.
        game.hideLevelSelection?.(() => game.loadLevel?.(levelId));
    }
}
