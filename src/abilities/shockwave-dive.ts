import { audio } from '../audio.js';
import type { AbilityHost } from '../game/systems/ability-system.ts';
import type { FrameState } from '../types/frame-host.ts';

/** Game members `AbilityShockwaveDive` uses. */
export type AbilityShockwaveDiveHost =
    & Pick<FrameState,
        | 'playerMarble' | 'isChargingShockwave' | 'shockwaveChargeTime' | 'shockwaveOldGravity'
        | 'awaitingShockwaveImpact' | 'lastShockwaveTime'>
    & Pick<AbilityHost, 'hudManager'>;

export class AbilityShockwaveDive {
    declare game: AbilityShockwaveDiveHost;

    constructor(game: AbilityShockwaveDiveHost) {
        this.game = game;
    }

    beginShockwaveCharge(now: number): void {
        if (!this.game.playerMarble) return;
        this.game.isChargingShockwave = true;
        this.game.shockwaveChargeTime = now;

        // Anti-gravity to float while charging in the air
        const rb = this.game.playerMarble.rigidBody;
        this.game.shockwaveOldGravity = rb.gravityScale();
        rb.setGravityScale(0.05, true);

        // Apply a tiny upward hover impulse
        rb.applyImpulse({ x: 0, y: 15.0, z: 0 }, true);

        // Zero out horizontal velocity to stop mid-air
        const vel = rb.linvel();
        rb.setLinvel({ x: vel.x * 0.1, y: vel.y * 0.1, z: vel.z * 0.1 }, true);

        if (audio && audio.playBoost) {
            audio.playBoost();
        }
    }

    releaseShockwave(now: number): void {
        if (!this.game.playerMarble || !this.game.isChargingShockwave) return;

        this.game.isChargingShockwave = false;

        const rb = this.game.playerMarble.rigidBody;

        // Restore gravity
        rb.setGravityScale(this.game.shockwaveOldGravity !== undefined ? this.game.shockwaveOldGravity : 1.0, true);

        // Compute force based on charge time
        const chargeDuration = now - (this.game.shockwaveChargeTime || now);
        // Max charge at 1 second
        const chargeRatio = Math.min(1.0, chargeDuration / 1000.0);

        // Base force 300, max 800
        const diveForce = 300.0 + (chargeRatio * 500.0);

        // Send straight down
        rb.applyImpulse({
            x: 0,
            y: -diveForce,
            z: 0
        }, true);

        // Let the logic tick know we are awaiting the ground impact
        this.game.awaitingShockwaveImpact = true;
        this.game.lastShockwaveTime = now;

        if (this.game.hudManager) {
            this.game.hudManager.markAbilityUsed('shockwave');
        }
    }
}
