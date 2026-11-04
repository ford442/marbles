// @ts-check
import { audio } from '../audio.js';
import { applyVelocityChange } from '../game/systems/body-impulse.ts';
import { DOUBLE_JUMP_DV } from './movement-tuning.js';

/** @typedef {import('../types/mixin-host.ts').GameMixinHost} GameMixinHost */

export class AbilityDoubleJump {
    /** @this {GameMixinHost} */
    executeDoubleJump() {
        if (!this.playerMarble || this.hasDoubleJumped) return;

        const rb = this.playerMarble.rigidBody;
        const linvel = rb.linvel();
        const gravityDir = rb.gravityScale() < 0 ? -1 : 1;

        // Reset downward velocity depending on gravity direction, preserving upward (jumping) velocity
        const newVelY = gravityDir > 0
            ? Math.max(0, linvel.y)
            : Math.min(0, linvel.y);

        rb.setLinvel({ x: linvel.x, y: newVelY, z: linvel.z }, true);
        applyVelocityChange(rb, { x: 0, y: DOUBLE_JUMP_DV * gravityDir, z: 0 });

        this.hasDoubleJumped = true;
        this.jumpCount = 2;

        if (typeof audio !== 'undefined' && audio.playJump) {
            audio.playJump();
        }

        if (typeof this.awardTrickPoints === 'function') {
            this.awardTrickPoints('Double Jump!', 20, '#00bfff');
        }

        if (this.hudManager) {
            this.hudManager.markAbilityUsed('doublejump');
        }
    }
}
