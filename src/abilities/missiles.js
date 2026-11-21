import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export class AbilityMissiles {
    constructor(game) {
        this.game = game;
    }

    spawnMissile() {
        const now = Date.now()
        if (this.game.lastMissileTime !== 0 && now - this.game.lastMissileTime < this.game.missileCooldown) return
        if (!this.game.effectPool?.budget.canSpawnProjectile('missile')) return

        const pos = this.game.playerMarble.rigidBody.translation()

        const cosP = Math.cos(this.game.pitchAngle)
        const sinP = Math.sin(this.game.pitchAngle)
        const dirX = Math.sin(this.game.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.game.aimYaw) * cosP

        const spawnPos = {
            x: pos.x + dirX * 1.5,
            y: pos.y + dirY * 1.5,
            z: pos.z + dirZ * 1.5
        }

        const slot = this.game.effectPool.acquireProjectile('missile', spawnPos)
        if (!slot) return
        this.game.lastMissileTime = now

        const missileSpeed = 40.0

        // CCD: at 40 m/s a 0.2 m missile moves ~0.67 m per 1/60 s step and
        // would otherwise pass straight through thin walls.
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setLinvel(dirX * missileSpeed, dirY * missileSpeed, dirZ * missileSpeed)
            .setGravityScale(0)
            .setCcdEnabled(true)

        const body = this.game.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.ball(0.2)
            .setRestitution(0.5)
            .setFriction(0.5)
            .setDensity(0.5)
        this.game.world.createCollider(colliderDesc, body)

        this.game.effectPool.bindProjectileLight(slot, body)

        this.game.activeMissiles.push({
            entity: slot.entity,
            rigidBody: body,
            matInstance: slot.matInstance,
            lightEntity: slot.lightEntity,
            _poolSlot: slot,
            spawnTime: now,
            duration: 3000
        })
        this.game.dynamicBodies.add(body)

        if (audio.playAbility) audio.playAbility('missile', spawnPos)
    }

    explodeMissile(missilePos) {
        if (audio.playAbility) audio.playAbility('bomb', missilePos)

        const pos = missilePos
        const radius = 10.0
        const force = 80.0

        const applyExplosionForce = (body) => {
            const t = body.translation()
            const dx = t.x - pos.x
            const dy = t.y - pos.y
            const dz = t.z - pos.z
            const dist = Math.hypot(dx, dy, dz)

            if (dist < radius && dist > 0.1) {
                const factor = 1.0 - (dist / radius)
                const nx = dx / dist
                const ny = dy / dist
                const nz = dz / dist

                body.applyImpulse({
                    x: nx * force * factor,
                    y: (ny * 0.5 + 0.5) * force * factor,
                    z: nz * force * factor
                }, true)
            }
        }

        for (const m of this.game.marbles) {
            applyExplosionForce(m.rigidBody)
        }

        for (const obj of this.game.dynamicObjects) {
            applyExplosionForce(obj.rigidBody)
        }
    }
}
