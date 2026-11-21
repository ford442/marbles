import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export class AbilityBlackHole {
    constructor(game) {
        this.game = game;
    }

    spawnBlackHole() {
        const now = Date.now()
        if (now - this.game.lastBlackHoleTime < this.game.blackHoleCooldown) return
        if (!this.game.effectPool?.budget.canSpawnProjectile('blackHole')) return

        const pos = this.game.playerMarble.rigidBody.translation()
        const cosP = Math.cos(this.game.pitchAngle)
        const sinP = Math.sin(this.game.pitchAngle)

        const dirX = Math.sin(this.game.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.game.aimYaw) * cosP

        const spawnPos = {
            x: pos.x + dirX * 2.0,
            y: pos.y + dirY * 2.0,
            z: pos.z + dirZ * 2.0
        }

        const slot = this.game.effectPool.acquireProjectile('blackHole', spawnPos)
        if (!slot) return
        this.game.lastBlackHoleTime = now

        const moveSpeed = 5.0

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setLinvel(dirX * moveSpeed, dirY * moveSpeed, dirZ * moveSpeed)
            .setGravityScale(0)

        const body = this.game.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.ball(0.5)
            .setDensity(50.0)
        this.game.world.createCollider(colliderDesc, body)

        this.game.effectPool.bindProjectileLight(slot, body)

        this.game.activeBlackHoles.push({
            entity: slot.entity,
            rigidBody: body,
            matInstance: slot.matInstance,
            lightEntity: slot.lightEntity,
            _poolSlot: slot,
            spawnTime: now,
            duration: 8000
        })
        this.game.dynamicBodies.add(body)

        if (typeof audio !== 'undefined' && audio.playTrick) audio.playTrick()
        
        if (this.game.hudManager) this.game.hudManager.markAbilityUsed('blackhole')
    }
}
