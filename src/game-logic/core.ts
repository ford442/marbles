import { audio } from '../audio.js';
import { getLevel } from '../levels/catalog.js';
import { computeMarbleDopplerRate } from '../game/systems/marble-registry.js';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { CampaignProgress } from '../game/systems/campaign-progress.ts';
import type { InputSystem } from '../game/systems/input-system.ts';
import type { MarbleRegistry } from '../game/systems/marble-registry.js';
import type { EngineContext } from '../types/engine-context.ts';
import type { FrameExtras, FrameState } from '../types/frame-host.ts';
import type { ZoneVisuals } from '../zones/methods/visuals.ts';
import type { GameLogicCheckpoints } from './checkpoints.ts';
import type { GameLogicLevelComplete } from './level-complete.ts';
import type { GameLogicTricks } from './tricks.ts';

/** Per-frame counters `checkGameLogic` creates on first use. */
export interface GameLogicCoreScratch {
    /** Consecutive frames above the "Speed Demon" speed. */
    highSpeedTime?: number;
    lastSpeedAwardTime?: number;
    lastWallBounceTime?: number;
}

/** What `GameLogicCore` uses on the game. */
export type GameLogicCoreHost =
    & GameLogicCoreScratch
    & Pick<EngineContext, 'world' | 'scene' | 'engine'>
    & Pick<FrameState,
        | 'currentLevel' | 'levelComplete' | 'levelStartTime' | 'goalDefinitions' | 'goalEffects'
        | 'playerMarble' | 'marbles' | 'currentMarbleIndex' | 'jumpCount' | 'aimYaw' | 'keys'
        | 'trickState' | 'isStomping' | 'stompReleaseTime' | 'stompChargeTime' | 'stompStartAltitude'
        | 'isWallRiding' | 'wallRideTime' | 'currentWallNormal' | 'nearMisses'
        | 'dynamicObjects' | 'movingPlatforms' | 'rotatingPlatforms' | 'checkpoints' | 'powerUps'
        | 'activeEffects' | '_rewindHead' | '_rewindCount' | '_cameraState'
        | 'combo' | 'comboTimer' | 'comboEl' | 'combobarContainerEl' | 'score' | 'scoreEl'>
    & Pick<FrameExtras, 'ghostReplay' | 'collectiblesCollected' | 'isGrounded'>
    & Pick<InputSystem, 'getWallContact'>
    & Pick<MarbleRegistry, 'resetPlayerAbilityState'>
    & Pick<ZoneVisuals, 'triggerGoalCompletionEffect'>
    & Pick<GameLogicTricks, 'awardTrickPoints' | 'spawnDriftSparks' | 'performStompImpact'>
    & Pick<GameLogicCheckpoints, 'activateCheckpoint'>
    & Pick<GameLogicLevelComplete, 'showLevelCompleteModal'>
    & { campaignProgress?: CampaignProgress | null };

export class GameLogicCore {
    declare game: GameLogicCoreHost;

    constructor(game: GameLogicCoreHost) {
        this.game = game;
    }

    checkGameLogic(): void {
        if (!this.game.currentLevel || this.game.levelComplete) return

        let horizSpeed = 0
        if (this.game.playerMarble) {
            const linvel = this.game.playerMarble.rigidBody.linvel()
            horizSpeed = Math.hypot(linvel.x, linvel.z)

            if (this.game.highSpeedTime === undefined) this.game.highSpeedTime = 0
            if (this.game.lastSpeedAwardTime === undefined) this.game.lastSpeedAwardTime = 0

            if (horizSpeed > 15.0) {
                this.game.highSpeedTime += 1
            } else {
                this.game.highSpeedTime = 0
            }

            if (this.game.highSpeedTime > 120) {
                const now = Date.now()
                if (now - this.game.lastSpeedAwardTime > 2000) {
                    this.game.awardTrickPoints('Speed Demon!', 30, '#ff4444')
                    this.game.lastSpeedAwardTime = now
                    this.game.highSpeedTime = 0
                }
            }
        }

        if (this.game.playerMarble && this.game.isGrounded(this.game.playerMarble)) {
            const linvel = this.game.playerMarble.rigidBody.linvel()
            const gravityDir = this.game.playerMarble.rigidBody.gravityScale() < 0 ? -1 : 1

            if ((gravityDir > 0 && linvel.y <= 0.1) || (gravityDir < 0 && linvel.y >= -0.1)) {
                this.game.jumpCount = 0
            }

            const radius = this.game.playerMarble.scale * 0.5 || 0.5
            const angvel = this.game.playerMarble.rigidBody.angvel()
            const slideVx = linvel.x + angvel.z * radius
            const slideVz = linvel.z - angvel.x * radius
            const slideSpeed = Math.hypot(slideVx, slideVz)

            if (this.game.trickState.driftTime === undefined) this.game.trickState.driftTime = 0

            if (slideSpeed > 10.0 && horizSpeed > 10.0) {
                this.game.trickState.driftTime += 1
                if (this.game.trickState.driftTime % 3 === 0) {
                    const pos = this.game.playerMarble.rigidBody.translation()
                    const sparkPos = { x: pos.x, y: pos.y - radius, z: pos.z }
                    this.game.spawnDriftSparks(sparkPos)
                }
            } else {
                if (this.game.trickState.driftTime > 30) {
                    const points = Math.floor(this.game.trickState.driftTime * 2)
                    this.game.awardTrickPoints('Drift King!', points, '#ffff00')
                }
                this.game.trickState.driftTime = 0
            }

            if (this.game.trickState.airTime > 30 || this.game.trickState.wallRides > 0 || this.game.trickState.wallBounces > 0) {
                let points = Math.floor(this.game.trickState.airTime * 2)
                const messages = []

                // 1 full rotation = approx 2*PI radians. We check accumulated radians rotated.
                const totalFlips = Math.floor(Math.abs(this.game.trickState.flips) / (Math.PI * 2))
                const totalRolls = Math.floor(Math.abs(this.game.trickState.rolls) / (Math.PI * 2))

                if (totalFlips > 0) {
                    points += totalFlips * 100
                    messages.push(totalFlips > 1 ? `x${totalFlips} Flip` : (this.game.trickState.flips > 0 ? 'Front Flip' : 'Back Flip'))
                }

                if (totalRolls > 0) {
                    points += totalRolls * 100
                    messages.push(totalRolls > 1 ? `x${totalRolls} Roll` : 'Barrel Roll')
                }

                // Spin bonus logic: total accumulated rotation magnitude in radians
                if (totalFlips === 0 && totalRolls === 0 && this.game.trickState.spin > (Math.PI * 2)) {
                    const totalSpins = Math.floor(this.game.trickState.spin / (Math.PI * 2))
                    points += totalSpins * 50
                    messages.push(totalSpins > 1 ? `x${totalSpins} Spin` : 'Spin')
                } else if (this.game.trickState.spin > Math.PI) { // At least half a rotation of combined spin
                    points += Math.floor(this.game.trickState.spin * 10)
                }

                let verticalDistance = 0;
                if (this.game.trickState.maxAltitude !== undefined && this.game.trickState.startAltitude !== undefined) {
                     verticalDistance = this.game.trickState.maxAltitude - this.game.trickState.startAltitude;
                }

                if (verticalDistance > 15.0 && this.game.trickState.airTime > 60) {
                    points += 100;
                    messages.push('Sky High!');
                }

                if (this.game.trickState.airTime > 150) {
                    points += 150;
                    messages.push('Orbital Hang Time!');
                } else if (this.game.trickState.airTime > 90) {
                    points += 50
                    messages.push('Hang Time')
                } else if (this.game.trickState.airTime > 60) {
                    messages.push('Big Air')
                } else if (messages.length === 0) {
                    messages.push('Air Time')
                }

                if (this.game.trickState.wallRides > 0) {
                    points += this.game.trickState.wallRides * 150
                    messages.push(this.game.trickState.wallRides > 1 ? `x${this.game.trickState.wallRides} Wall Runner` : 'Wall Runner')
                }

                if (this.game.trickState.wallBounces > 0) {
                    points += this.game.trickState.wallBounces * 30
                    messages.push(this.game.trickState.wallBounces > 1 ? `x${this.game.trickState.wallBounces} Ricochet` : 'Ricochet')
                }

                if (points > 0) {
                    const msg = messages.join(' + ')
                    this.game.awardTrickPoints(msg, points, '#00ffcc')

                    // Perfect Landing logic: Low downward vertical velocity after a big trick or long airtime
                    if (Math.abs(linvel.y) < 2.0 && !this.game.isStomping) {
                        setTimeout(() => {
                            this.game.awardTrickPoints('Perfect Landing!', 50, '#00ff00')
                        }, 500)
                    }
                }
            }
            this.game.trickState.airTime = 0
            this.game.trickState.spin = 0
            this.game.trickState.wallRides = 0
            this.game.trickState.flips = 0
            this.game.trickState.rolls = 0
            this.game.trickState.wallBounces = 0
            this.game.trickState.driftTime = 0
            this.game.trickState.maxAltitude = 0
            this.game.trickState.startAltitude = 0

            this.game.isWallRiding = false
            this.game.wallRideTime = 0
            if (audio.stopRolling) audio.stopRolling('wallride')

            if (this.game.isStomping) {
                let multiplier = 1.0
                const chargeDuration = (this.game.stompReleaseTime || Date.now()) - (this.game.stompChargeTime || Date.now())

                // Add fall distance to the multiplier
                const fallDistance = Math.max(0, (this.game.stompStartAltitude || this.game.playerMarble.rigidBody.translation().y) - this.game.playerMarble.rigidBody.translation().y)

                multiplier += Math.min(3.0, chargeDuration / 1000.0) // Max +3.0 from charge
                multiplier += Math.min(5.0, fallDistance / 10.0)     // Max +5.0 from drop height

                if (multiplier > 5.0) {
                    this.game.awardTrickPoints('Meteor Strike!', 100 * Math.floor(multiplier), '#00ffff')
                } else {
                    this.game.awardTrickPoints('Stomp!', 50 * Math.floor(multiplier), '#ff0000')
                }

                this.game.performStompImpact(multiplier)
                this.game.isStomping = false
            }
        } else if (this.game.playerMarble) {
            if (this.game.trickState.maxAltitude === undefined) {
                this.game.trickState.maxAltitude = 0
                this.game.trickState.startAltitude = 0
            }
            if (this.game.trickState.airTime === 1) {
                 this.game.trickState.startAltitude = this.game.playerMarble.rigidBody.translation().y
            }
            this.game.trickState.maxAltitude = Math.max(this.game.trickState.maxAltitude, this.game.playerMarble.rigidBody.translation().y)

            const airDriftTime = this.game.trickState.driftTime ?? 0
            if (airDriftTime > 30) {
                const points = Math.floor(airDriftTime * 2)
                this.game.awardTrickPoints('Drift King!', points, '#ffff00')
            }
            this.game.trickState.driftTime = 0

            this.game.trickState.airTime += 1
            const angvel = this.game.playerMarble.rigidBody.angvel()

            // Multiply angular velocity by approximate delta time (1/60th of a second)
            // to accumulate true radians rotated instead of radians per second.
            const dt = 1.0 / 60.0
            this.game.trickState.spin += Math.hypot(angvel.x, angvel.y, angvel.z) * dt
            this.game.trickState.flips += angvel.x * dt
            this.game.trickState.rolls += angvel.z * dt

            const wallContact = this.game.getWallContact(this.game.playerMarble)
            this.game.currentWallNormal = wallContact ? wallContact.normal : null
            const rb = this.game.playerMarble.rigidBody
            const linvel = rb.linvel()
            const horizSpeed = Math.hypot(linvel.x, linvel.z)

            if (wallContact && horizSpeed > 15.0 && this.game.wallRideTime < 180 && (this.game.keys['ShiftLeft'] || this.game.keys['ShiftRight'])) {
                if (!this.game.isWallRiding) {
                    this.game.isWallRiding = true
                    this.game.trickState.wallRides += 1
                }

                const mass = rb.mass()
                const gravityDir = rb.gravityScale() < 0 ? -1 : 1
                rb.applyImpulse({ x: 0, y: 9.81 * mass * (1.0/60.0) * gravityDir + (0.5 * gravityDir), z: 0 }, true)
                rb.applyImpulse({ x: -wallContact.normal.x * 2.0, y: 0, z: -wallContact.normal.z * 2.0 }, true)

                const forwardX = Math.sin(this.game.aimYaw)
                const forwardZ = Math.cos(this.game.aimYaw)
                rb.applyImpulse({ x: forwardX * 2.0, y: 0, z: forwardZ * 2.0 }, true)

                this.game.wallRideTime += 1

                const radius = this.game.playerMarble.scale * 0.5 || 0.5
                if (audio.startRolling && audio.updateRolling) {
                    audio.startRolling('wallride', radius, 'concrete')
                    audio.updateRolling('wallride', horizSpeed, 0, computeMarbleDopplerRate(this.game, rb))
                }
            } else {
                if (this.game.isWallRiding) {
                    this.game.isWallRiding = false
                    if (audio.stopRolling) audio.stopRolling('wallride')
                }
            }

            // Ricochet check when not wallriding
            if (wallContact && !this.game.isWallRiding && horizSpeed > 3.0) {
                const now = Date.now()
                if (!this.game.lastWallBounceTime || now - this.game.lastWallBounceTime > 200) {
                    this.game.trickState.wallBounces += 1
                    this.game.lastWallBounceTime = now

                    // Add slight bounce physics since we are not wall-riding
                    const mass = rb.mass()
                    const bounciness = 5.0
                    rb.applyImpulse({ x: wallContact.normal.x * bounciness * mass, y: 0, z: wallContact.normal.z * bounciness * mass }, true)

                    if (audio && audio.playClink) {
                        const radius = this.game.playerMarble.scale * 0.5 || 0.5
                        audio.playClink(horizSpeed, radius, `bounce-${this.game.currentMarbleIndex}`, computeMarbleDopplerRate(this.game, rb))
                    }
                }
            }
        }

        // Near Miss Logic
        if (this.game.playerMarble) {
            const rb = this.game.playerMarble.rigidBody
            const linvel = rb.linvel()
            const speed = Math.hypot(linvel.x, linvel.y, linvel.z)

            if (speed > 15) {
                const playerPos = rb.translation()
                const now = Date.now()

                const checkNearMiss = (body: RAPIER.RigidBody, handleStr: string) => {
                    const pos = body.translation()
                    const dx = playerPos.x - pos.x
                    const dy = playerPos.y - pos.y
                    const dz = playerPos.z - pos.z
                    const distSq = dx * dx + dy * dy + dz * dz

                    if (distSq > 1.0 && distSq < 16.0) {
                        const lastMissTime = this.game.nearMisses.get(handleStr) || 0
                        if (now - lastMissTime > 2000) {
                            this.game.awardTrickPoints("Near Miss!", 50, "#ff8800")
                            this.game.nearMisses.set(handleStr, now)
                        }
                    }
                }

                for (const obj of this.game.dynamicObjects) {
                    checkNearMiss(obj.rigidBody, `dyn_${obj.rigidBody.handle}`)
                }
                for (const obj of this.game.movingPlatforms) {
                    checkNearMiss(obj.rigidBody, `mov_${obj.rigidBody.handle}`)
                }
                for (const obj of this.game.rotatingPlatforms) {
                    checkNearMiss(obj.rigidBody, `rot_${obj.rigidBody.handle}`)
                }
            }
        }

        const level = getLevel(this.game.currentLevel)
        // Unknown level id (catalog not loaded yet): nothing to score against.
        if (!level) return
        let allGoalsScored = level.goals.length > 0

        for (const m of this.game.marbles) {
            const t = m.rigidBody.translation()

            if (t.y < -20) {
                const respawn = m.respawnPos || m.initialPos
                m.rigidBody.setTranslation(respawn, true)
                m.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
                m.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
                m.scoredGoals.clear()
                if (m === this.game.playerMarble) {
                    this.game._rewindHead = 0; this.game._rewindCount = 0
                    this.game.resetPlayerAbilityState()
                }
                continue
            }

            for (const cp of this.game.checkpoints) {
                if (cp.activated) continue

                const radius = m.scale * 0.5 || 0.5
                const minX = cp.pos.x - cp.halfExtents.x
                const maxX = cp.pos.x + cp.halfExtents.x
                const minZ = cp.pos.z - cp.halfExtents.z
                const maxZ = cp.pos.z + cp.halfExtents.z
                const minY = cp.pos.y - cp.halfExtents.y
                const maxY = cp.pos.y + cp.halfExtents.y

                if (t.x + radius > minX && t.x - radius < maxX &&
                    t.z + radius > minZ && t.z - radius < maxZ &&
                    t.y + radius > minY && t.y - radius < maxY) {
                    this.game.activateCheckpoint(cp, m)
                }
            }

            for (const goal of this.game.goalDefinitions) {
                if (!m.scoredGoals.has(goal.id) &&
                    t.x > goal.range.x[0] && t.x < goal.range.x[1] &&
                    t.z > goal.range.z[0] && t.z < goal.range.z[1] &&
                    t.y > goal.range.y[0] && t.y < goal.range.y[1]) {

                    m.scoredGoals.add(goal.id)

                    // Combo Logic
                    if (m === this.game.playerMarble) {
                        this.game.combo = Math.min(10, this.game.combo + 1)
                        this.game.comboTimer = Date.now()
                        if (this.game.comboEl) {
                            this.game.comboEl.style.display = 'block'
                            this.game.comboEl.textContent = `Combo: x${this.game.combo}`
                            this.game.comboEl.style.transform = 'scale(1.2)'
                            setTimeout(() => { if (this.game.comboEl) this.game.comboEl.style.transform = 'scale(1)' }, 100)
                        }
                        if (this.game.combobarContainerEl) this.game.combobarContainerEl.style.display = 'block'
                    }

                    this.game.score += 1 * this.game.combo
                    if (this.game.scoreEl) this.game.scoreEl.textContent = 'Score: ' + this.game.score

                    if (this.game.score <= 5) {
                        const goalPos = {
                            x: (goal.range.x[0] + goal.range.x[1]) * 0.5,
                            y: (goal.range.y[0] + goal.range.y[1]) * 0.5,
                            z: (goal.range.z[0] + goal.range.z[1]) * 0.5,
                        }
                        if (audio.playAbility) {
                            audio.playAbility('goal', goalPos)
                        } else {
                            audio.playGoal(goalPos)
                        }
                    }
                    
                    // Trigger goal completion visual effect
                    if (this.game.goalEffects && this.game.goalEffects[goal.id]) {
                        this.game.triggerGoalCompletionEffect(goal.id)
                    }
                }
            }
        }

        for (const goal of level.goals) {
            let goalScored = false
            for (const m of this.game.marbles) {
                if (m.scoredGoals.has(goal.id)) {
                    goalScored = true
                    break
                }
            }
            if (!goalScored) {
                allGoalsScored = false
                break
            }
        }

        if (this.game.playerMarble) {
            const pt = this.game.playerMarble.rigidBody.translation()
            const pv = this.game.playerMarble.rigidBody.linvel()
            for (const other of this.game.marbles) {
                if (other === this.game.playerMarble) continue
                const ot = other.rigidBody.translation()
                const ov = other.rigidBody.linvel()
                const dx = pt.x - ot.x
                const dy = pt.y - ot.y
                const dz = pt.z - ot.z
                const dist = Math.hypot(dx, dy, dz)
                if (dist < 1.0) {
                    const relSpeed = Math.hypot(pv.x - ov.x, pv.y - ov.y, pv.z - ov.z)
                    if (relSpeed > 4) {
                        // Combo Logic
                        this.game.combo = Math.min(10, this.game.combo + 1)
                        this.game.comboTimer = Date.now()
                        if (this.game.comboEl) {
                            this.game.comboEl.style.display = 'block'
                            this.game.comboEl.textContent = `Combo: x${this.game.combo}`
                            this.game.comboEl.style.transform = 'scale(1.2)'
                            setTimeout(() => { if (this.game.comboEl) this.game.comboEl.style.transform = 'scale(1)' }, 100)
                        }
                        if (this.game.combobarContainerEl) this.game.combobarContainerEl.style.display = 'block'

                        this.game.score += Math.floor(relSpeed / 3) * this.game.combo
                        if (this.game.scoreEl) this.game.scoreEl.innerText = `Score: ${this.game.score}`

                        const playerRadius = this.game.playerMarble.scale * 0.5 || 0.5
                        const otherRadius = other.scale * 0.5 || 0.5
                        audio.playClink(relSpeed, playerRadius, `player-${this.game.currentMarbleIndex}`, computeMarbleDopplerRate(this.game, this.game.playerMarble.rigidBody))
                        audio.playClink(relSpeed * 0.7, otherRadius, `other-${this.game.marbles.indexOf(other)}`, computeMarbleDopplerRate(this.game, other.rigidBody))

                        const nx = dx / dist
                        const ny = dy / dist
                        const nz = dz / dist
                        other.rigidBody.applyImpulse({ x: nx * 6, y: ny * 2 + 2, z: nz * 6 }, true)
                    }
                }
            }
        }

        if (this.game.playerMarble) {
            const pt = this.game.playerMarble.rigidBody.translation()
            for (let i = this.game.powerUps.length - 1; i >= 0; i--) {
                const p = this.game.powerUps[i]
                if (!p) continue
                const dx = pt.x - p.pos.x
                const dy = pt.y - p.pos.y
                const dz = pt.z - p.pos.z
                if (Math.hypot(dx, dy, dz) < 1.0) {
                    const now = Date.now()
                    const duration = 5000
                    this.game.activeEffects[p.type] = now + duration

                    if (audio.playCollect) audio.playCollect()
                    console.log(`[GAME] Collected ${p.type} powerup!`)

                    // Combo Logic
                    this.game.combo = Math.min(10, this.game.combo + 1)
                    this.game.comboTimer = Date.now()
                    if (this.game.comboEl) {
                        this.game.comboEl.style.display = 'block'
                        this.game.comboEl.textContent = `Combo: x${this.game.combo}`
                        this.game.comboEl.style.transform = 'scale(1.2)'
                        setTimeout(() => { if (this.game.comboEl) this.game.comboEl.style.transform = 'scale(1)' }, 100)
                    }
                    if (this.game.combobarContainerEl) this.game.combobarContainerEl.style.display = 'block'

                    if (p.rigidBody) this.game.world.removeRigidBody(p.rigidBody)
                    this.game.scene.remove(p.entity)
                    this.game.engine.destroyEntity(p.entity)
                    this.game.powerUps.splice(i, 1)
                }
            }
        }

        if (allGoalsScored && !this.game.levelComplete) {
            this.game.levelComplete = true
            const completionTime = (Date.now() - this.game.levelStartTime) / 1000

            let newRecord = false
            if (this.game.ghostReplay?.saveBestRecording(this.game.currentLevel, completionTime)) {
                newRecord = true
            }

            const level = getLevel(this.game.currentLevel)
            if (this.game.campaignProgress && level) {
                const saved = this.game.campaignProgress.recordCompletion(this.game.currentLevel, {
                    time: completionTime,
                    level,
                    collectibles: this.game.collectiblesCollected || 0,
                    collectiblesTotal: level.collectiblesTotal || 0,
                })
                if (saved.bestTime === completionTime) {
                    newRecord = true
                }
            }

            setTimeout(() => {
                this.game.showLevelCompleteModal(completionTime, newRecord)
            }, 100)
        }
    }
}
