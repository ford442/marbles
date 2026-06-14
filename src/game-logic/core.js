import { audio } from '../audio.js';
import { LEVELS } from '../levels.js';

export class GameLogicCore {
    checkGameLogic() {
        if (!this.currentLevel || this.levelComplete) return

        let horizSpeed = 0
        if (this.playerMarble) {
            const linvel = this.playerMarble.rigidBody.linvel()
            horizSpeed = Math.hypot(linvel.x, linvel.z)

            if (this.highSpeedTime === undefined) this.highSpeedTime = 0
            if (this.lastSpeedAwardTime === undefined) this.lastSpeedAwardTime = 0

            if (horizSpeed > 15.0) {
                this.highSpeedTime += 1
            } else {
                this.highSpeedTime = 0
            }

            if (this.highSpeedTime > 120) {
                const now = Date.now()
                if (now - this.lastSpeedAwardTime > 2000) {
                    this.awardTrickPoints('Speed Demon!', 30, '#ff4444')
                    this.lastSpeedAwardTime = now
                    this.highSpeedTime = 0
                }
            }
        }

        if (this.playerMarble && this.isGrounded(this.playerMarble)) {
            const linvel = this.playerMarble.rigidBody.linvel()
            const gravityDir = this.playerMarble.rigidBody.gravityScale() < 0 ? -1 : 1

            if ((gravityDir > 0 && linvel.y <= 0.1) || (gravityDir < 0 && linvel.y >= -0.1)) {
                this.jumpCount = 0
            }

            const radius = this.playerMarble.scale * 0.5 || 0.5
            const angvel = this.playerMarble.rigidBody.angvel()
            const slideVx = linvel.x + angvel.z * radius
            const slideVz = linvel.z - angvel.x * radius
            const slideSpeed = Math.hypot(slideVx, slideVz)

            if (this.trickState.driftTime === undefined) this.trickState.driftTime = 0

            if (slideSpeed > 10.0 && horizSpeed > 10.0) {
                this.trickState.driftTime += 1
                if (this.trickState.driftTime % 3 === 0) {
                    const pos = this.playerMarble.rigidBody.translation()
                    const sparkPos = { x: pos.x, y: pos.y - radius, z: pos.z }
                    this.spawnDriftSparks(sparkPos)
                }
            } else {
                if (this.trickState.driftTime > 30) {
                    const points = Math.floor(this.trickState.driftTime * 2)
                    this.awardTrickPoints('Drift King!', points, '#ffff00')
                }
                this.trickState.driftTime = 0
            }

            if (this.trickState.airTime > 30 || this.trickState.wallRides > 0 || this.trickState.wallBounces > 0) {
                let points = Math.floor(this.trickState.airTime * 2)
                let messages = []

                // 1 full rotation = approx 2*PI radians. We check accumulated radians rotated.
                const totalFlips = Math.floor(Math.abs(this.trickState.flips) / (Math.PI * 2))
                const totalRolls = Math.floor(Math.abs(this.trickState.rolls) / (Math.PI * 2))

                if (totalFlips > 0) {
                    points += totalFlips * 100
                    messages.push(totalFlips > 1 ? `x${totalFlips} Flip` : (this.trickState.flips > 0 ? 'Front Flip' : 'Back Flip'))
                }

                if (totalRolls > 0) {
                    points += totalRolls * 100
                    messages.push(totalRolls > 1 ? `x${totalRolls} Roll` : 'Barrel Roll')
                }

                // Spin bonus logic: total accumulated rotation magnitude in radians
                if (totalFlips === 0 && totalRolls === 0 && this.trickState.spin > (Math.PI * 2)) {
                    const totalSpins = Math.floor(this.trickState.spin / (Math.PI * 2))
                    points += totalSpins * 50
                    messages.push(totalSpins > 1 ? `x${totalSpins} Spin` : 'Spin')
                } else if (this.trickState.spin > Math.PI) { // At least half a rotation of combined spin
                    points += Math.floor(this.trickState.spin * 10)
                }

                if (this.trickState.airTime > 90) {
                    points += 50
                    messages.push('Hang Time')
                } else if (this.trickState.airTime > 60) {
                    messages.push('Big Air')
                } else if (messages.length === 0) {
                    messages.push('Air Time')
                }

                if (this.trickState.wallRides > 0) {
                    points += this.trickState.wallRides * 150
                    messages.push(this.trickState.wallRides > 1 ? `x${this.trickState.wallRides} Wall Runner` : 'Wall Runner')
                }

                if (this.trickState.wallBounces > 0) {
                    points += this.trickState.wallBounces * 30
                    messages.push(this.trickState.wallBounces > 1 ? `x${this.trickState.wallBounces} Ricochet` : 'Ricochet')
                }

                if (points > 0) {
                    const msg = messages.join(' + ')
                    this.awardTrickPoints(msg, points, '#00ffcc')

                    // Perfect Landing logic: Low downward vertical velocity after a big trick or long airtime
                    if (Math.abs(linvel.y) < 2.0 && !this.isStomping) {
                        setTimeout(() => {
                            this.awardTrickPoints('Perfect Landing!', 50, '#00ff00')
                        }, 500)
                    }
                }
            }
            this.trickState.airTime = 0
            this.trickState.spin = 0
            this.trickState.wallRides = 0
            this.trickState.flips = 0
            this.trickState.rolls = 0
            this.trickState.wallBounces = 0
            this.trickState.driftTime = 0

            this.isWallRiding = false
            this.wallRideTime = 0
            if (audio.stopRolling) audio.stopRolling('wallride')

            if (this.isStomping) {
                let multiplier = 1.0
                const stompDuration = Date.now() - this.stompStartTime
                if (stompDuration < 300) {
                    multiplier = 2.0
                    this.awardTrickPoints('Perfect Stomp!', 50, '#ff0000')
                }
                this.performStompImpact(multiplier)
                this.isStomping = false
            }
        } else if (this.playerMarble) {
            if (this.trickState.driftTime > 30) {
                const points = Math.floor(this.trickState.driftTime * 2)
                this.awardTrickPoints('Drift King!', points, '#ffff00')
            }
            this.trickState.driftTime = 0

            this.trickState.airTime += 1
            const angvel = this.playerMarble.rigidBody.angvel()

            // Multiply angular velocity by approximate delta time (1/60th of a second)
            // to accumulate true radians rotated instead of radians per second.
            const dt = 1.0 / 60.0
            this.trickState.spin += Math.hypot(angvel.x, angvel.y, angvel.z) * dt
            this.trickState.flips += angvel.x * dt
            this.trickState.rolls += angvel.z * dt

            const wallContact = this.getWallContact(this.playerMarble)
            this.currentWallNormal = wallContact ? wallContact.normal : null
            const rb = this.playerMarble.rigidBody
            const linvel = rb.linvel()
            const horizSpeed = Math.hypot(linvel.x, linvel.z)

            if (wallContact && horizSpeed > 15.0 && this.wallRideTime < 180 && (this.keys['ShiftLeft'] || this.keys['ShiftRight'])) {
                if (!this.isWallRiding) {
                    this.isWallRiding = true
                    this.trickState.wallRides += 1
                }

                const mass = rb.mass()
                const gravityDir = rb.gravityScale() < 0 ? -1 : 1
                rb.applyImpulse({ x: 0, y: 9.81 * mass * (1.0/60.0) * gravityDir + (0.5 * gravityDir), z: 0 }, true)
                rb.applyImpulse({ x: -wallContact.normal.x * 2.0, y: 0, z: -wallContact.normal.z * 2.0 }, true)

                const forwardX = Math.sin(this.aimYaw)
                const forwardZ = Math.cos(this.aimYaw)
                rb.applyImpulse({ x: forwardX * 2.0, y: 0, z: forwardZ * 2.0 }, true)

                this.wallRideTime += 1

                const radius = this.playerMarble.scale * 0.5 || 0.5
                if (audio.startRolling && audio.updateRolling) {
                    audio.startRolling('wallride', radius, 'concrete')
                    audio.updateRolling('wallride', horizSpeed, 0)
                }
            } else {
                if (this.isWallRiding) {
                    this.isWallRiding = false
                    if (audio.stopRolling) audio.stopRolling('wallride')
                }
            }

            // Ricochet check when not wallriding
            if (wallContact && !this.isWallRiding && horizSpeed > 3.0) {
                const now = Date.now()
                if (!this.lastWallBounceTime || now - this.lastWallBounceTime > 200) {
                    this.trickState.wallBounces += 1
                    this.lastWallBounceTime = now

                    // Add slight bounce physics since we are not wall-riding
                    const mass = rb.mass()
                    const bounciness = 5.0
                    rb.applyImpulse({ x: wallContact.normal.x * bounciness * mass, y: 0, z: wallContact.normal.z * bounciness * mass }, true)

                    if (audio && audio.playClink) {
                        const radius = this.playerMarble.scale * 0.5 || 0.5
                        audio.playClink(horizSpeed, radius, `bounce-${this.currentMarbleIndex}`)
                    }
                }
            }
        }

        // Near Miss Logic
        if (this.playerMarble) {
            const rb = this.playerMarble.rigidBody
            const linvel = rb.linvel()
            const speed = Math.hypot(linvel.x, linvel.y, linvel.z)

            if (speed > 15) {
                const playerPos = rb.translation()
                const now = Date.now()

                const checkNearMiss = (body, handleStr) => {
                    const pos = body.translation()
                    const dx = playerPos.x - pos.x
                    const dy = playerPos.y - pos.y
                    const dz = playerPos.z - pos.z
                    const distSq = dx * dx + dy * dy + dz * dz

                    if (distSq > 1.0 && distSq < 16.0) {
                        const lastMissTime = this.nearMisses.get(handleStr) || 0
                        if (now - lastMissTime > 2000) {
                            this.awardTrickPoints("Near Miss!", 50, "#ff8800")
                            this.nearMisses.set(handleStr, now)
                        }
                    }
                }

                for (const obj of this.dynamicObjects) {
                    checkNearMiss(obj.rigidBody, `dyn_${obj.rigidBody.handle}`)
                }
                for (const obj of this.movingPlatforms) {
                    checkNearMiss(obj.rigidBody, `mov_${obj.rigidBody.handle}`)
                }
                for (const obj of this.rotatingPlatforms) {
                    checkNearMiss(obj.rigidBody, `rot_${obj.rigidBody.handle}`)
                }
            }
        }

        const level = LEVELS[this.currentLevel]
        let allGoalsScored = level.goals.length > 0

        for (const m of this.marbles) {
            const t = m.rigidBody.translation()

            if (t.y < -20) {
                const respawn = m.respawnPos || m.initialPos
                m.rigidBody.setTranslation(respawn, true)
                m.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
                m.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
                m.scoredGoals.clear()
                if (m === this.playerMarble) {
                    this._rewindHead = 0; this._rewindCount = 0
                }
                continue
            }

            for (const cp of this.checkpoints) {
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
                    this.activateCheckpoint(cp, m)
                }
            }

            for (const goal of this.goalDefinitions) {
                if (!m.scoredGoals.has(goal.id) &&
                    t.x > goal.range.x[0] && t.x < goal.range.x[1] &&
                    t.z > goal.range.z[0] && t.z < goal.range.z[1] &&
                    t.y > goal.range.y[0] && t.y < goal.range.y[1]) {

                    m.scoredGoals.add(goal.id)

                    // Combo Logic
                    if (m === this.playerMarble) {
                        this.combo = Math.min(10, this.combo + 1)
                        this.comboTimer = Date.now()
                        if (this.comboEl) {
                            this.comboEl.style.display = 'block'
                            this.comboEl.textContent = `Combo: x${this.combo}`
                            this.comboEl.style.transform = 'scale(1.2)'
                            setTimeout(() => { if (this.comboEl) this.comboEl.style.transform = 'scale(1)' }, 100)
                        }
                        if (this.combobarContainerEl) this.combobarContainerEl.style.display = 'block'
                    }

                    this.score += 1 * this.combo
                    this.scoreEl.textContent = 'Score: ' + this.score

                    if (this.score <= 5) {
                        audio.playGoal()
                    }
                    
                    // Trigger goal completion visual effect
                    if (this.goalEffects && this.goalEffects[goal.id]) {
                        this.triggerGoalCompletionEffect(goal.id)
                    }
                }
            }
        }

        for (const goal of level.goals) {
            let goalScored = false
            for (const m of this.marbles) {
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

        if (this.playerMarble) {
            const pt = this.playerMarble.rigidBody.translation()
            const pv = this.playerMarble.rigidBody.linvel()
            for (const other of this.marbles) {
                if (other === this.playerMarble) continue
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
                        this.combo = Math.min(10, this.combo + 1)
                        this.comboTimer = Date.now()
                        if (this.comboEl) {
                            this.comboEl.style.display = 'block'
                            this.comboEl.textContent = `Combo: x${this.combo}`
                            this.comboEl.style.transform = 'scale(1.2)'
                            setTimeout(() => { if (this.comboEl) this.comboEl.style.transform = 'scale(1)' }, 100)
                        }
                        if (this.combobarContainerEl) this.combobarContainerEl.style.display = 'block'

                        this.score += Math.floor(relSpeed / 3) * this.combo
                        this.scoreEl.innerText = `Score: ${this.score}`

                        const playerRadius = this.playerMarble.scale * 0.5 || 0.5
                        const otherRadius = other.scale * 0.5 || 0.5
                        audio.playClink(relSpeed, playerRadius, `player-${this.currentMarbleIndex}`)
                        audio.playClink(relSpeed * 0.7, otherRadius, `other-${this.marbles.indexOf(other)}`)

                        const nx = dx / dist
                        const ny = dy / dist
                        const nz = dz / dist
                        other.rigidBody.applyImpulse({ x: nx * 6, y: ny * 2 + 2, z: nz * 6 }, true)
                    }
                }
            }
        }

        if (this.playerMarble) {
            const pt = this.playerMarble.rigidBody.translation()
            for (let i = this.powerUps.length - 1; i >= 0; i--) {
                const p = this.powerUps[i]
                const dx = pt.x - p.pos.x
                const dy = pt.y - p.pos.y
                const dz = pt.z - p.pos.z
                if (Math.hypot(dx, dy, dz) < 1.0) {
                    const now = Date.now()
                    const duration = 5000
                    this.activeEffects[p.type] = now + duration

                    if (audio.playCollect) audio.playCollect()
                    console.log(`[GAME] Collected ${p.type} powerup!`)

                    // Combo Logic
                    this.combo = Math.min(10, this.combo + 1)
                    this.comboTimer = Date.now()
                    if (this.comboEl) {
                        this.comboEl.style.display = 'block'
                        this.comboEl.textContent = `Combo: x${this.combo}`
                        this.comboEl.style.transform = 'scale(1.2)'
                        setTimeout(() => { if (this.comboEl) this.comboEl.style.transform = 'scale(1)' }, 100)
                    }
                    if (this.combobarContainerEl) this.combobarContainerEl.style.display = 'block'

                    this.world.removeRigidBody(p.rigidBody)
                    this.scene.remove(p.entity)
                    this.engine.destroyEntity(p.entity)
                    this.powerUps.splice(i, 1)
                }
            }
        }

        if (allGoalsScored && !this.levelComplete) {
            this.levelComplete = true
            const completionTime = (Date.now() - this.levelStartTime) / 1000

            let newRecord = false
            if (!this.bestGhosts[this.currentLevel] || this.ghostRecording.length < this.bestGhosts[this.currentLevel].length) {
                this.bestGhosts[this.currentLevel] = [...this.ghostRecording]
                newRecord = true
            }

            setTimeout(() => {
                this.showLevelCompleteModal(completionTime, newRecord)
            }, 100)
        }
    }
}

export function applyGameLogicCore(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLogicCore.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLogicCore.prototype[name];
        }
    }
}
