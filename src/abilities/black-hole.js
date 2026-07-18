import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export class AbilityBlackHole {
    spawnBlackHole() {
        const now = Date.now()
        if (now - this.lastBlackHoleTime < this.blackHoleCooldown) return
        if (!this.effectPool?.budget.canSpawnProjectile('blackHole')) return

        const pos = this.playerMarble.rigidBody.translation()
        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)

        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        const spawnPos = {
            x: pos.x + dirX * 2.0,
            y: pos.y + dirY * 2.0,
            z: pos.z + dirZ * 2.0
        }

        const slot = this.effectPool.acquireProjectile('blackHole', spawnPos)
        if (!slot) return
        this.lastBlackHoleTime = now

        const moveSpeed = 5.0

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setLinvel(dirX * moveSpeed, dirY * moveSpeed, dirZ * moveSpeed)
            .setGravityScale(0)

        const body = this.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.ball(0.5)
            .setDensity(50.0)
        this.world.createCollider(colliderDesc, body)

        this.effectPool.bindProjectileLight(slot, body)

        this.activeBlackHoles.push({
            entity: slot.entity,
            rigidBody: body,
            matInstance: slot.matInstance,
            lightEntity: slot.lightEntity,
            _poolSlot: slot,
            spawnTime: now,
            duration: 8000
        })
        this.dynamicBodies.add(body)

        if (typeof audio !== 'undefined' && audio.playTrick) audio.playTrick()
        
        if (this.hudManager) this.hudManager.markAbilityUsed('blackhole')
    }
}

export function applyAbilityBlackHole(targetClass) {
    for (const name of Object.getOwnPropertyNames(AbilityBlackHole.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = AbilityBlackHole.prototype[name];
        }
    }
}
