/** Score, combo, and HUD DOM references. */
export function createHudState(doc = document) {
    return {
        score: 0,
        combo: 1,
        comboTimer: 0,
        maxComboTime: 3000,
        scoreEl: doc.getElementById('score'),
        comboEl: doc.getElementById('combo'),
        combobarContainerEl: doc.getElementById('combobar-container'),
        combobarEl: doc.getElementById('combobar'),
        timerEl: doc.getElementById('timer'),
        levelNameEl: doc.getElementById('level-name'),
        selectedEl: doc.getElementById('selected'),
        aimEl: doc.getElementById('aim'),
        powerbarEl: doc.getElementById('powerbar'),
        jumpBarEl: doc.getElementById('jumpbar'),
        boostBarEl: doc.getElementById('boostbar'),
        dashBarEl: doc.getElementById('dashbar'),
        magnetBarEl: doc.getElementById('magnetbar'),
        focusBarEl: doc.getElementById('focusbar'),
        rewindBarEl: doc.getElementById('rewindbar'),
        gravityBarEl: doc.getElementById('gravitybar'),
        effectEl: doc.getElementById('effects'),
        activeEffectsEl: doc.getElementById('active-effects'),
    };
}
