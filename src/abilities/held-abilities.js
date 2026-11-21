// @ts-check
/**
 * Effects for the abilities that used to be hard-coded key branches in
 * init/core.ts (time stop, size shift, chameleon, gravity flip, rewind). The
 * registry entries in registry.js call these; cooldown gating happens in
 * AbilitySystem before they run.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';

/** @param {import('./hook-host.ts').GravityFlipHost} game */
export function toggleGravityFlip(game) {
    game.flipActive = !game.flipActive
    // Registry gating (`requiresMarble`) guarantees a player marble.
    const marble = game.playerMarble
    if (!marble) return
    const rb = marble.rigidBody
    rb.setGravityScale(game.flipActive ? -marble.baseGravityScale : marble.baseGravityScale, true)
    if (game.hudManager) game.hudManager.markAbilityUsed('flip')
}

/** @param {import('./hook-host.ts').TimeStopHost} game */
export function toggleTimeStop(game) {
    game.timeStopActive = !game.timeStopActive
    if (game.timeStopActive) {
        if (audio && audio.playTrick) audio.playTrick()
        game.showTrickMessage('TIME STOP!', '#ffffff')
        if (game.hudManager) game.hudManager.markAbilityUsed('timestop')
        return
    }
    // Restore velocities immediately
    const playerRb = game.playerMarble?.rigidBody
    for (const body of game.dynamicBodies) {
        if (body !== playerRb) {
            const state = game.timeStopSavedStates.get(body.handle)
            if (state !== undefined) {
                body.setLinvel(state.linvel, true)
                body.setAngvel(state.angvel, true)
                game.timeStopSavedStates.delete(body.handle)
            }
            body.setGravityScale(1.0, true)
        }
    }
    game.timeStopSavedStates.clear()
}

const SIZE_PROFILES = [
    { name: 'Normal', scale: 1.0 },
    { name: 'Mini', scale: 0.5 },
    { name: 'Giant', scale: 2.0 },
]

/** Cycle Normal → Mini → Giant by rebuilding the marble's ball collider. @param {import('./hook-host.ts').SizeShiftHost} game */
export function cycleSizeShift(game) {
    const marble = game.playerMarble
    game.lastSizeShiftTime = Date.now()
    // Registry gating (`requiresMarble`) guarantees a player marble.
    if (!marble) return
    marble.sizeState = ((marble.sizeState || 0) + 1) % 3
    const sizeProfile = SIZE_PROFILES[marble.sizeState] ?? SIZE_PROFILES[0]
    if (!sizeProfile) return

    const rb = marble.rigidBody
    if (marble.collider) {
        game.world.removeCollider(marble.collider, true)
    }

    const newRadius = (marble.baseRadius || 0.5) * sizeProfile.scale
    const desc = RAPIER.ColliderDesc.ball(newRadius)
        .setRestitution(marble.baseRestitution !== undefined ? marble.baseRestitution : 0.5)
        .setFriction(marble.baseFriction !== undefined ? marble.baseFriction : 0.5)
    if (marble.baseDensity) {
        desc.setDensity(marble.baseDensity)
    }

    marble.collider = game.world.createCollider(desc, rb)
    marble.scale = sizeProfile.scale * (marble.baseScale || 1.0)

    if (sizeProfile.scale > 1.0) {
        const pos = rb.translation()
        rb.setTranslation({ x: pos.x, y: pos.y + newRadius, z: pos.z }, true)
    }

    game.showTrickMessage(`Size: ${sizeProfile.name}`, '#ffff00')
    if (audio && audio.playCollect) audio.playCollect()
}

/** Cycle the chameleon gravity/colour profile. @param {import('./hook-host.ts').ChameleonHost} game */
export function cycleChameleon(game) {
    game.chameleonState = (game.chameleonState + 1) % game.chameleonProfiles.length
    const profile = game.chameleonProfiles[game.chameleonState]
    // Registry gating (`requiresMarble`) guarantees a player marble; profiles are never empty.
    const marble = game.playerMarble
    if (!profile || !marble) return

    marble.baseGravityScale = profile.gravityScale
    marble.rigidBody.setGravityScale(game.flipActive ? -profile.gravityScale : profile.gravityScale, true)

    marble.color = profile.color
    const rcm = game.engine.getRenderableManager()
    const inst = rcm.getInstance(marble.entity)
    rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', game.Filament.RgbType.sRGB, profile.color)

    game.lastChameleonTime = Date.now()
    game.showTrickMessage(`Chameleon: ${profile.name}`, `rgb(${profile.color[0] * 255}, ${profile.color[1] * 255}, ${profile.color[2] * 255})`)
    if (audio && audio.playCollect) audio.playCollect()
    if (game.hudManager) game.hudManager.markAbilityUsed('chameleon')
}

/** Stop rewinding and restore the marble's own colour. @param {import('./hook-host.ts').EndRewindHost} game */
export function endRewind(game) {
    game.isRewinding = false
    if (!game.playerMarble) return
    game.playerMarble.rigidBody.wakeUp()
    if (game.playerMarble.color) {
        const rcm = game.engine.getRenderableManager()
        const inst = rcm.getInstance(game.playerMarble.entity)
        rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', game.Filament.RgbType.sRGB, game.playerMarble.color)
    }
}

/**
 * Factory for the simple held abilities: press sets `flag`, release clears it.
 * @param {import('./hook-host.ts').HeldFlagKey} flag  game field toggled while held
 * @param {string} [hudId]  HUD icon to mark as used on press
 */
export function heldFlag(flag, hudId) {
    return {
        /** @param {import('../game/systems/ability-system.ts').AbilitySystemHost} host */
        press(host) {
            const game = host
            game[flag] = true
            if (hudId && game.hudManager) game.hudManager.markAbilityUsed(hudId)
        },
        /** @param {import('../game/systems/ability-system.ts').AbilitySystemHost} host */
        release(host) {
            host[flag] = false
        },
    }
}
