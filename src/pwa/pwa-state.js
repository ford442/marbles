/**
 * Small localStorage-backed flags shared by the install prompt (gated on
 * "has the player finished a level") and the manifest's Quick Play shortcut
 * (needs to know which level to jump back into).
 */

export const HAS_PLAYED_LEVEL_KEY = 'marbles3d_has_played_level';
export const LAST_LEVEL_KEY = 'marbles3d_last_level';

/** Record that a level was completed, for install-prompt gating and Quick Play. */
export function recordLevelPlayed(levelId) {
    try {
        localStorage.setItem(HAS_PLAYED_LEVEL_KEY, '1');
        if (levelId) localStorage.setItem(LAST_LEVEL_KEY, levelId);
    } catch {
        // private mode / quota
    }
}

export function hasPlayedALevel() {
    try {
        return localStorage.getItem(HAS_PLAYED_LEVEL_KEY) === '1';
    } catch {
        return false;
    }
}

export function getLastPlayedLevel() {
    try {
        return localStorage.getItem(LAST_LEVEL_KEY);
    } catch {
        return null;
    }
}
