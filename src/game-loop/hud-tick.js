// @ts-check
/** @typedef {import('../types/frame-host.ts').HudTickHost} HudTickHost */
import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import { quaternionToMat4, quatFromEuler } from '../math.ts';
import { getLevel } from '../levels/catalog.js';
import { getMarblePhysics, FORCE_BATCH_THRESHOLD, PhysicsBatchBuffers } from '../wasm-bridge.js';
import { getDofConfig } from '../rendering/post-fx-presets.js';
import {
    getCachedTransformInstance,
    transformChanged,
    scaledTransform,
    setColor3IfChanged,
    DOF_CAMERA_MODES,
    DOF_UPDATE_THRESHOLD,
} from './helpers.ts';

export class GameLoopHudTick {
    /** @param {HudTickHost} game */
    constructor(game) {
        this.game = game;
    }

    /**
     * @param {number} now
     * @param {boolean} shouldUpdateHUD
     */
    tickHudCooldownBars(now, shouldUpdateHUD) {
                if (this.game.abilitySystem) {
                    this.game.abilitySystem.tickHudBars(now, shouldUpdateHUD)
                }

                // Update Active Effects UI
                if (shouldUpdateHUD && this.game.activeEffectsEl) {
                    const active = []
                    for (const [type, endTime] of Object.entries(this.game.activeEffects)) {
                        if (endTime !== undefined && now < endTime) {
                            const timeLeft = Math.ceil((endTime - now) / 1000)
                            active.push(`${type.toUpperCase()}: ${timeLeft}s`)
                        } else {
                            delete this.game.activeEffects[type]
                        }
                    }
                    this.game.activeEffectsEl.textContent = active.join(' | ')
                }
        
                if (shouldUpdateHUD && this.game.sizebarContainerEl && this.game.sizebarEl) {
                    const timeSinceSizeShift = now - this.game.lastSizeShiftTime
                    if (timeSinceSizeShift < this.game.sizeShiftCooldown) {
                        this.game.sizebarContainerEl.style.display = 'block'
                        const pct = (timeSinceSizeShift / this.game.sizeShiftCooldown) * 100
                        this.game.sizebarEl.style.width = pct + '%'
                    } else {
                        this.game.sizebarEl.style.width = '100%'
                        this.game.sizebarContainerEl.style.display = 'none'
                    }
                }
        
                if (shouldUpdateHUD && this.game.chameleonBarContainerEl && this.game.chameleonBarEl) {
                    const timeSinceChameleon = now - this.game.lastChameleonTime
                    const color = this.game.chameleonProfiles[this.game.chameleonState]?.color ?? [1, 1, 1]
                    const rgb = `rgb(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255})`
                    if (timeSinceChameleon < this.game.chameleonCooldown) {
                        this.game.chameleonBarContainerEl.style.display = 'block'
                        const pct = (timeSinceChameleon / this.game.chameleonCooldown) * 100
                        this.game.chameleonBarEl.style.width = pct + '%'
                        this.game.chameleonBarEl.style.background = rgb
                    } else {
                        this.game.chameleonBarEl.style.width = '100%'
                        this.game.chameleonBarEl.style.background = rgb
                        this.game.chameleonBarContainerEl.style.display = 'none'
                    }
                }
        
        
                if (shouldUpdateHUD && this.game.teleportBarEl) {
                    const timeSinceTeleport = now - this.game.lastTeleportTime
                    const progress = Math.min(1.0, timeSinceTeleport / this.game.teleportCooldown)
                    this.game.teleportBarEl.style.width = `${progress * 100}%`
        
                    if (progress >= 1.0) {
                       this.game.teleportBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #cc00ff)'
                    } else {
                       this.game.teleportBarEl.style.filter = 'brightness(0.7)'
                    }
                }
        
                if (shouldUpdateHUD && this.game.gravityPulseBarContainerEl && this.game.gravityPulseBarEl) {
                    const timeSincePulse = now - this.game.lastGravityPulseTime
                    if (timeSincePulse < this.game.gravityPulseCooldown) {
                        this.game.gravityPulseBarContainerEl.style.display = 'block'
                        const pct = (timeSincePulse / this.game.gravityPulseCooldown) * 100
                        this.game.gravityPulseBarEl.style.width = pct + '%'
                    } else {
                        this.game.gravityPulseBarEl.style.width = '100%'
                        this.game.gravityPulseBarContainerEl.style.display = 'none'
                    }
                }
        
                if (shouldUpdateHUD && this.game.empBarEl) {
                    const timeSinceEMP = now - (this.game.lastEMPTime ?? 0)
                    const progress = Math.min(1.0, timeSinceEMP / this.game.empCooldown)
                    this.game.empBarEl.style.width = `${progress * 100}%`
        
                    if (progress >= 1.0) {
                       this.game.empBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #00ffff)'
                    } else {
                       this.game.empBarEl.style.filter = 'brightness(0.7)'
                    }
        
                    if (this.game.empBarContainerEl) {
                        this.game.empBarContainerEl.style.display = 'block'
                    }
                }
    }
}
