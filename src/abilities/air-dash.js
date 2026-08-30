import { audio } from '../audio.js';

export class AbilityAirDash {
    beginAirDashCharge(now) {
        if (!this.playerMarble) return;
        const rb = this.playerMarble.rigidBody;

        this.isChargingAirDash = true;
        this.airDashChargeTime = now;
        this.airDashStartAltitude = rb.translation().y;
        this.airDashOldGravity = rb.gravityScale();

        // Hang-time wind-up as suggested
        rb.setGravityScale(0.2, true); // reduce gravity, don't zero completely

        if (audio.playBoost) audio.playBoost();
    }

    releaseAirDash(now) {
        if (!this.playerMarble || !this.isChargingAirDash) return;

        this.isChargingAirDash = false;
        this.lastAirDashTime = now;

        const rb = this.playerMarble.rigidBody;

        // Restore gravity
        const grav = this.airDashOldGravity !== undefined
            ? this.airDashOldGravity
            : (this.playerMarble.baseGravityScale || 1.0);
        rb.setGravityScale(grav, true);

        // Calculate force based on charge duration
        const chargeDuration = now - (this.airDashChargeTime || now);
        const maxChargeMs = 700.0;
        const powerMultiplier = Math.min(1.0, chargeDuration / maxChargeMs);
        const dashForce = 25.0 + 30.0 * powerMultiplier;

        // Apply impulse relative to aim
        const forwardX = Math.sin(this.aimYaw);
        const forwardZ = Math.cos(this.aimYaw);

        rb.applyImpulse({
            x: forwardX * dashForce,
            y: 4 * powerMultiplier, // small loft
            z: forwardZ * dashForce
        }, true);

        // Spawn effect using effectPool if available
        if (this.effectPool) {
            this.spawnJetpackExhaust?.();
        }

        if (audio.playBoost) audio.playBoost();
        if (typeof this.awardTrickPoints === 'function') {
            this.awardTrickPoints('Air Dash!', 25 + Math.floor(chargeDuration / 50), '#00ffff');
        }
        if (this.hudManager) this.hudManager.markAbilityUsed('airdashing');
    }
}
