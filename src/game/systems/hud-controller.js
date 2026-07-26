import { HUDManager } from '../../hud-manager.js';
import { GameLoopHudTick } from '../../game-loop/hud-tick.js';

/** Consolidated owner for HUD DOM, cooldown bars, goal FX, and desync state. */
export class HudController extends HUDManager {
    constructor(game, options = {}) {
        super(game, options);
    }

    updateFrame(now, { shouldUpdateHUD = true } = {}) {
        GameLoopHudTick.prototype.tickHudCooldownBars.call(this.game, now, shouldUpdateHUD);
        this.updateAllAbilities();

        if (this.game.playerMarble) {
            const playerPos = this.game.playerMarble.rigidBody.translation();
            this.game.updateGoalEffects(0.016, playerPos);
        }
    }
}

export default HudController;
