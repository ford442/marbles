import { audio } from '../audio.js';

export class AbilityTeleport {
    triggerTeleport() {
        if (!this.playerMarble) return
        this.lastTeleportTime = Date.now()

        const pos = this.playerMarble.rigidBody.translation()
        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)
        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        const newPos = {
            x: pos.x + dirX * this.teleportDistance,
            y: pos.y + dirY * this.teleportDistance,
            z: pos.z + dirZ * this.teleportDistance
        }

        this.playerMarble.rigidBody.setTranslation(newPos, true)

        if (audio && audio.playTrick) {
            audio.playTrick()
        }

        console.log(`[GAME] Teleported to ${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}, ${newPos.z.toFixed(2)}`)
        
        if (this.hudManager) this.hudManager.markAbilityUsed('teleport')
    }
}

export function applyAbilityTeleport(targetClass) {
    for (const name of Object.getOwnPropertyNames(AbilityTeleport.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = AbilityTeleport.prototype[name];
        }
    }
}
