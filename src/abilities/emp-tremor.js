import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import { quaternionToMat4 } from '../math.js';

export class AbilityEmpTremor {
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

        // Spawn EMP visual effect
        this.spawnEMPEffect(pos)

        console.log(`[GAME] EMP Shockwave fired! Hit ${hits} objects.`)
        
        if (this.hudManager) this.hudManager.markAbilityUsed('emp')
    }

    fireTremor() {
        if (!this.playerMarble) return
        const now = Date.now()
        if (now - this.lastTremorTime < this.tremorCooldown) return
        this.lastTremorTime = now

        const pos = this.playerMarble.rigidBody.translation()
        const tremorRadius = 25.0
        const tremorForce = 80.0

        let hits = 0
        const bodiesToCheck = [...(this.marbles || []), ...(this.dynamicObjects || []), ...(this.movingPlatforms || [])]

        for (const obj of bodiesToCheck) {
            if (obj === this.playerMarble) continue
            if (!obj.rigidBody) continue

            const objPos = obj.rigidBody.translation()
            const dx = objPos.x - pos.x
            const dy = objPos.y - pos.y
            const dz = objPos.z - pos.z
            const distSq = dx * dx + dy * dy + dz * dz

            if (distSq < tremorRadius * tremorRadius && distSq > 0.1) {
                const dist = Math.sqrt(distSq)
                const forceScale = 1.0 - (dist / tremorRadius)
                const nx = dx / dist
                const ny = dy / dist
                const nz = dz / dist

                hits++
                // Apply a disruptive upward and outward impulse
                obj.rigidBody.applyImpulse({
                    x: nx * tremorForce * forceScale,
                    y: (Math.abs(ny) + 1.0) * tremorForce * forceScale, // Give it a good vertical pop
                    z: nz * tremorForce * forceScale
                }, true)
            }
        }

        if (hits > 0 && typeof this.awardTrickPoints === 'function') {
            this.awardTrickPoints(`Ground Slam! (${hits} hit)`, 30 * hits, '#cd853f')
        }

        if (this.hudManager) this.hudManager.markAbilityUsed('groundslam')

        // Add a visual particle ring at the impact point
        if (this.Filament && this.engine && this.material) {
            const ringEntity = this.Filament.EntityManager.get().create()
            const ringMatInstance = this.material.createInstance()
            ringMatInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.8, 0.4, 0.1])
            ringMatInstance.setFloatParameter('roughness', 0.9)

            this.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [15, 0.5, 15] })
                .material(0, ringMatInstance)
                .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
                .receiveShadows(false)
                .castShadows(false)
                .build(this.engine, ringEntity)

            this.scene.addEntity(ringEntity)

            this.visualParticles.push({
                entity: ringEntity,
                matInstance: ringMatInstance,
                spawnTime: Date.now(),
                pos: { x: pos.x, y: pos.y, z: pos.z },
                vel: { x: 0, y: 0, z: 0 },
                duration: 1200,
                scale: 1.0,
                isCheckpointRing: true,
                startRadius: 1.0,
                maxRadius: 15.0
            })
        }

        // Trigger camera shake
        this.tremorShakeTimer = 30

        if (typeof audio !== 'undefined' && audio.playStomp) {
            audio.playStomp()
        }
    }

    spawnEMPEffect(pos) {
        const now = Date.now()
        const duration = 1500 // 1.5 seconds

        // Create main shockwave ring
        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        
        // Electric cyan color for EMP
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 1.0])
        matInstance.setFloatParameter('roughness', 0.1)

        // Use a flattened sphere for the ring (disk shape)
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [25, 0.5, 25] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
            .receiveShadows(false)
            .castShadows(false)
            .build(this.engine, entity)

        const tcm = this.engine.getTransformManager()
        const inst = tcm.getInstance(entity)
        const mat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 })

        // Start small - marble radius scale
        const startRadius = this.playerMarble ? (this.playerMarble.scale * 0.5 || 0.5) : 0.5
        mat[0] *= startRadius; mat[1] *= startRadius; mat[2] *= startRadius
        mat[4] *= 0.05; mat[5] *= 0.05; mat[6] *= 0.05  // Very thin vertically
        mat[8] *= startRadius; mat[9] *= startRadius; mat[10] *= startRadius

        tcm.setTransform(inst, mat)
        this.scene.addEntity(entity)

        // Add to visual particles with EMP-specific properties
        this.visualParticles.push({
            entity: entity,
            matInstance: matInstance,
            spawnTime: now,
            pos: { x: pos.x, y: pos.y, z: pos.z },
            duration: duration,
            scale: 1.0,
            isEMPRing: true,  // Special flag for EMP effect
            startRadius: startRadius,
            maxRadius: 50.0   // Expand to 50 units
        })

        // Spawn electric spark particles around the ring
        const sparkCount = 12
        for (let i = 0; i < sparkCount; i++) {
            const angle = (i / sparkCount) * Math.PI * 2
            const sparkPos = {
                x: pos.x + Math.cos(angle) * 1.0,
                y: pos.y + (Math.random() - 0.5) * 0.5,
                z: pos.z + Math.sin(angle) * 1.0
            }
            this.spawnEMPSpark(sparkPos, angle, duration)
        }

        // Trigger screen flash
        this.triggerEMPFlash()
    }

    spawnEMPSpark(pos, angle, parentDuration) {
        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        
        // Bright electric blue/cyan
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.2, 0.9, 1.0])
        matInstance.setFloatParameter('roughness', 0.0)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.3, 0.3, 0.3] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.sphereVb, this.sphereIb)
            .receiveShadows(false)
            .castShadows(false)
            .build(this.engine, entity)

        const tcm = this.engine.getTransformManager()
        const inst = tcm.getInstance(entity)
        const mat = quaternionToMat4(pos, { x: 0, y: 0, z: 0, w: 1 })

        const s = 0.2
        mat[0] *= s; mat[1] *= s; mat[2] *= s
        mat[4] *= s; mat[5] *= s; mat[6] *= s
        mat[8] *= s; mat[9] *= s; mat[10] *= s

        tcm.setTransform(inst, mat)
        this.scene.addEntity(entity)

        // Spark velocity - radial outward from center
        const speed = 20.0
        this.visualParticles.push({
            entity: entity,
            matInstance: matInstance,
            spawnTime: Date.now(),
            pos: { x: pos.x, y: pos.y, z: pos.z },
            vel: {
                x: Math.cos(angle) * speed,
                y: (Math.random() - 0.5) * 5,
                z: Math.sin(angle) * speed
            },
            duration: parentDuration * 0.8, // Slightly shorter than main ring
            scale: 1.0,
            isEMPSpark: true
        })
    }

    triggerEMPFlash() {
        // Create or get the flash overlay element
        let flashOverlay = document.getElementById('emp-flash-overlay')
        if (!flashOverlay) {
            flashOverlay = document.createElement('div')
            flashOverlay.id = 'emp-flash-overlay'
            flashOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: radial-gradient(circle, rgba(200, 255, 255, 0.8) 0%, rgba(0, 255, 255, 0.3) 40%, transparent 70%);
                pointer-events: none;
                z-index: 50;
                opacity: 0;
                transition: opacity 0.1s ease-out;
            `
            document.body.appendChild(flashOverlay)
        }

        // Trigger the flash
        flashOverlay.style.opacity = '1'
        
        // Fade out quickly
        setTimeout(() => {
            flashOverlay.style.transition = 'opacity 0.4s ease-out'
            flashOverlay.style.opacity = '0'
        }, 100)

        // Reset transition after animation completes
        setTimeout(() => {
            flashOverlay.style.transition = 'opacity 0.1s ease-out'
        }, 500)
    }
}

export function applyAbilityEmpTremor(targetClass) {
    for (const name of Object.getOwnPropertyNames(AbilityEmpTremor.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = AbilityEmpTremor.prototype[name];
        }
    }
}
