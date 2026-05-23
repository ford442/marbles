import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export class AbilityMissiles {
    spawnMissile() {
        const now = Date.now()
        if (this.lastMissileTime !== 0 && now - this.lastMissileTime < this.missileCooldown) return
        this.lastMissileTime = now

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

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 0.5, 0.0])
        matInstance.setFloatParameter('roughness', 0.2)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.2, 0.2, 0.2] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity)

        this.scene.addEntity(entity)

        const lightEntity = this.Filament.EntityManager.get().create()
        this.Filament.LightManager.Builder(this.Filament.LightManager$Type.POINT)
            .color([1.0, 0.5, 0.0])
            .intensity(20000.0)
            .falloff(5.0)
            .build(this.engine, lightEntity)
        this.scene.addEntity(lightEntity)

        this.activeMissiles.push({
            entity: entity,
            rigidBody: body,
            matInstance: matInstance,
            lightEntity: lightEntity,
            spawnTime: now,
            duration: 3000
        })
        this.dynamicBodies.add(body)

        if (typeof audio !== 'undefined' && audio.playBoost) audio.playBoost()
    }

    explodeMissile(missilePos) {
        if (audio.playStomp) audio.playStomp()

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
                    y: (ny * 0.5 + 0.5) * force * factor, // Always bias upward
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
