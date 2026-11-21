import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import type { EngineContext } from '../types/engine-context.ts';
import type { FrameState } from '../types/frame-host.ts';
import type { ActiveProjectile } from '../types/world-objects.ts';

/** Game members `AbilityBomb` uses. */
export type AbilityBombHost =
    & Pick<FrameState,
        | 'playerMarble' | 'lastBombTime' | 'bombCooldown' | 'activeBombs' | 'dynamicBodies'
        | 'marbles' | 'dynamicObjects'>
    & Pick<EngineContext, 'effectPool' | 'world'>;

export class AbilityBomb {
    declare game: AbilityBombHost;

    constructor(game: AbilityBombHost) {
        this.game = game;
    }

    spawnBomb(): void {
        const now = Date.now()
        if (now - this.game.lastBombTime < this.game.bombCooldown) return
        if (!this.game.effectPool?.budget.canSpawnProjectile('bomb')) return
        // Registry gating (`requiresMarble`) guarantees a player marble.
        const marble = this.game.playerMarble
        if (!marble) return

        const pos = marble.rigidBody.translation()
        const spawnPos = { x: pos.x, y: pos.y + 1.0, z: pos.z }

        const slot = this.game.effectPool.acquireProjectile('bomb', spawnPos)
        if (!slot) return
        this.game.lastBombTime = now

        const linvel = marble.rigidBody.linvel()

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
            .setLinvel(linvel.x * 0.5, linvel.y + 5.0, linvel.z * 0.5)
            .setCcdEnabled(true)

        const body = this.game.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.ball(0.4)
            .setRestitution(0.5)
            .setFriction(0.5)
            .setDensity(2.0)
        this.game.world.createCollider(colliderDesc, body)

        this.game.effectPool.bindProjectileLight(slot, body)

        this.game.activeBombs.push({
            entity: slot.entity,
            rigidBody: body,
            matInstance: slot.matInstance,
            lightEntity: slot.lightEntity,
            _poolSlot: slot,
            spawnTime: now,
            duration: 2500
        })
        this.game.dynamicBodies.add(body)
    }

    explodeBomb(bomb: Pick<ActiveProjectile, 'rigidBody'>): void {
        const pos = bomb.rigidBody.translation()
        if (audio.playAbility) audio.playAbility('bomb', { x: pos.x, y: pos.y, z: pos.z })

        const radius = 20.0
        const force = 120.0

        const applyExplosionForce = (body: RAPIER.RigidBody) => {
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

        for (const m of this.game.marbles) {
            applyExplosionForce(m.rigidBody)
        }

        for (const obj of this.game.dynamicObjects) {
            applyExplosionForce(obj.rigidBody)
        }
    }
}
