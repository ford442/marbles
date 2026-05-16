import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export class AbilityBomb {
    spawnBomb() {
        const now = Date.now()
        if (now - this.lastBombTime < this.bombCooldown) return
        this.lastBombTime = now

        const pos = this.playerMarble.rigidBody.translation()
        const linvel = this.playerMarble.rigidBody.linvel()

        // Spawn slightly above
        const spawnPos = { x: pos.x, y: pos.y + 1.0, z: pos.z }

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            // Preserve some of the player's momentum
            .setLinvel(linvel.x * 0.5, linvel.y + 5.0, linvel.z * 0.5)

        const body = this.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.ball(0.4)
            .setRestitution(0.5)
            .setFriction(0.5)
            .setDensity(2.0)
        this.world.createCollider(colliderDesc, body)

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.2, 0.2, 0.2])
        matInstance.setFloatParameter('roughness', 0.2)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.4, 0.4, 0.4] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity)

        this.scene.addEntity(entity)

        // Add a pulsing light to make it visible and dangerous looking
        const lightEntity = this.Filament.EntityManager.get().create()
        this.Filament.LightManager.Builder(this.Filament.LightManager$Type.POINT)
            .color([1.0, 0.2, 0.0])
            .intensity(25000.0)
            .falloff(10.0)
            .build(this.engine, lightEntity)
        this.scene.addEntity(lightEntity)

        this.activeBombs.push({
            entity: entity,
            rigidBody: body,
            matInstance: matInstance,
            lightEntity: lightEntity,
            spawnTime: now,
            duration: 2500 // 2.5 seconds until boom
        })
    }

    explodeBomb(bomb) {
        if (audio.playStomp) audio.playStomp()

        const pos = bomb.rigidBody.translation()
        const radius = 20.0
        const force = 120.0

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

export function applyAbilityBomb(targetClass) {
    for (const name of Object.getOwnPropertyNames(AbilityBomb.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = AbilityBomb.prototype[name];
        }
    }
}
