import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from '../audio.js';
import { quaternionToMat4, quatFromEuler } from '../math.js';
import { LEVELS } from '../levels.js';
import { getMarblePhysics } from '../wasm-bridge.js';
import { getDofConfig } from '../rendering/post-fx-presets.js';

import { applyGameLoopInput } from './input.js';
import { applyGameLoopCamera } from './camera.js';
import { applyGameLoopHUD } from './hud.js';
import { applyGameLoopAbilities } from './abilities.js';

export class GameLoopRenderCore {
    renderAndSync() {
        const now = Date.now()
        const INITIAL_FRAME_DELTA_SEC = 1 / 60
        const frameDeltaSec = this._lastRenderTick ? (now - this._lastRenderTick) / 1000 : INITIAL_FRAME_DELTA_SEC
        this._lastRenderTick = now

        // Input
        this.handleInput(now, frameDeltaSec);

        // Camera
        this.updateCamera(now, frameDeltaSec);

        // HUD
        this.updateHUD(now, frameDeltaSec);

        if (this.timeStopActive) {
            if (!this.lastTimeStopSavedTime) {
                this.lastTimeStopSavedTime = now;
            }
        } else {
            if (this.lastTimeStopSavedTime) {
                this.levelStartTime += (now - this.lastTimeStopSavedTime);
                this.lastTimeStopSavedTime = null;
            }
        }

        // --- Kinematic Movement Updates ---
        for (const p of this.movingPlatforms) {
            if (!this.timeStopActive) {
                const time = (now - this.levelStartTime) / 1000
                const offset = Math.sin(time * p.speed) * p.amplitude

                let nx = p.initialPos.x
                let ny = p.initialPos.y
                let nz = p.initialPos.z

                if (p.axis === 'x') nx += offset
                else if (p.axis === 'y') ny += offset
                else if (p.axis === 'z') nz += offset

                p.rigidBody.setNextKinematicTranslation({ x: nx, y: ny, z: nz })

                // --- NEW: Sync visual entity ---
                if (p.entity) {
                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4({ x: nx, y: ny, z: nz }, p.rigidBody.rotation())
                    tcm.setTransform(inst, mat)
                }
            }
        }

        for (const p of this.rotatingPlatforms) {
            if (!this.timeStopActive) {
                const time = (now - this.levelStartTime) / 1000
                const angle = time * p.speed

                let q = { x: 0, y: 0, z: 0, w: 1 }
                if (p.axis === 'x') q = quatFromEuler(angle, 0, 0)
                else if (p.axis === 'y') q = quatFromEuler(0, angle, 0)
                else if (p.axis === 'z') q = quatFromEuler(0, 0, angle)

                p.rigidBody.setNextKinematicRotation(q)

                // --- NEW: Sync visual entity ---
                if (p.entity) {
                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4(p.rigidBody.translation(), q)
                    tcm.setTransform(inst, mat)
                }
            }
        }

        // --- Kinematic Power-Up Spin Updates ---
        for (const p of this.powerUps) {
            if (!this.timeStopActive) {
                const time = (now - this.levelStartTime) / 1000
                const angle = time * 2.0 // fixed spin speed
                const q = quatFromEuler(0, angle, 0)

                p.rigidBody.setNextKinematicRotation(q)

                // Visual sync
                if (p.entity) {
                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4(p.rigidBody.translation(), q)
                    tcm.setTransform(inst, mat)
                }
            }
        }

        if (!this.timeStopActive) {
            this.updateGrapple()
        }

        if (this.collectibles && this.collectibles.length > 0) {
            for (let i = this.collectibles.length - 1; i >= 0; i--) {
                const c = this.collectibles[i]
                
                const time = now / 1000
                const hoverY = Math.sin(time * 3 + i) * 0.2
                const tcm = this.engine.getTransformManager()
                const inst = tcm.getInstance(c.entity)

                const rotY = time * 2
                const q = quatFromEuler(0, rotY, 0)
                const mat = quaternionToMat4({ x: c.pos.x, y: c.pos.y + hoverY, z: c.pos.z }, q)
                tcm.setTransform(inst, mat)

                if (this.playerMarble) {
                    const playerPos = this.playerMarble.rigidBody.translation()
                    const dx = playerPos.x - c.pos.x
                    const dy = playerPos.y - c.pos.y
                    const dz = playerPos.z - c.pos.z
                    const distSq = dx*dx + dy*dy + dz*dz

                    if (distSq < 2.25) { // ~1.5 radius
                        this.score += c.value

                        this.combo++
                        this.lastComboTime = now
                        if (this.comboEl) {
                            this.comboEl.textContent = `${this.combo}x COMBO!`
                            this.comboEl.style.transform = `scale(${1 + this.combo * 0.1})`
                            this.comboEl.style.color = `hsl(${this.combo * 30}, 100%, 50%)`
                            setTimeout(() => {
                                if (this.comboEl) this.comboEl.style.transform = 'scale(1)'
                            }, 100)
                        }

                        if (typeof this.triggerCollectionEffect === 'function') {
                            this.triggerCollectionEffect(c.pos, c.color)
                        }

                        this.scene.removeEntity(c.entity)
                        this.Filament.EntityManager.get().destroy(c.entity)
                        this.collectibles.splice(i, 1)
                        if (audio && audio.playCollect) audio.playCollect()
                    }
                }
            }
        }

        const comboTimeElapsed = now - this.lastComboTime
        if (this.adrenaline && this.adrenaline > 80) {
            this.maxComboTime = 4000 // Extended combo window
        } else {
            this.maxComboTime = 2000
        }
        if (comboTimeElapsed > this.maxComboTime && this.combo > 1) {
            this.combo = 1
            if (this.comboEl) {
                this.comboEl.textContent = ''
                this.comboEl.style.transform = 'scale(1)'
            }
        }

        // Abilities
        this.updateAbilities(now, frameDeltaSec);

        // Update consolidated HUD
        if (this.hudManager) {
            this.hudManager.updateAllAbilities()
        }

        // Update goal zone effects
        if (this.playerMarble) {
            const playerPos = this.playerMarble.rigidBody.translation()
            this.updateGoalEffects(0.016, playerPos)
        }

        this.syncTransformsAndRender(now)
    }
}

export function applyGameLoopRenderCore(targetClass) {
    applyGameLoopInput(targetClass);
    applyGameLoopCamera(targetClass);
    applyGameLoopHUD(targetClass);
    applyGameLoopAbilities(targetClass);
    for (const name of Object.getOwnPropertyNames(GameLoopRenderCore.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopRenderCore.prototype[name];
        }
    }
}
