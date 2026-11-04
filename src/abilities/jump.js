// @ts-check
/**
 * Jump (registry `jump`, held on Space): press starts a ground charge, or —
 * airborne — launches off a wall or fires the double jump; release spends the
 * charge. Moved verbatim from the init/core.js key handlers.
 */
import { audio } from '../audio.js';
import { applyVelocityChange } from '../game/systems/body-impulse.ts';
import { JUMP_DV_MAX, JUMP_DV_MIN, WALL_LAUNCH_DV } from './movement-tuning.js';

/** @param {any} game */
export function pressJump(game) {
    if (!game.playerMarble) return
    if (game.isGrounded(game.playerMarble)) {
        game.isChargingJump = true
        game.jumpCharge = 0
        game.hasDoubleJumped = false
        return
    }
    const wallContact = game.getWallContact(game.playerMarble)
    if (wallContact) {
        const rb = game.playerMarble.rigidBody
        const linvel = rb.linvel()
        rb.setLinvel({ x: linvel.x, y: 0, z: linvel.z }, true)

        const gravityDir = rb.gravityScale() < 0 ? -1 : 1
        const { up, push, forward } = WALL_LAUNCH_DV
        const forwardX = Math.sin(game.aimYaw)
        const forwardZ = Math.cos(game.aimYaw)

        applyVelocityChange(rb, {
            x: wallContact.normal.x * push + forwardX * forward,
            y: up * gravityDir,
            z: wallContact.normal.z * push + forwardZ * forward,
        })

        game.jumpCount = 1
        game.hasDoubleJumped = false
        audio.playJump()
        if (typeof game.awardTrickPoints === 'function') game.awardTrickPoints('Wall Launch!', 75, '#ff00ff')
    } else if (!game.hasDoubleJumped && game.abilitySystem?.isEnabled('doublejump')) {
        if (typeof game.executeDoubleJump === 'function') {
            game.executeDoubleJump()
        }
        // Visual effect for double jump (burst particle)
        if (game.particleSystem && game.particleSystem.createEmitter) {
            game.particleSystem.createEmitter(
                game.playerMarble.rigidBody.translation(),
                { r: 0, g: 1, b: 1, a: 1 }, // Cyan burst
                0.5,
            )
        }
    }
}

/** @param {any} game */
export function releaseJump(game) {
    if (game.isChargingJump && game.playerMarble) {
        let dv = JUMP_DV_MIN + game.jumpCharge * (JUMP_DV_MAX - JUMP_DV_MIN)
        if (game.activeEffects.jump && Date.now() < game.activeEffects.jump) {
            dv *= 2.0
        }
        const rb = game.playerMarble.rigidBody
        const gravityDir = rb.gravityScale() < 0 ? -1 : 1
        applyVelocityChange(rb, { x: 0, y: dv * gravityDir, z: 0 })
        audio.playJump()
        game.jumpCount = 1
        if (game.multiplayerMode && game.network?.room) {
            game.network.sendAbility('jump', game.jumpCharge)
        }
    }
    game.isChargingJump = false
    game.jumpCharge = 0
    if (game.jumpBarEl) game.jumpBarEl.style.width = '0%'
}
