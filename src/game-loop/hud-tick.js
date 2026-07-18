import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import { quaternionToMat4, quatFromEuler } from '../math.js';
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
} from './helpers.js';

export class GameLoopHudTick {
    tickHudCooldownBars(now, shouldUpdateHUD) {
                if (this.abilitySystem) {
                    this.abilitySystem.tickHudBars(now, shouldUpdateHUD)
                }

                // Update Active Effects UI
                if (shouldUpdateHUD && this.activeEffectsEl) {
                    const active = []
                    for (const [type, endTime] of Object.entries(this.activeEffects)) {
                        if (now < endTime) {
                            const timeLeft = Math.ceil((endTime - now) / 1000)
                            active.push(`${type.toUpperCase()}: ${timeLeft}s`)
                        } else {
                            delete this.activeEffects[type]
                        }
                    }
                    this.activeEffectsEl.textContent = active.join(' | ')
                }
        
                if (shouldUpdateHUD && this.sizebarContainerEl && this.sizebarEl) {
                    const timeSinceSizeShift = now - this.lastSizeShiftTime
                    if (timeSinceSizeShift < this.sizeShiftCooldown) {
                        this.sizebarContainerEl.style.display = 'block'
                        const pct = (timeSinceSizeShift / this.sizeShiftCooldown) * 100
                        this.sizebarEl.style.width = pct + '%'
                    } else {
                        this.sizebarEl.style.width = '100%'
                        this.sizebarContainerEl.style.display = 'none'
                    }
                }
        
                if (shouldUpdateHUD && this.chameleonBarContainerEl && this.chameleonBarEl) {
                    const timeSinceChameleon = now - this.lastChameleonTime
                    const profile = this.chameleonProfiles[this.chameleonState]
                    if (timeSinceChameleon < this.chameleonCooldown) {
                        this.chameleonBarContainerEl.style.display = 'block'
                        const pct = (timeSinceChameleon / this.chameleonCooldown) * 100
                        this.chameleonBarEl.style.width = pct + '%'
                        this.chameleonBarEl.style.background = `rgb(${profile.color[0]*255}, ${profile.color[1]*255}, ${profile.color[2]*255})`
                    } else {
                        this.chameleonBarEl.style.width = '100%'
                        this.chameleonBarEl.style.background = `rgb(${profile.color[0]*255}, ${profile.color[1]*255}, ${profile.color[2]*255})`
                        this.chameleonBarContainerEl.style.display = 'none'
                    }
                }
        
        
                if (shouldUpdateHUD && this.teleportBarEl) {
                    const timeSinceTeleport = now - this.lastTeleportTime
                    const progress = Math.min(1.0, timeSinceTeleport / this.teleportCooldown)
                    this.teleportBarEl.style.width = `${progress * 100}%`
        
                    if (progress >= 1.0) {
                       this.teleportBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #cc00ff)'
                    } else {
                       this.teleportBarEl.style.filter = 'brightness(0.7)'
                    }
                }
        
                if (shouldUpdateHUD && this.gravityPulseBarContainerEl && this.gravityPulseBarEl) {
                    const timeSincePulse = now - this.lastGravityPulseTime
                    if (timeSincePulse < this.gravityPulseCooldown) {
                        this.gravityPulseBarContainerEl.style.display = 'block'
                        const pct = (timeSincePulse / this.gravityPulseCooldown) * 100
                        this.gravityPulseBarEl.style.width = pct + '%'
                    } else {
                        this.gravityPulseBarEl.style.width = '100%'
                        this.gravityPulseBarContainerEl.style.display = 'none'
                    }
                }
        
                if (shouldUpdateHUD && this.empBarEl) {
                    const timeSinceEMP = now - this.lastEMPTime
                    const progress = Math.min(1.0, timeSinceEMP / this.empCooldown)
                    this.empBarEl.style.width = `${progress * 100}%`
        
                    if (progress >= 1.0) {
                       this.empBarEl.style.filter = 'brightness(1.2) drop-shadow(0 0 5px #00ffff)'
                    } else {
                       this.empBarEl.style.filter = 'brightness(0.7)'
                    }
        
                    if (this.empBarContainerEl) {
                        this.empBarContainerEl.style.display = 'block'
                    }
                }
    }
}

export function applyGameLoopHudTick(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopHudTick.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopHudTick.prototype[name];
        }
    }
}
