import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

export class AbilityBlink {
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
        
        if (this.hudManager) this.hudManager.markAbilityUsed('blink')
    }

    spawnBlinkParticle(pos, color) {
        this.effectPool?.spawnVisualParticle({
            color,
            roughness: 0.1,
            spawnTime: Date.now(),
            pos: { x: pos.x, y: pos.y, z: pos.z },
            vel: { x: 0, y: 0.5, z: 0 },
            duration: 300,
            scale: 1.0,
        })
    }
}

export function applyAbilityBlink(targetClass) {
    for (const name of Object.getOwnPropertyNames(AbilityBlink.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = AbilityBlink.prototype[name];
        }
    }
}
