import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export class AbilityMissiles {
    spawnMissile() {
        const now = Date.now()
        if (this.lastMissileTime !== 0 && now - this.lastMissileTime < this.missileCooldown) return
        if (!this.effectPool?.budget.canSpawnProjectile('missile')) return

        const pos = this.playerMarble.rigidBody.translation()

        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)
        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        const spawnPos = {
            x: pos.x + dirX * 1.5,
            y: pos.y + dirY * 1.5,
            z: pos.z + dirZ * 1.5
        }

        const slot = this.effectPool.acquireProjectile('missile', spawnPos)
        if (!slot) return
        this.lastMissileTime = now

        const missileSpeed = 40.0

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setLinvel(dirX * missileSpeed, dirY * missileSpeed, dirZ * missileSpeed)
            .setGravityScale(0)

        const body = this.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.ball(0.2)
            .setRestitution(0.5)
            .setFriction(0.5)
            .setDensity(0.5)
        this.world.createCollider(colliderDesc, body)

        this.effectPool.bindProjectileLight(slot, body)

        this.activeMissiles.push({
            entity: slot.entity,
            rigidBody: body,
            matInstance: slot.matInstance,
            lightEntity: slot.lightEntity,
            _poolSlot: slot,
            spawnTime: now,
            duration: 3000
        })
        this.dynamicBodies.add(body)

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

        for (const m of this.marbles) {
            applyExplosionForce(m.rigidBody)
        }

        for (const obj of this.dynamicObjects) {
            applyExplosionForce(obj.rigidBody)
        }
    }
}

export function applyAbilityMissiles(targetClass) {
    for (const name of Object.getOwnPropertyNames(AbilityMissiles.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = AbilityMissiles.prototype[name];
        }
    }
}
