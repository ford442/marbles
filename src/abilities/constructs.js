// @ts-check
import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import { quatFromEuler, quaternionToMat4 } from '../math.ts';
import { scaledTransform } from '../game-loop/helpers.ts';

/** @typedef {import('../types/mixin-host.ts').GameMixinHost} GameMixinHost */
/** @typedef {{ x: number, y: number, z: number }} Vec3Like */

export class AbilityConstructs {
    /**
     * @this {GameMixinHost}
     * @param {Vec3Like} pos
     */
    spawnIceBlock(pos) {
        const now = Date.now()
        const spawnPos = { x: pos.x, y: pos.y - 0.6, z: pos.z }
        const halfExtents = { x: 0.6, y: 0.1, z: 0.6 }

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
        const body = this.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
            .setFriction(0.0)
            .setRestitution(0.1)
        this.world.createCollider(colliderDesc, body)

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.5, 0.9, 1.0])
        matInstance.setFloatParameter('roughness', 0.1)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity)

        const tcm = this.engine.getTransformManager()
        const inst = tcm.getInstance(entity)
        const mat = scaledTransform(spawnPos, { x: 0, y: 0, z: 0, w: 1 }, {
            x: halfExtents.x * 2,
            y: halfExtents.y * 2,
            z: halfExtents.z * 2,
        })

        tcm.setTransform(inst, mat)
        this.scene.addEntity(entity)

        this.temporaryPlatforms.push({
            entity: entity,
            rigidBody: body,
            matInstance: matInstance,
            spawnTime: now,
            duration: 2000
        })
    }

    /**
     * @this {GameMixinHost}
     * @param {string} type
     */
    spawnBuildPiece(type) {
        if (!this.playerMarble || this.buildEnergy < 25) return

        this.buildEnergy -= 25

        const pos = this.playerMarble.rigidBody.translation()
        const dirX = Math.sin(this.aimYaw)
        const dirZ = Math.cos(this.aimYaw)

        // Spawn 3 units in front
        const spawnPos = { x: pos.x + dirX * 3, y: pos.y, z: pos.z + dirZ * 3 }

        let halfExtents, rot, color, restitution

        if (type === 'ramp') {
            halfExtents = { x: 2, y: 0.1, z: 3 }
            rot = quatFromEuler(this.aimYaw, 0.5, 0)
            color = [0.0, 1.0, 0.0]
            restitution = 0.3
        } else if (type === 'floor') {
            halfExtents = { x: 2, y: 0.1, z: 2 }
            rot = quatFromEuler(this.aimYaw, 0, 0)
            color = [0.0, 0.5, 1.0]
            restitution = 0.3
        } else if (type === 'bouncer') {
            halfExtents = { x: 2, y: 0.5, z: 2 }
            rot = quatFromEuler(this.aimYaw, 0, 0)
            color = [0.8, 0.0, 1.0]
            restitution = 2.0
        } else {
            return
        }

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(spawnPos.x, spawnPos.y, spawnPos.z).setRotation(rot)
        const body = this.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
            .setFriction(0.5)
            .setRestitution(restitution)
        this.world.createCollider(colliderDesc, body)

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color)
        matInstance.setFloatParameter('roughness', 0.1)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity)

        const tcm = this.engine.getTransformManager()
        const inst = tcm.getInstance(entity)
        const mat = scaledTransform(spawnPos, rot, {
            x: halfExtents.x * 2,
            y: halfExtents.y * 2,
            z: halfExtents.z * 2,
        })

        tcm.setTransform(inst, mat)
        this.scene.addEntity(entity)

        this.temporaryPlatforms.push({
            entity: entity,
            rigidBody: body,
            matInstance: matInstance,
            spawnTime: Date.now(),
            duration: 15000 // Lasts 15 seconds
        })

        if (audio && audio.playJump) audio.playJump()
        
        if (this.hudManager) this.hudManager.markAbilityUsed('build')
    }

    /**
     * @this {GameMixinHost}
     * @param {any} portal
     */
    destroyPortal(portal) {
        if (!portal) return
        this.scene.remove(portal.entity)
        if (portal.matInstance) this.engine.destroyMaterialInstance(portal.matInstance)
        this.engine.destroyEntity(portal.entity)
        this.Filament.EntityManager.get().destroy(portal.entity)
        if (portal.lightEntity) {
            this.scene.remove(portal.lightEntity)
            this.engine.destroyEntity(portal.lightEntity)
            this.Filament.EntityManager.get().destroy(portal.lightEntity)
        }
    }

    /**
     * @this {GameMixinHost}
     * @param {'A' | 'B'} type
     */
    firePortal(type) {
        if (!this.playerMarble) return
        const rb = this.playerMarble.rigidBody
        const pos = rb.translation()
        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)
        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        const rayDir = { x: dirX, y: dirY, z: dirZ }

        // Ignore the marble itself
        const hit = this.physicsQueries.castRay(pos, rayDir, 100.0, { excludeBody: rb })

        if (hit) {
            const hitPos = hit.point

            // Offset the portal slightly back towards the player along the ray
            // so it doesn't z-fight
            const portalPos = {
                x: hitPos.x - dirX * 0.1,
                y: hitPos.y - dirY * 0.1,
                z: hitPos.z - dirZ * 0.1
            }

            // Find a rotation that aligns with the hit normal (inverse of rayDir roughly)
            const up = { x: 0, y: 1, z: 0 }
            const right = {
                x: up.y * -dirZ - up.z * -dirY,
                y: up.z * -dirX - up.x * -dirZ,
                z: up.x * -dirY - up.y * -dirX
            }

            const color = type === 'A' ? [0.0, 0.5, 1.0] : [1.0, 0.5, 0.0]
            const indicatorColor = type === 'A' ? '#0088ff' : '#ff8800'

            const entity = this.Filament.EntityManager.get().create()
            const matInstance = this.material.createInstance()
            matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color)
            matInstance.setFloatParameter('roughness', 0.1)

            const radius = 1.0
            const thickness = 0.1

            this.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [radius, thickness, radius] })
                .material(0, matInstance)
                .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb) // flattened sphere
                .receiveShadows(true)
                .castShadows(true)
                .build(this.engine, entity)

            const lightEntity = this.Filament.EntityManager.get().create()
            this.Filament.LightManager.Builder(this.Filament.LightManager$Type.POINT)
                .color(color)
                .intensity(30000.0)
                .falloff(10.0)
                .build(this.engine, lightEntity)

            this.scene.addEntity(entity)
            this.scene.addEntity(lightEntity)

            const tcm = this.engine.getTransformManager()
            const inst = tcm.getInstance(entity)
            const lightInst = tcm.getInstance(lightEntity)

            // Look-at rotation logic for the portal visually:
            const pitch = Math.asin(-dirY)
            const yaw = Math.atan2(dirX, dirZ)
            const rot = quatFromEuler(yaw, pitch, 0)

            const mat = scaledTransform(portalPos, rot, { x: radius * 2, y: thickness * 2, z: radius * 2 })

            tcm.setTransform(inst, mat)
            const lightMat = quaternionToMat4(portalPos, { x: 0, y: 0, z: 0, w: 1 })
            tcm.setTransform(lightInst, lightMat)

            const newPortal = {
                entity: entity,
                matInstance: matInstance,
                lightEntity: lightEntity,
                pos: portalPos,
                normal: { x: -dirX, y: -dirY, z: -dirZ } // The direction the portal faces
            }

            const statusEl = document.getElementById(type === 'A' ? 'portal-a-status' : 'portal-b-status')
            if (type === 'A') {
                if (this.portalA) this.destroyPortal(this.portalA)
                this.portalA = newPortal
            } else {
                if (this.portalB) this.destroyPortal(this.portalB)
                this.portalB = newPortal
            }
            if (statusEl) {
                statusEl.style.color = indicatorColor
                statusEl.textContent = type === 'A' ? '🔵' : '🟠'
            }

            if (audio && audio.playTrick) audio.playTrick()
            console.log(`[GAME] Portal ${type} fired to`, portalPos)
        }
    }

    /**
     * @this {GameMixinHost}
     * @param {Vec3Like} pos
     * @param {Vec3Like} linvel
     */
    spawnJetpackExhaust(pos, linvel) {
        this.effectPool?.spawnVisualParticle({
            color: [1.0, 0.6, 0.0],
            roughness: 0.8,
            spawnTime: Date.now(),
            pos: { x: pos.x, y: pos.y, z: pos.z },
            vel: { x: -linvel.x * 0.1 + (Math.random() - 0.5) * 2, y: -linvel.y * 0.1 - 2.0, z: -linvel.z * 0.1 + (Math.random() - 0.5) * 2 },
            duration: 500,
            scale: 1.0
        })
    }

    /** @this {GameMixinHost} */
    fireGravityPulse() {
        if (!this.playerMarble) return
        const now = Date.now()
        if (now - this.lastGravityPulseTime < this.gravityPulseCooldown) return
        this.lastGravityPulseTime = now

        const pos = this.playerMarble.rigidBody.translation()
        const pulseRadius = 20.0
        let hits = 0

        const bodiesToCheck = [...(this.marbles || []), ...(this.dynamicObjects || [])]

        for (const obj of bodiesToCheck) {
            if (obj === this.playerMarble) continue
            if (!obj.rigidBody) continue

            const objPos = obj.rigidBody.translation()
            const dx = objPos.x - pos.x
            const dy = objPos.y - pos.y
            const dz = objPos.z - pos.z
            const distSq = dx * dx + dy * dy + dz * dz

            if (distSq < pulseRadius * pulseRadius) {
                // Invert gravity scale
                const currentGravity = obj.rigidBody.gravityScale()
                // Ensure we invert based on the original gravity, or just flip the sign
                obj.rigidBody.setGravityScale(-currentGravity, true)
                hits++

                // Set a timeout to revert the gravity scale
                setTimeout(() => {
                    if (obj && obj.rigidBody) {
                        const revertedGravity = obj.rigidBody.gravityScale()
                        obj.rigidBody.setGravityScale(-revertedGravity, true)
                    }
                }, 3000)
            }
        }

        if (hits > 0 && typeof this.awardTrickPoints === 'function') {
            this.awardTrickPoints('Gravity Pulse!', 20 * hits, '#ffff00')
        }

        if (typeof audio !== 'undefined' && audio.playBoost) {
            audio.playBoost() // Or another suitable sound effect
        }

        console.log(`[GAME] Gravity Pulse fired! Hit ${hits} objects.`)
    }

    /** @this {GameMixinHost} */
    spawnHoloPlatform() {
        const now = Date.now()
        if (now - this.lastHoloTime < this.holoCooldown) return

        if (!this.playerMarble) return
        this.lastHoloTime = now
        const pos = this.playerMarble.rigidBody.translation()

        const spawnPos = { x: pos.x, y: pos.y - 1.2, z: pos.z }
        const halfExtents = { x: 3, y: 0.2, z: 3 }

        const slot = this.effectPool?.acquireHoloPlatform()
        if (!slot) return

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
        const body = this.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
            .setFriction(0.5)
            .setRestitution(0.3)
        this.world.createCollider(colliderDesc, body)

        const tcm = this.engine.getTransformManager()
        const inst = tcm.getInstance(slot.entity)
        const mat = scaledTransform(spawnPos, { x: 0, y: 0, z: 0, w: 1 }, {
            x: halfExtents.x * 2,
            y: halfExtents.y * 2,
            z: halfExtents.z * 2,
        })

        tcm.setTransform(inst, mat)

        this.temporaryPlatforms.push({
            entity: slot.entity,
            rigidBody: body,
            matInstance: slot.matInstance,
            _poolSlot: slot,
            spawnTime: now
        })
    }
}
