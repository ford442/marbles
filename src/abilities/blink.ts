import { audio } from '../audio.js';
import type { AbilityHost } from '../game/systems/ability-system.ts';
import type { InputSystemHost } from '../game/systems/input-system.ts';
import type { EngineContext } from '../types/engine-context.ts';
import type { FrameExtras, FrameState } from '../types/frame-host.ts';
import type { Vec3 } from '../types/geometry.ts';

/** Game members `AbilityBlink` uses. */
export type AbilityBlinkHost =
    & Pick<FrameState, 'playerMarble' | 'lastBlinkTime' | 'blinkCooldown' | 'pitchAngle' | 'aimYaw'>
    & Pick<EngineContext, 'effectPool'>
    & Pick<InputSystemHost, 'physicsQueries'>
    & Pick<FrameExtras, 'awardTrickPoints'>
    & Pick<AbilityHost, 'hudManager'>
    & Pick<AbilityBlink, 'spawnBlinkParticle'>;

export class AbilityBlink {
    declare game: AbilityBlinkHost;

    constructor(game: AbilityBlinkHost) {
        this.game = game;
    }

    triggerBlink(): void {
        if (!this.game.playerMarble) return
        const now = Date.now()
        if (now - this.game.lastBlinkTime < this.game.blinkCooldown) return
        this.game.lastBlinkTime = now

        const rb = this.game.playerMarble.rigidBody
        const pos = rb.translation()
        const cosP = Math.cos(this.game.pitchAngle)
        const sinP = Math.sin(this.game.pitchAngle)

        const dirX = Math.sin(this.game.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.game.aimYaw) * cosP

        const maxDist = 10.0
        const rayDir = { x: dirX, y: dirY, z: dirZ }

        let blinkDist = maxDist
        const hit = this.game.physicsQueries.castRay(pos, rayDir, maxDist, { excludeBody: rb })
        if (hit) {
            const radius = this.game.playerMarble.scale * 0.5 || 0.5
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
        this.game.spawnBlinkParticle(pos, color)
        // End particle
        this.game.spawnBlinkParticle(newPos, color)

        if (audio.playAbility) audio.playAbility('blink')

        if (typeof this.game.awardTrickPoints === 'function') {
             this.game.awardTrickPoints('Blink!', 15, '#ffcc00')
        }

        console.log(`[GAME] Blinked ${blinkDist.toFixed(2)} units to ${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)}, ${newPos.z.toFixed(2)}`)
        
        if (this.game.hudManager) this.game.hudManager.markAbilityUsed('blink')
    }

    spawnBlinkParticle(pos: Vec3, color: number[]): void {
        this.game.effectPool?.spawnVisualParticle({
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
