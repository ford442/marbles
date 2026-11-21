import { audio } from '../audio.js';

export class AbilityAirDash {
    constructor(game) {
        this.game = game;
    }

    beginAirDashCharge(now) {
        if (!this.game.playerMarble) return;
        const rb = this.game.playerMarble.rigidBody;

        this.game.isChargingAirDash = true;
        this.game.airDashChargeTime = now;
        this.game.airDashStartAltitude = rb.translation().y;
        this.game.airDashOldGravity = rb.gravityScale();

        // Hang-time wind-up as suggested
        rb.setGravityScale(0.2, true); // reduce gravity, don't zero completely

        if (audio.playBoost) audio.playBoost();
    }

    releaseAirDash(now) {
        if (!this.game.playerMarble || !this.game.isChargingAirDash) return;

        this.game.isChargingAirDash = false;
        this.game.lastAirDashTime = now;

        const rb = this.game.playerMarble.rigidBody;

        // Restore gravity
        const grav = this.game.airDashOldGravity !== undefined
            ? this.game.airDashOldGravity
            : (this.game.playerMarble.baseGravityScale || 1.0);
        rb.setGravityScale(grav, true);

        // Calculate force based on charge duration
        const chargeDuration = now - (this.game.airDashChargeTime || now);
        const maxChargeMs = 700.0;
        const powerMultiplier = Math.min(1.0, chargeDuration / maxChargeMs);
        const dashForce = 25.0 + 30.0 * powerMultiplier;

        // Apply impulse relative to aim
        const forwardX = Math.sin(this.game.aimYaw);
        const forwardZ = Math.cos(this.game.aimYaw);

        rb.applyImpulse({
            x: forwardX * dashForce,
            y: 4 * powerMultiplier, // small loft
            z: forwardZ * dashForce
        }, true);

        // Spawn effect using effectPool if available
        if (this.game.effectPool) {
            this.game.spawnJetpackExhaust?.(rb.translation(), rb.linvel());
        }

        if (audio.playBoost) audio.playBoost();
        if (typeof this.game.awardTrickPoints === 'function') {
            this.game.awardTrickPoints('Air Dash!', 25 + Math.floor(chargeDuration / 50), '#00ffff');
        }
        if (this.game.hudManager) this.game.hudManager.markAbilityUsed('airdashing');
    }
}
