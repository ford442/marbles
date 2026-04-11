import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from './audio.js';
import { quatFromEuler, quaternionToMat4 } from './math.js';

export class AbilityMethods {

    triggerBlink() {
        if (!this.playerMarble) return
        const now = Date.now()
        if (now - this.lastBlinkTime < this.blinkCooldown) return
        this.lastBlinkTime = now

        const rb = this.playerMarble.rigidBody
        const pos = rb.translation()
        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)

        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        const maxDist = 10.0
        const rayOrigin = { x: pos.x, y: pos.y, z: pos.z }
        const rayDir = { x: dirX, y: dirY, z: dirZ }
        const ray = new RAPIER.Ray(rayOrigin, rayDir)

        let blinkDist = maxDist
        const hit = this.world.castRay(ray, maxDist, true, 0xffffffff, undefined, undefined, rb)

        if (hit) {
            const hitBody = hit.collider.parent()
            // If the hit has no body (static world geometry) or the body is not the player
            if (!hitBody || hitBody.handle !== rb.handle) {
                const radius = this.playerMarble.scale * 0.5 || 0.5
                blinkDist = Math.max(0, hit.toi - radius - 0.1)
            }
        }

        const newPos = {
            x: pos.x + dirX * blinkDist,
            y: pos.y + dirY * blinkDist,
            z: pos.z + dirZ * blinkDist
        }

        // Keep current momentum, just set translation
        rb.setTranslation(newPos, true)

        // Visuals
        const color = [1.0, 0.8, 0.0] // Yellow/gold blink

        // Start particle
        this.spawnBlinkParticle(pos, color)
        // End particle
        this.spawnBlinkParticle(newPos, color)

        if (typeof audio !== 'undefined' && typeof audio.playTrick === 'function') {
            audio.playTrick()
        }

        if (typeof this.awardTrickPoints === 'function') {
             this.awardTrickPoints('Blink!', 15, '#ffcc00')
        }

        console.log(`[GAME] Blinked ${blinkDist.toFixed(2)} units to ${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}, ${newPos.z.toFixed(2)}`)
    }

    spawnBlinkParticle(pos, color) {
        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color)
        matInstance.setFloatParameter('roughness', 0.1)

        const radius = this.playerMarble ? (this.playerMarble.scale * 0.5 || 0.5) : 0.5

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [radius, radius, radius] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
            .build(this.engine, entity)

        const tcm = this.engine.getTransformManager()
        const inst = tcm.getInstance(entity)
        const mat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 })

        const sx = radius * 2; const sy = radius * 2; const sz = radius * 2;
        mat[0] *= sx; mat[1] *= sx; mat[2] *= sx;
        mat[4] *= sy; mat[5] *= sy; mat[6] *= sy;
        mat[8] *= sz; mat[9] *= sz; mat[10] *= sz;

        tcm.setTransform(inst, mat)
        this.scene.addEntity(entity)

        this.visualParticles.push({
            entity: entity,
            matInstance: matInstance,
            spawnTime: Date.now(),
            pos: { x: pos.x, y: pos.y, z: pos.z },
            vel: { x: 0, y: 0.5, z: 0 },
            duration: 300,
            scale: 1.0,
            isRing: false // Will fade out and shrink
        })
    }
    fireEMP() {
        if (!this.playerMarble) return
        const now = Date.now()
        if (now - this.lastEmpTime < this.empCooldown) return
        this.lastEmpTime = now

        const pos = this.playerMarble.rigidBody.translation()
        const empRadius = 15.0
        const empForce = 50.0

        // Find all dynamic objects
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

            if (distSq < empRadius * empRadius) {
                const dist = Math.sqrt(distSq)
                const forceScale = 1.0 - (dist / empRadius)
                const nx = dx / (dist || 1)
                const ny = dy / (dist || 1)
                const nz = dz / (dist || 1)

                obj.rigidBody.applyImpulse({
                    x: nx * empForce * forceScale,
                    y: (ny + 0.5) * empForce * forceScale, // Give a bit of upward lift
                    z: nz * empForce * forceScale
                }, true)
                hits++
            }
        }

        if (hits > 0 && typeof this.awardTrickPoints === 'function') {
            this.awardTrickPoints('EMP Blast!', 30 * hits, '#aaddff')
        }

        if (typeof audio !== 'undefined' && audio.playBomb) {
            audio.playBomb()
        }

        console.log(`[GAME] EMP Shockwave fired! Hit ${hits} objects.`)
    }

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
    }

    shootMissile() {
        const now = Date.now()
        if (now - this.lastMissileTime < this.missileCooldown) return
        this.lastMissileTime = now

        const pos = this.playerMarble.rigidBody.translation()
        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)

        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        const spawnPos = { x: pos.x + dirX * 1.5, y: pos.y + dirY * 1.5, z: pos.z + dirZ * 1.5 }
        const speed = 150.0

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setLinvel(dirX * speed, dirY * speed, dirZ * speed)
            .setCanSleep(false)

        const body = this.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.ball(0.2).setDensity(2.0)
        this.world.createCollider(colliderDesc, body)

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 0.5, 0.0])
        matInstance.setFloatParameter('roughness', 0.1)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.2, 0.2, 0.2] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
            .build(this.engine, entity)

        this.scene.addEntity(entity)

        const lightEntity = this.Filament.EntityManager.get().create()
        this.Filament.LightManager.Builder(this.Filament.LightManager$Type.POINT)
            .color([1.0, 0.5, 0.0])
            .intensity(50000.0)
            .falloff(15.0)
            .build(this.engine, lightEntity)
        this.scene.addEntity(lightEntity)

        if (audio.playBoost) audio.playBoost()

        this.activeMissiles.push({
            entity: entity,
            rigidBody: body,
            matInstance: matInstance,
            lightEntity: lightEntity,
            spawnTime: now,
            duration: 3000,
            lastPos: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z }
        })
    }

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
    }

    explodeMissileObject(missile) {
        if (audio.playStomp) audio.playStomp()

        const pos = missile.rigidBody.translation()
        const radius = 15.0
        const force = 100.0

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
            .build(this.engine, entity)

        const tcm = this.engine.getTransformManager()
        const inst = tcm.getInstance(entity)
        const mat = quaternionToMat4(spawnPos, { x: 0, y: 0, z: 0, w: 1 })

        const sx = halfExtents.x * 2;
        const sy = halfExtents.y * 2;
        const sz = halfExtents.z * 2;

        mat[0] *= sx; mat[1] *= sx; mat[2] *= sx;
        mat[4] *= sy; mat[5] *= sy; mat[6] *= sy;
        mat[8] *= sz; mat[9] *= sz; mat[10] *= sz;

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
            .build(this.engine, entity)

        const tcm = this.engine.getTransformManager()
        const inst = tcm.getInstance(entity)
        const mat = quaternionToMat4(spawnPos, rot)

        const sx = halfExtents.x * 2;
        const sy = halfExtents.y * 2;
        const sz = halfExtents.z * 2;

        mat[0] *= sx; mat[1] *= sx; mat[2] *= sx;
        mat[4] *= sy; mat[5] *= sy; mat[6] *= sy;
        mat[8] *= sz; mat[9] *= sz; mat[10] *= sz;

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
    }

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

    firePortal(type) {
        const rb = this.playerMarble.rigidBody
        const pos = rb.translation()
        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)
        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        const rayOrigin = { x: pos.x, y: pos.y, z: pos.z }
        const rayDir = { x: dirX, y: dirY, z: dirZ }
        const ray = new RAPIER.Ray(rayOrigin, rayDir)

        // Ignore marble itself and dynamic objects
        const hit = this.world.castRay(ray, 100.0, true, 0xffffffff, undefined, undefined, undefined, rb)

        if (hit) {
            const hitPos = {
                x: rayOrigin.x + rayDir.x * hit.toi,
                y: rayOrigin.y + rayDir.y * hit.toi,
                z: rayOrigin.z + rayDir.z * hit.toi
            }

            // Simple normal approximation - assume the closest cardinal direction or just upright if Y is steep
            let normal = { x: 0, y: 1, z: 0 }

            // Check world wall normal logic (or just simple bounce direction based on hit position relative to collider center)
            const otherBody = hit.collider.parent()
            if (otherBody) {
               // To keep it simple without full hit normal extraction from Rapier3D JS:
               // We offset the portal slightly back towards the player along the ray
               // so it doesn't z-fight
            }

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

            const mat = quaternionToMat4(portalPos, rot)
            const sx = radius * 2;
            const sy = thickness * 2;
            const sz = radius * 2;

            mat[0] *= sx; mat[1] *= sx; mat[2] *= sx;
            mat[4] *= sy; mat[5] *= sy; mat[6] *= sy;
            mat[8] *= sz; mat[9] *= sz; mat[10] *= sz;

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

            if (type === 'A') {
                if (this.portalA) this.destroyPortal(this.portalA)
                this.portalA = newPortal
                document.getElementById('portal-a-status').style.color = indicatorColor
                document.getElementById('portal-a-status').textContent = '🔵'
            } else {
                if (this.portalB) this.destroyPortal(this.portalB)
                this.portalB = newPortal
                document.getElementById('portal-b-status').style.color = indicatorColor
                document.getElementById('portal-b-status').textContent = '🟠'
            }

            if (audio && audio.playTrick) audio.playTrick()
            console.log(`[GAME] Portal ${type} fired to`, portalPos)
        }
    }

    spawnJetpackExhaust(pos, linvel) {
        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        // Bright orange/yellow core
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 0.6, 0.0])
        matInstance.setFloatParameter('roughness', 0.8)

        const halfExtents = { x: 0.1, y: 0.1, z: 0.1 }

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .build(this.engine, entity)

        const tcm = this.engine.getTransformManager()
        const inst = tcm.getInstance(entity)
        const mat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 })

        const sx = halfExtents.x * 2;
        const sy = halfExtents.y * 2;
        const sz = halfExtents.z * 2;

        mat[0] *= sx; mat[1] *= sx; mat[2] *= sx;
        mat[4] *= sy; mat[5] *= sy; mat[6] *= sy;
        mat[8] *= sz; mat[9] *= sz; mat[10] *= sz;

        tcm.setTransform(inst, mat)
        this.scene.addEntity(entity)

        this.visualParticles.push({
            entity: entity,
            matInstance: matInstance,
            spawnTime: Date.now(),
            pos: { x: pos.x, y: pos.y, z: pos.z },
            vel: { x: -linvel.x * 0.1 + (Math.random() - 0.5) * 2, y: -linvel.y * 0.1 - 2.0, z: -linvel.z * 0.1 + (Math.random() - 0.5) * 2 },
            duration: 500, // ms
            scale: 1.0
        })
    }

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

    spawnHoloPlatform() {
        const now = Date.now()
        if (now - this.lastHoloTime < this.holoCooldown) return

        this.lastHoloTime = now
        const pos = this.playerMarble.rigidBody.translation()

        // Spawn platform slightly below the marble
        const spawnPos = { x: pos.x, y: pos.y - 1.2, z: pos.z }
        const halfExtents = { x: 3, y: 0.2, z: 3 }

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
        const body = this.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
            .setFriction(0.5)
            .setRestitution(0.3)
        this.world.createCollider(colliderDesc, body)

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 1.0])
        matInstance.setFloatParameter('roughness', 0.1)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .build(this.engine, entity)

        const tcm = this.engine.getTransformManager()
        const inst = tcm.getInstance(entity)
        const mat = quaternionToMat4(spawnPos, { x: 0, y: 0, z: 0, w: 1 })

        const sx = halfExtents.x * 2;
        const sy = halfExtents.y * 2;
        const sz = halfExtents.z * 2;

        mat[0] *= sx; mat[1] *= sx; mat[2] *= sx;
        mat[4] *= sy; mat[5] *= sy; mat[6] *= sy;
        mat[8] *= sz; mat[9] *= sz; mat[10] *= sz;

        tcm.setTransform(inst, mat)
        this.scene.addEntity(entity)

        this.temporaryPlatforms.push({
            entity: entity,
            rigidBody: body,
            matInstance: matInstance,
            spawnTime: now
        })
    }

}

export function applyAbilityMethods(targetClass) {
    for (const name of Object.getOwnPropertyNames(AbilityMethods.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = AbilityMethods.prototype[name];
        }
    }
}
