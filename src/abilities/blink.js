// @ts-check
import { audio } from '../audio.js';

/** @typedef {import('../types/mixin-host.ts').GameMixinHost} GameMixinHost */

export class AbilityBlink {
    /** @this {GameMixinHost} */
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
        const rayDir = { x: dirX, y: dirY, z: dirZ }

        let blinkDist = maxDist
        const hit = this.physicsQueries.castRay(pos, rayDir, maxDist, { excludeBody: rb })
        if (hit) {
            const radius = this.playerMarble.scale * 0.5 || 0.5
            blinkDist = Math.max(0, hit.toi - radius - 0.1)
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

        if (audio.playAbility) audio.playAbility('blink')

        if (typeof this.awardTrickPoints === 'function') {
             this.awardTrickPoints('Blink!', 15, '#ffcc00')
        }

        console.log(`[GAME] Blinked ${blinkDist.toFixed(2)} units to ${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}, ${newPos.z.toFixed(2)}`)
        
        if (this.hudManager) this.hudManager.markAbilityUsed('blink')
    }

    /**
     * @this {GameMixinHost}
     * @param {{ x: number, y: number, z: number }} pos
     * @param {number[]} color
     */
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
