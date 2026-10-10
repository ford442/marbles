import { audio } from '../audio.js';

export class AbilityDoubleJump {
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
        rb.applyImpulse({ x: 0, y: 15.0 * gravityDir, z: 0 }, true);

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
