import { audio } from '../audio.js';

export class AbilityDash {
    constructor(game) {
        this.game = game;
    }

    beginDashCharge(now) {
        if (!this.game.playerMarble) return;
        this.game.isChargingDash = true;
        this.game.dashCharge = 0;
    }

    releaseDash(now) {
        if (!this.game.playerMarble || !this.game.isChargingDash) return;

        const rb = this.game.playerMarble.rigidBody;
        const cosP = Math.cos(this.game.pitchAngle);
        const sinP = Math.sin(this.game.pitchAngle);
        const dirX = Math.sin(this.game.aimYaw) * cosP;
        const dirY = sinP;
        const dirZ = Math.cos(this.game.aimYaw) * cosP;

        // Apply a strong physics impulse based on charge
        const baseForce = 50.0;
        const force = baseForce + ((this.game.dashCharge || 0) * 150.0);
        rb.applyImpulse({
            x: dirX * force,
            y: dirY * force,
            z: dirZ * force
        }, true);

        this.game.lastDashTime = now;

        if (typeof audio !== 'undefined' && audio.playBoost) {
            audio.playBoost();
        }

        if (this.game.hudManager) {
            this.game.hudManager.markAbilityUsed('dash');
        }

        this.game.isChargingDash = false;
        this.game.dashCharge = 0;

        if (this.game.dashBarEl) {
            this.game.dashBarEl.style.boxShadow = 'none';
        }
    }
}
