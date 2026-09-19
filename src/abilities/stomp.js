import { audio } from '../audio.js';

export class AbilityStomp {
    beginStompCharge(now) {
        if (!this.playerMarble || this.isGrounded(this.playerMarble)) return;

        this.isChargingStomp = true;
        this.stompChargeTime = Date.now();
        this.stompStartAltitude = this.playerMarble.rigidBody.translation().y;

        this.stompOldGravity = this.playerMarble.rigidBody.gravityScale();
        if (this.playerMarble.color) {
            this.stompOldColor = [...this.playerMarble.color];
        }

        // Suspend gravity and zero velocity for "hang time" wind-up
        this.playerMarble.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.playerMarble.rigidBody.setGravityScale(0, true);

        if (typeof audio !== 'undefined' && audio.playBoost) {
            audio.playBoost();
        }
    }

    releaseStomp(now) {
        if (!this.isChargingStomp || !this.playerMarble) return;

        this.isChargingStomp = false;
        this.isStomping = true;
        this.stompReleaseTime = Date.now();

        // Restore gravity
        const grav = this.stompOldGravity !== undefined ? this.stompOldGravity : (this.playerMarble.baseGravityScale || 1.0);
        this.playerMarble.rigidBody.setGravityScale(grav, true);

        // Apply massive downward force scaling with charge time
        const chargeDuration = Date.now() - this.stompChargeTime;
        const force = 50.0 + Math.min(150.0, chargeDuration * 0.1); // Max charge cap
        const gravityDir = grav < 0 ? 1 : -1;

        this.playerMarble.rigidBody.setLinvel({ x: 0, y: force * gravityDir, z: 0 }, true);

        // Restore original color
        if (this.stompOldColor) {
            const rcm = this.engine.getRenderableManager();
            const inst = rcm.getInstance(this.playerMarble.entity);
            if (inst) {
                rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, this.stompOldColor);
            }
        }
    }
}
