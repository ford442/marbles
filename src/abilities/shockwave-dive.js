import { audio } from '../audio.js';

export class AbilityShockwaveDive {
    beginShockwaveCharge(now) {
        if (!this.playerMarble) return;
        this.isChargingShockwave = true;
        this.shockwaveChargeTime = now;

        // Anti-gravity to float while charging in the air
        const rb = this.playerMarble.rigidBody;
        this.shockwaveOldGravity = rb.gravityScale();
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

    releaseShockwave(now) {
        if (!this.playerMarble || !this.isChargingShockwave) return;

        this.isChargingShockwave = false;

        const rb = this.playerMarble.rigidBody;

        // Restore gravity
        rb.setGravityScale(this.shockwaveOldGravity !== undefined ? this.shockwaveOldGravity : 1.0, true);

        // Compute force based on charge time
        const chargeDuration = now - (this.shockwaveChargeTime || now);
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
        this.awaitingShockwaveImpact = true;
        this.lastShockwaveTime = now;

        if (this.hudManager) {
            this.hudManager.markAbilityUsed('shockwave');
        }
    }
}
