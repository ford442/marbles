import { HUDManager, type HudHost } from '../../hud-manager.ts';
import { GameLoopHudTick } from '../../game-loop/hud-tick.js';
import type { Vec3 } from '../../types/geometry.ts';

/** Game surface `HudController.updateFrame` reads on top of what the HUD itself needs. */
export interface HudControllerHost extends HudHost {
    playerMarble?: { rigidBody: { translation(): Vec3 } } | null;
    updateGoalEffects(deltaSec: number, playerPos: Vec3): void;
}

/** Consolidated owner for HUD DOM, cooldown bars, goal FX, and desync state. */
export class HudController extends HUDManager<HudControllerHost> {
    constructor(game: HudControllerHost, options: { initialize?: boolean } = {}) {
        super(game, options);
    }

    updateFrame(now: number, { shouldUpdateHUD = true }: { shouldUpdateHUD?: boolean } = {}): void {
        GameLoopHudTick.prototype.tickHudCooldownBars.call(this.game, now, shouldUpdateHUD);
        this.updateAllAbilities();

        if (this.game.playerMarble) {
            const playerPos = this.game.playerMarble.rigidBody.translation();
            this.game.updateGoalEffects(0.016, playerPos);
        }
    }
}

export default HudController;
