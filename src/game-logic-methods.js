import { audio } from './audio.js';
import { quatFromEuler } from './math.js';
import { LEVELS } from './levels.js';

export class GameLogicMethods {
    performStompImpact(multiplier = 1.0) {
        if (!this.playerMarble) return

        if (audio.playStomp) audio.playStomp()

        const center = this.playerMarble.rigidBody.translation()
        const radius = 15.0 * multiplier
        const force = 100.0 * multiplier

        const applyForce = (body) => {
            const t = body.translation()
            const dx = t.x - center.x
            const dy = t.y - center.y
            const dz = t.z - center.z
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

        for (const m of this.marbles) {
            if (m !== this.playerMarble) {
                applyForce(m.rigidBody)
            }
        }
        for (const obj of this.dynamicObjects) {
            applyForce(obj.rigidBody)
        }

        if (this.playerMarble.color) {
            const rcm = this.engine.getRenderableManager()
            const inst = rcm.getInstance(this.playerMarble.entity)
            rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, this.playerMarble.color)
        }

        // Add a visual particle ring at the impact point
        const ringEntity = this.Filament.EntityManager.get().create()
        const ringMatInstance = this.material.createInstance()
        ringMatInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 0.2, 0.0])
        ringMatInstance.setFloatParameter('roughness', 0.8)

        const halfExtents = { x: 0.1, y: 0.1, z: 0.1 }

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, ringMatInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .build(this.engine, ringEntity)

        this.scene.addEntity(ringEntity)

        // Add to visualParticles to be animated and cleaned up in loop()
        // We'll give it a special flag or use the scale to animate it growing outward
        this.visualParticles.push({
            entity: ringEntity,
            matInstance: ringMatInstance,
            spawnTime: Date.now(),
            pos: { x: center.x, y: center.y - 0.4, z: center.z },
            vel: { x: 0, y: 0, z: 0 }, // It expands rather than moves
            duration: 500,
            scale: 1.0,
            isRing: true // Custom flag to animate differently
        })
    }

    awardTrickPoints(message, points, color) {
        if (audio && audio.playCollect) audio.playCollect()

        this.combo = Math.min(10, this.combo + 1)
        this.comboTimer = Date.now()
        if (this.comboEl) {
            this.comboEl.style.display = 'block'
            this.comboEl.textContent = `Combo: x${this.combo}`
            this.comboEl.style.transform = 'scale(1.2)'
            setTimeout(() => { if (this.comboEl) this.comboEl.style.transform = 'scale(1)' }, 100)
        }
        if (this.combobarContainerEl) this.combobarContainerEl.style.display = 'block'

        this.score += points * this.combo
        if (this.scoreEl) this.scoreEl.textContent = 'Score: ' + this.score

        this.showTrickMessage(message + ` +${points * this.combo}`, color)
    }

    showTrickMessage(text, color) {
        const uiContainer = document.getElementById('ui')
        if (!uiContainer) return

        const msgEl = document.createElement('div')
        msgEl.textContent = text
        msgEl.style.position = 'absolute'
        // random position around the center-ish of the UI
        msgEl.style.left = '200px'
        msgEl.style.top = (150 + Math.random() * 50) + 'px'
        msgEl.style.color = color || '#ffffff'
        msgEl.style.fontWeight = 'bold'
        msgEl.style.fontSize = '24px'
        msgEl.style.textShadow = '2px 2px 0 #000'
        msgEl.style.transition = 'all 1.5s ease-out'
        msgEl.style.pointerEvents = 'none'
        msgEl.style.zIndex = '100'

        uiContainer.appendChild(msgEl)

        // Force reflow
        msgEl.getBoundingClientRect()

        msgEl.style.top = (parseInt(msgEl.style.top) - 50) + 'px'
        msgEl.style.opacity = '0'
        msgEl.style.transform = 'scale(1.5)'

        setTimeout(() => {
            if (msgEl.parentNode) {
                msgEl.parentNode.removeChild(msgEl)
            }
        }, 1500)
    }

    checkGameLogic() {
        if (!this.currentLevel || this.levelComplete) return

        if (this.playerMarble && this.isGrounded(this.playerMarble)) {
            const linvel = this.playerMarble.rigidBody.linvel()
            const gravityDir = this.playerMarble.rigidBody.gravityScale() < 0 ? -1 : 1
            if ((gravityDir > 0 && linvel.y <= 0.1) || (gravityDir < 0 && linvel.y >= -0.1)) {
                this.jumpCount = 0
            }

            if (this.trickState.airTime > 30 || this.trickState.wallRides > 0) {
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

                if (this.trickState.airTime > 60) {
                    messages.push('Big Air')
                } else if (messages.length === 0) {
                    messages.push('Air Time')
                }

                if (this.trickState.wallRides > 0) {
                    points += this.trickState.wallRides * 50
                    messages.push('Wall Ride')
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
            this.trickState.airTime += 1
            const angvel = this.playerMarble.rigidBody.angvel()

            // Multiply angular velocity by approximate delta time (1/60th of a second)
            // to accumulate true radians rotated instead of radians per second.
            const dt = 1.0 / 60.0
            this.trickState.spin += Math.hypot(angvel.x, angvel.y, angvel.z) * dt
            this.trickState.flips += angvel.x * dt
            this.trickState.rolls += angvel.z * dt

            const wallContact = this.getWallContact(this.playerMarble)
            const rb = this.playerMarble.rigidBody
            const linvel = rb.linvel()
            const horizSpeed = Math.hypot(linvel.x, linvel.z)

            if (wallContact && horizSpeed > 5.0 && this.wallRideTime < 90) {
                if (!this.isWallRiding) {
                    this.isWallRiding = true
                    this.trickState.wallRides += 1
                }

                const mass = rb.mass()
                const gravityDir = rb.gravityScale() < 0 ? -1 : 1
                rb.applyImpulse({ x: 0, y: 0.16 * mass * gravityDir, z: 0 }, true)
                rb.applyImpulse({ x: -wallContact.normal.x * 2.0, y: 0, z: -wallContact.normal.z * 2.0 }, true)

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
                    this.rewindHistory = []
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
                    cp.activated = true
                    if (cp.matInstance) {
                        cp.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 0.0])
                    }
                    audio.playGoal()
                    m.respawnPos = { x: cp.pos.x, y: cp.pos.y + 1.0, z: cp.pos.z }
                    console.log(`[GAME] Checkpoint activated by ${m.name}! New respawn set.`)
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

        if (allGoalsScored && !this.levelComplete) {
            this.levelComplete = true
            const time = ((Date.now() - this.levelStartTime) / 1000).toFixed(1)

            let newRecordStr = ""
            if (!this.bestGhosts[this.currentLevel] || this.ghostRecording.length < this.bestGhosts[this.currentLevel].length) {
                this.bestGhosts[this.currentLevel] = [...this.ghostRecording]
                newRecordStr = "\nNEW GHOST RECORD!"
            }

            setTimeout(() => {
                alert(`Level Complete!\nTime: ${time}s${newRecordStr}\nPress M to return to menu`)
            }, 100)
        }
    }

    resize() {
        const width = window.innerWidth
        const height = window.innerHeight

        this.canvas.style.width = width + 'px'
        this.canvas.style.height = height + 'px'
        this.canvas.width = width
        this.canvas.height = height

        console.log(`[RESIZE] Canvas: ${width}x${height}`)

        if (this.view && this.camera) {
            this.view.setViewport([0, 0, width, height])
            const aspect = width / height
            const Fov = this.Filament.Camera$Fov
            this.camera.setProjectionFov(this.currentFov, aspect, 0.1, 1000.0, Fov.VERTICAL)
            this.camera.lookAt([0, 10, 20], [0, 0, 0], [0, 1, 0])
        }
    }

}

export function applyGameLogicMethods(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLogicMethods.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLogicMethods.prototype[name];
        }
    }
}
