// @ts-check
/** Score, combo, and HUD DOM references. */

/**
 * @param {Document | null | undefined} [doc]
 * @returns {import('../../types/game-state.js').HudState}
 */
export function createHudState(doc) {
    const root = doc ?? (typeof document !== 'undefined' ? document : null);
    /** @param {string} id @returns {HTMLElement | null} */
    const el = (id) => root?.getElementById(id) ?? null;
    return {
        score: 0,
        combo: 1,
        comboTimer: 0,
        maxComboTime: 3000,
        scoreEl: el('score'),
        comboEl: el('combo'),
        combobarContainerEl: el('combobar-container'),
        combobarEl: el('combobar'),
        timerEl: el('timer'),
        levelNameEl: el('level-name'),
        selectedEl: el('selected'),
        aimEl: el('aim'),
        powerbarEl: el('powerbar'),
        jumpBarEl: el('jumpbar'),
        boostBarEl: el('boostbar'),
        dashBarEl: el('dashbar'),
        magnetBarEl: el('magnetbar'),
        focusBarEl: el('focusbar'),
        rewindBarEl: el('rewindbar'),
        gravityBarEl: el('gravitybar'),
        effectEl: el('effects'),
        activeEffectsEl: el('active-effects'),
    };
}
