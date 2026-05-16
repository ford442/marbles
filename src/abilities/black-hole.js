import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export class AbilityBlackHole {
    spawnBlackHole() {
        const now = Date.now()
        if (now - this.lastBlackHoleTime < this.blackHoleCooldown) return
        this.lastBlackHoleTime = now

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

        const moveSpeed = 5.0

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setLinvel(dirX * moveSpeed, dirY * moveSpeed, dirZ * moveSpeed)
            .setGravityScale(0)

        const body = this.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.ball(0.5)
            .setDensity(50.0) // Very dense, so it's hard to push around
        this.world.createCollider(colliderDesc, body)

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.05, 0.0, 0.1])
        matInstance.setFloatParameter('roughness', 0.1)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity)

        this.scene.addEntity(entity)

        const lightEntity = this.Filament.EntityManager.get().create()
        this.Filament.LightManager.Builder(this.Filament.LightManager$Type.POINT)
            .color([0.3, 0.0, 0.8])
            .intensity(80000.0)
            .falloff(20.0)
            .build(this.engine, lightEntity)
        this.scene.addEntity(lightEntity)

        this.activeBlackHoles.push({
            entity: entity,
            rigidBody: body,
            matInstance: matInstance,
            lightEntity: lightEntity,
            spawnTime: now,
            duration: 8000 // Lasts for 8 seconds
        })

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
