import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

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

        if (audio.playAbility) audio.playAbility('emp', pos)

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
        if (this.effectPool) {
            this.effectPool.spawnVisualParticle({
                color: [0.8, 0.4, 0.1],
                roughness: 0.9,
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

        if (audio.playAbility) audio.playAbility('emp', pos)
    }

    spawnEMPEffect(pos) {
        const now = Date.now()
        const duration = 1500
        const startRadius = this.playerMarble ? (this.playerMarble.scale * 0.5 || 0.5) : 0.5

        this.effectPool?.spawnVisualParticle({
            color: [0.0, 1.0, 1.0],
            roughness: 0.1,
            spawnTime: now,
            pos: { x: pos.x, y: pos.y, z: pos.z },
            duration,
            scale: 1.0,
            isEMPRing: true,
            startRadius,
            maxRadius: 50.0
        })

        const sparkCount = this.effectPool?.budget.getVisualBurstCount(12) ?? 12
        for (let i = 0; i < sparkCount; i++) {
            const angle = (i / sparkCount) * Math.PI * 2
            const sparkPos = {
                x: pos.x + Math.cos(angle) * 1.0,
                y: pos.y + (Math.random() - 0.5) * 0.5,
                z: pos.z + Math.sin(angle) * 1.0
            }
            this.spawnEMPSpark(sparkPos, angle, duration)
        }

        this.triggerEMPFlash()
    }

    spawnEMPSpark(pos, angle, parentDuration) {
        const speed = 20.0
        this.effectPool?.spawnVisualParticle({
            color: [0.2, 0.9, 1.0],
            roughness: 0.0,
            spawnTime: Date.now(),
            pos: { x: pos.x, y: pos.y, z: pos.z },
            vel: {
                x: Math.cos(angle) * speed,
                y: (Math.random() - 0.5) * 5,
                z: Math.sin(angle) * speed
            },
            duration: parentDuration * 0.8,
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
