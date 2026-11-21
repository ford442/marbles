// @ts-check
import { audio } from '../audio.js';
import { applyVelocityChange } from '../game/systems/body-impulse.ts';
import { DOUBLE_JUMP_DV } from './movement-tuning.js';

/** @typedef {import('../types/mixin-host.ts').GameMixinHost} GameMixinHost */

export class AbilityDoubleJump {
    /** @param {GameMixinHost} game */
    constructor(game) {
        this.game = game;
    }

    executeDoubleJump() {
        if (!this.game.playerMarble || this.game.hasDoubleJumped) return;

        const rb = this.game.playerMarble.rigidBody;
        const linvel = rb.linvel();
        const gravityDir = rb.gravityScale() < 0 ? -1 : 1;

        // Reset downward velocity depending on gravity direction, preserving upward (jumping) velocity
        const newVelY = gravityDir > 0
            ? Math.max(0, linvel.y)
            : Math.min(0, linvel.y);

        rb.setLinvel({ x: linvel.x, y: newVelY, z: linvel.z }, true);
        applyVelocityChange(rb, { x: 0, y: DOUBLE_JUMP_DV * gravityDir, z: 0 });

        this.game.hasDoubleJumped = true;
        this.game.jumpCount = 2;

        if (typeof audio !== 'undefined' && audio.playJump) {
            audio.playJump();
        }

        if (typeof this.game.awardTrickPoints === 'function') {
            this.game.awardTrickPoints('Double Jump!', 20, '#00bfff');
        }

        if (this.game.hudManager) {
            this.game.hudManager.markAbilityUsed('doublejump');
        }
    }
}
