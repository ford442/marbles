import { audio } from '../audio.js';

export class AbilityDash {
    beginDashCharge(now) {
        if (!this.playerMarble) return;
        this.isChargingDash = true;
        this.dashCharge = 0;
    }

    releaseDash(now) {
        if (!this.playerMarble || !this.isChargingDash) return;

        const rb = this.playerMarble.rigidBody;
        const cosP = Math.cos(this.pitchAngle);
        const sinP = Math.sin(this.pitchAngle);
        const dirX = Math.sin(this.aimYaw) * cosP;
        const dirY = sinP;
        const dirZ = Math.cos(this.aimYaw) * cosP;

        // Apply a strong physics impulse based on charge
        const baseForce = 50.0;
        const force = baseForce + ((this.dashCharge || 0) * 150.0);
        rb.applyImpulse({
            x: dirX * force,
            y: dirY * force,
            z: dirZ * force
        }, true);

        this.lastDashTime = now;

        if (typeof audio !== 'undefined' && audio.playBoost) {
            audio.playBoost();
        }

        if (this.hudManager) {
            this.hudManager.markAbilityUsed('dash');
        }

        this.isChargingDash = false;
        this.dashCharge = 0;

        if (this.dashBarEl) {
            this.dashBarEl.style.boxShadow = 'none';
        }
    }
}
