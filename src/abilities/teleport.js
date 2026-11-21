import { audio } from '../audio.js';

export class AbilityTeleport {
    constructor(game) {
        this.game = game;
    }

    triggerTeleport() {
        if (!this.game.playerMarble) return
        this.game.lastTeleportTime = Date.now()

        const pos = this.game.playerMarble.rigidBody.translation()
        const cosP = Math.cos(this.game.pitchAngle)
        const sinP = Math.sin(this.game.pitchAngle)
        const dirX = Math.sin(this.game.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.game.aimYaw) * cosP

        const newPos = {
            x: pos.x + dirX * this.game.teleportDistance,
            y: pos.y + dirY * this.game.teleportDistance,
            z: pos.z + dirZ * this.game.teleportDistance
        }

        this.game.playerMarble.rigidBody.setTranslation(newPos, true)

        if (audio && audio.playTrick) {
            audio.playTrick()
        }

        console.log(`[GAME] Teleported to ${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}, ${newPos.z.toFixed(2)}`)
        
        if (this.game.hudManager) this.game.hudManager.markAbilityUsed('teleport')
    }
}
