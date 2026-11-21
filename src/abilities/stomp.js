import { audio } from '../audio.js';

export class AbilityStomp {
    constructor(game) {
        this.game = game;
    }

    beginStompCharge(now) {
        if (!this.game.playerMarble || this.game.isGrounded(this.game.playerMarble)) return;

        this.game.isChargingStomp = true;
        this.game.stompChargeTime = Date.now();
        this.game.stompStartAltitude = this.game.playerMarble.rigidBody.translation().y;

        this.game.stompOldGravity = this.game.playerMarble.rigidBody.gravityScale();
        if (this.game.playerMarble.color) {
            this.game.stompOldColor = [...this.game.playerMarble.color];
        }

        // Suspend gravity and zero velocity for "hang time" wind-up
        this.game.playerMarble.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.game.playerMarble.rigidBody.setGravityScale(0, true);

        if (typeof audio !== 'undefined' && audio.playBoost) {
            audio.playBoost();
        }
    }

    releaseStomp(now) {
        if (!this.game.isChargingStomp || !this.game.playerMarble) return;

        this.game.isChargingStomp = false;
        this.game.isStomping = true;
        this.game.stompReleaseTime = Date.now();
        // Cooldown starts on release (read by the Z edge detection in frame-input.js).
        this.game.lastStompTime = now ?? this.game.stompReleaseTime;

        // Restore gravity
        const grav = this.game.stompOldGravity !== undefined ? this.game.stompOldGravity : (this.game.playerMarble.baseGravityScale || 1.0);
        this.game.playerMarble.rigidBody.setGravityScale(grav, true);

        // Apply massive downward force scaling with charge time
        const chargeDuration = Date.now() - this.game.stompChargeTime;
        const force = 50.0 + Math.min(150.0, chargeDuration * 0.1); // Max charge cap
        const gravityDir = grav < 0 ? 1 : -1;

        this.game.playerMarble.rigidBody.setLinvel({ x: 0, y: force * gravityDir, z: 0 }, true);

        // Restore original color
        if (this.game.stompOldColor) {
            const rcm = this.game.engine.getRenderableManager();
            const inst = rcm.getInstance(this.game.playerMarble.entity);
            if (inst) {
                rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', this.game.Filament.RgbType.sRGB, this.game.stompOldColor);
            }
        }
    }
}
