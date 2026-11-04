import { audio } from '../audio.js';
import { getMarblePhysics } from '../wasm-bridge.js';

export class AbilityHover {
    beginHoverCharge(now) {
        if (!this.playerMarble) return;
        this.isHovering = true;
        this.hoverCharge = 1.0; // Start with full hover energy
        this.hoverStartTime = now;

        const rb = this.playerMarble.rigidBody;
        this.hoverOldGravity = rb.gravityScale();
        rb.setGravityScale(0.1, true); // Greatly reduce gravity for the floaty feel

        if (audio.playBoost) audio.playBoost();
    }

    updateHover(now, frameDeltaSec) {
        if (!this.playerMarble || !this.isHovering) return;

        this.hoverCharge = Math.max(0, this.hoverCharge - frameDeltaSec * 0.5); // Deplete over ~2 seconds

        if (this.hoverCharge <= 0) {
            this.releaseHover(now);
            return;
        }

        const rb = this.playerMarble.rigidBody;
        const vel = rb.linvel();

        // Counteract downward velocity
        if (vel.y < 0) {
            rb.applyImpulse({ x: 0, y: -vel.y * 1.5, z: 0 }, true);
        }

        // Add slight upward drift
        rb.applyImpulse({ x: 0, y: 5.0 * frameDeltaSec, z: 0 }, true);

        // Spawn visual exhaust if effectPool exists
        if (this.effectPool && typeof this.spawnJetpackExhaust === 'function') {
            this.spawnJetpackExhaust();
        }
    }

    releaseHover(now) {
        if (!this.playerMarble || !this.isHovering) return;

        this.isHovering = false;
        this.lastHoverTime = now;

        const rb = this.playerMarble.rigidBody;

        // Restore gravity
        const grav = this.hoverOldGravity !== undefined
            ? this.hoverOldGravity
            : (this.playerMarble.baseGravityScale || 1.0);
        rb.setGravityScale(grav, true);

        if (this.hudManager) this.hudManager.markAbilityUsed('hover');
    }
}
