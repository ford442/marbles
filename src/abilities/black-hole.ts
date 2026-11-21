import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import type { AbilityHost } from '../game/systems/ability-system.ts';
import type { EngineContext } from '../types/engine-context.ts';
import type { FrameState } from '../types/frame-host.ts';

/** Game members `AbilityBlackHole` uses. */
export type AbilityBlackHoleHost =
    & Pick<FrameState,
        | 'playerMarble' | 'lastBlackHoleTime' | 'blackHoleCooldown' | 'pitchAngle' | 'aimYaw'
        | 'activeBlackHoles' | 'dynamicBodies'>
    & Pick<EngineContext, 'effectPool' | 'world'>
    & Pick<AbilityHost, 'hudManager'>;

export class AbilityBlackHole {
    declare game: AbilityBlackHoleHost;

    constructor(game: AbilityBlackHoleHost) {
        this.game = game;
    }

    spawnBlackHole(): void {
        const now = Date.now()
        if (now - this.game.lastBlackHoleTime < this.game.blackHoleCooldown) return
        if (!this.game.effectPool?.budget.canSpawnProjectile('blackHole')) return
        // Registry gating (`requiresMarble`) guarantees a player marble.
        const marble = this.game.playerMarble
        if (!marble) return

        const pos = marble.rigidBody.translation()
        const cosP = Math.cos(this.game.pitchAngle)
        const sinP = Math.sin(this.game.pitchAngle)

        const dirX = Math.sin(this.game.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.game.aimYaw) * cosP

        const spawnPos = {
            x: pos.x + dirX * 2.0,
            y: pos.y + dirY * 2.0,
            z: pos.z + dirZ * 2.0
        }

        const slot = this.game.effectPool.acquireProjectile('blackHole', spawnPos)
        if (!slot) return
        this.game.lastBlackHoleTime = now

        const moveSpeed = 5.0

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setLinvel(dirX * moveSpeed, dirY * moveSpeed, dirZ * moveSpeed)
            .setGravityScale(0)

        const body = this.game.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.ball(0.5)
            .setDensity(50.0)
        this.game.world.createCollider(colliderDesc, body)

        this.game.effectPool.bindProjectileLight(slot, body)

        this.game.activeBlackHoles.push({
            entity: slot.entity,
            rigidBody: body,
            matInstance: slot.matInstance,
            lightEntity: slot.lightEntity,
            _poolSlot: slot,
            spawnTime: now,
            duration: 8000
        })
        this.game.dynamicBodies.add(body)

        if (typeof audio !== 'undefined' && audio.playTrick) audio.playTrick()
        
        if (this.game.hudManager) this.game.hudManager.markAbilityUsed('blackhole')
    }
}
