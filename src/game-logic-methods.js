import { audio } from './audio.js';
import { quatFromEuler } from './math.js';
import { LEVELS } from './levels.js';

export class GameLogicMethods {
    /**
     * Trigger collection burst effect when a collectible is collected
     * @param {Object} pos - Position {x, y, z} of the collectible
     * @param {number} value - Score value of the collectible
     * @param {string} type - Type of collectible ('coin', 'gem', 'star')
     */
    triggerCollectionEffect(pos, value, type = 'coin') {
        const now = Date.now()
        
        // Define colors based on collectible type
        const colors = {
            coin: { r: 1.0, g: 0.84, b: 0.0 },     // Gold
            gem: { r: 0.0, g: 0.8, b: 1.0 },       // Cyan/Blue
            star: { r: 1.0, g: 0.9, b: 0.2 }       // Bright yellow
        }
        const color = colors[type] || colors.coin
        
        // 1. Create particle burst (25 particles)
        const particleCount = 25
        for (let i = 0; i < particleCount; i++) {
            const particle = this.createCollectionParticle(pos, color, i, particleCount)
            this.visualParticles.push(particle)
        }
        
        // 2. Create flash ring effect
        const ringEntity = this.Filament.EntityManager.get().create()
        const ringMatInstance = this.material.createInstance()
        ringMatInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [color.r, color.g, color.b])
        ringMatInstance.setFloatParameter('roughness', 0.3)
        
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.05, 0.5] })
            .material(0, ringMatInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(false)
            .castShadows(false)
            .build(this.engine, ringEntity)
        
        this.scene.addEntity(ringEntity)
        
        this.visualParticles.push({
            entity: ringEntity,
            matInstance: ringMatInstance,
            spawnTime: now,
            pos: { x: pos.x, y: pos.y, z: pos.z },
            duration: 600,
            isCollectionRing: true,
            startRadius: 0.5,
            maxRadius: 3.0,
            color: color
        })
        
        // 3. Create sparkle rays (8 rays emanating outward)
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2
            const rayEntity = this.Filament.EntityManager.get().create()
            const rayMatInstance = this.material.createInstance()
            rayMatInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 1.0, 0.8])
            rayMatInstance.setFloatParameter('roughness', 0.1)
            
            this.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [0.05, 0.05, 0.3] })
                .material(0, rayMatInstance)
                .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
                .receiveShadows(false)
                .castShadows(false)
                .build(this.engine, rayEntity)
            
            this.scene.addEntity(rayEntity)
            
            const speed = 3.0 + Math.random() * 2.0
            this.visualParticles.push({
                entity: rayEntity,
                matInstance: rayMatInstance,
                spawnTime: now,
                pos: { x: pos.x, y: pos.y, z: pos.z },
                vel: {
                    x: Math.cos(angle) * speed,
                    y: 1.0 + Math.random() * 2.0,
                    z: Math.sin(angle) * speed
                },
                duration: 400 + Math.random() * 200,
                isCollectionRay: true,
                angle: angle
            })
        }
        
        // 4. Show floating score popup
        this.showCollectionScorePopup(pos, value)
        
        // 5. Screen flash effect (subtle, localized to position)
        this.triggerCollectionFlash(pos, color)
    }
    
    /**
     * Create a single collection particle
     */
    createCollectionParticle(pos, color, index, total) {
        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        
        // Vary color slightly for visual interest
        const variation = 0.2
        const r = Math.min(1.0, color.r + (Math.random() - 0.5) * variation)
        const g = Math.min(1.0, color.g + (Math.random() - 0.5) * variation)
        const b = Math.min(1.0, color.b + (Math.random() - 0.5) * variation)
        
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
        matInstance.setFloatParameter('roughness', 0.2)
        
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.08, 0.08, 0.08] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(false)
            .castShadows(false)
            .build(this.engine, entity)
        
        this.scene.addEntity(entity)
        
        // Calculate burst direction (upward cone)
        const angle = (index / total) * Math.PI * 2
        const spread = 0.5 + Math.random() * 0.5
        const upwardBias = 2.0 + Math.random() * 2.0
        
        return {
            entity: entity,
            matInstance: matInstance,
            spawnTime: Date.now(),
            pos: { 
                x: pos.x + (Math.random() - 0.5) * 0.3, 
                y: pos.y + (Math.random() - 0.5) * 0.3, 
                z: pos.z + (Math.random() - 0.5) * 0.3 
            },
            vel: {
                x: Math.cos(angle) * spread,
                y: upwardBias + Math.random() * 1.5,
                z: Math.sin(angle) * spread
            },
            duration: 500 + Math.random() * 400,
            isCollectionParticle: true,
            rotationSpeed: (Math.random() - 0.5) * 0.3
        }
    }
    
    /**
     * Show floating score popup
     */
    showCollectionScorePopup(pos, value) {
        const uiContainer = document.getElementById('ui')
        if (!uiContainer) return
        
        const popup = document.createElement('div')
        const scoreText = value * this.combo
        popup.textContent = `+${scoreText}`
        popup.className = 'collection-score-popup'
        popup.style.cssText = `
            position: absolute;
            color: #ffd700;
            font-weight: bold;
            font-size: 24px;
            text-shadow: 2px 2px 0 #000, 0 0 10px #ffd700;
            pointer-events: none;
            z-index: 100;
            transform: translate(-50%, -50%) scale(0.5);
            transition: all 0.8s ease-out;
            opacity: 0;
        `
        
        // Project 3D position to screen space
        const screenPos = this.worldToScreen(pos)
        if (screenPos) {
            popup.style.left = screenPos.x + 'px'
            popup.style.top = screenPos.y + 'px'
        } else {
            // Fallback to center
            popup.style.left = '50%'
            popup.style.top = '40%'
        }
        
        uiContainer.appendChild(popup)
        
        // Animate with scale pulse and upward float
        requestAnimationFrame(() => {
            popup.style.transform = 'translate(-50%, -50%) scale(1.2)'
            popup.style.opacity = '1'
            
            setTimeout(() => {
                popup.style.transform = 'translate(-50%, -150%) scale(1.0)'
                popup.style.opacity = '0'
            }, 100)
        })
        
        // Remove after animation
        setTimeout(() => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup)
            }
        }, 900)
    }
    
    /**
     * Convert world position to screen coordinates
     */
    worldToScreen(worldPos) {
        if (!this.camera || !this.view) return null
        
        try {
            // Get camera matrices
            const viewMatrix = this.camera.getViewMatrix()
            const projectionMatrix = this.camera.getProjectionMatrix()
            
            // Transform world to view space
            const viewX = viewMatrix[0] * worldPos.x + viewMatrix[4] * worldPos.y + viewMatrix[8] * worldPos.z + viewMatrix[12]
            const viewY = viewMatrix[1] * worldPos.x + viewMatrix[5] * worldPos.y + viewMatrix[9] * worldPos.z + viewMatrix[13]
            const viewZ = viewMatrix[2] * worldPos.x + viewMatrix[6] * worldPos.y + viewMatrix[10] * worldPos.z + viewMatrix[14]
            
            // Transform view to clip space
            const clipX = projectionMatrix[0] * viewX + projectionMatrix[8] * viewZ
            const clipY = projectionMatrix[5] * viewY + projectionMatrix[9] * viewZ
            const clipW = -viewZ
            
            if (clipW <= 0) return null // Behind camera
            
            // Normalize device coordinates
            const ndcX = clipX / clipW
            const ndcY = clipY / clipW
            
            // Convert to screen coordinates
            const viewport = this.view.getViewport()
            const screenX = (ndcX * 0.5 + 0.5) * viewport[2]
            const screenY = (1.0 - (ndcY * 0.5 + 0.5)) * viewport[3]
            
            return { x: screenX, y: screenY }
        } catch (e) {
            return null
        }
    }
    
    /**
     * Trigger subtle screen flash at collectible position
     */
    triggerCollectionFlash(pos, color) {
        // Create a brief point light at the collection position
        const lightEntity = this.Filament.EntityManager.get().create()
        
        // Create a small emissive sphere for the flash
        const flashEntity = this.Filament.EntityManager.get().create()
        const flashMatInstance = this.material.createInstance()
        flashMatInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [color.r, color.g, color.b])
        flashMatInstance.setFloatParameter('roughness', 0.0)
        
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.3, 0.3, 0.3] })
            .material(0, flashMatInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(false)
            .castShadows(false)
            .build(this.engine, flashEntity)
        
        this.scene.addEntity(flashEntity)
        
        this.visualParticles.push({
            entity: flashEntity,
            matInstance: flashMatInstance,
            spawnTime: Date.now(),
            pos: { x: pos.x, y: pos.y, z: pos.z },
            duration: 150,
            isCollectionFlash: true,
            maxScale: 1.5
        })
    }

    /**
     * Activates a checkpoint with visual effects:
     * - Screen flash (200-300ms white fade)
     * - Particle burst (30-50 particles, cyan/blue, upward burst)
     * - Ring pulse (expanding cyan ring)
     * - Enhanced glow on checkpoint material and point light
     */
    activateCheckpoint(checkpoint, marble) {
        if (checkpoint.activated) return
        
        checkpoint.activated = true
        
        // Change material to bright green/yellow activated color
        if (checkpoint.matInstance) {
            checkpoint.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 0.9, 0.0])
            checkpoint.matInstance.setFloatParameter('roughness', 0.2)
        }
        
        // Enhance point light if present
        if (checkpoint.lightEntity) {
            const lightManager = this.engine.getLightManager()
            const lightInst = lightManager.getInstance(checkpoint.lightEntity)
            lightManager.setIntensity(lightInst, 50000.0) // Boost intensity
            lightManager.setColor(lightInst, [0.0, 1.0, 0.5]) // Shift to green
        }
        
        // Trigger screen flash
        this.triggerCheckpointFlash()
        
        // Create particle burst
        this.createCheckpointParticles(checkpoint.pos)
        
        // Create ring pulse
        this.createCheckpointRing(checkpoint.pos)
        
        // Play sound
        audio.playGoal()
        
        // Update respawn position
        marble.respawnPos = { x: checkpoint.pos.x, y: checkpoint.pos.y + 1.0, z: checkpoint.pos.z }
        
        console.log(`[GAME] Checkpoint activated by ${marble.name || 'marble'}! New respawn set.`)
    }
    
    /**
     * Triggers a brief white screen flash overlay
     */
    triggerCheckpointFlash() {
        const flashOverlay = document.getElementById('checkpoint-flash-overlay')
        if (!flashOverlay) return
        
        // Reset and trigger flash
        flashOverlay.style.opacity = '0.8'
        flashOverlay.style.transition = 'none'
        
        // Force reflow
        flashOverlay.getBoundingClientRect()
        
        // Fade out over 250ms
        flashOverlay.style.transition = 'opacity 250ms ease-out'
        flashOverlay.style.opacity = '0'
    }
    
    /**
     * Creates a burst of 30-50 cyan/blue particles from checkpoint position
     */
    createCheckpointParticles(pos) {
        const particleCount = 35 + Math.floor(Math.random() * 15) // 35-50 particles
        
        for (let i = 0; i < particleCount; i++) {
            const particleEntity = this.Filament.EntityManager.get().create()
            const particleMat = this.material.createInstance()
            
            // Cyan/blue color variations
            const hue = Math.random()
            const r = 0.0
            const g = 0.6 + hue * 0.4  // 0.6 to 1.0
            const b = 0.8 + hue * 0.2  // 0.8 to 1.0
            
            particleMat.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
            particleMat.setFloatParameter('roughness', 0.3)
            
            this.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [0.1, 0.1, 0.1] })
                .material(0, particleMat)
                .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
                .receiveShadows(false)
                .castShadows(false)
                .build(this.engine, particleEntity)
            
            this.scene.addEntity(particleEntity)
            
            // Random upward velocity with spread
            const angle = Math.random() * Math.PI * 2
            const spread = Math.random() * 0.5
            const upwardSpeed = 3.0 + Math.random() * 4.0
            
            this.visualParticles.push({
                entity: particleEntity,
                matInstance: particleMat,
                spawnTime: Date.now(),
                pos: { 
                    x: pos.x + (Math.random() - 0.5) * 2, 
                    y: pos.y + (Math.random() - 0.5), 
                    z: pos.z + (Math.random() - 0.5) * 2 
                },
                vel: {
                    x: Math.cos(angle) * spread,
                    y: upwardSpeed,
                    z: Math.sin(angle) * spread
                },
                duration: 1000 + Math.random() * 1000, // 1-2 seconds
                scale: 1.0,
                isCheckpointParticle: true
            })
        }
    }
    
    /**
     * Creates an expanding ring pulse from checkpoint center
     */
    createCheckpointRing(pos) {
        const ringEntity = this.Filament.EntityManager.get().create()
        const ringMat = this.material.createInstance()
        
        // Cyan ring color
        ringMat.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 0.9, 1.0])
        ringMat.setFloatParameter('roughness', 0.2)
        
        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.05, 0.5] })
            .material(0, ringMat)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(false)
            .castShadows(false)
            .build(this.engine, ringEntity)
        
        this.scene.addEntity(ringEntity)
        
        this.visualParticles.push({
            entity: ringEntity,
            matInstance: ringMat,
            spawnTime: Date.now(),
            pos: { x: pos.x, y: pos.y, z: pos.z },
            vel: { x: 0, y: 0, z: 0 },
            duration: 1000, // 1 second
            scale: 1.0,
            isCheckpointRing: true,
            startRadius: 1.0,
            maxRadius: 8.0 // 3x typical checkpoint size
        })
    }

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
            .receiveShadows(true)
            .castShadows(true)
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

        if (this.playerMarble) {
            const linvel = this.playerMarble.rigidBody.linvel()
            const horizSpeed = Math.hypot(linvel.x, linvel.z)

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

                if (this.trickState.airTime > 60) {
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

            if (wallContact && horizSpeed > 15.0 && this.wallRideTime < 90) {
                if (!this.isWallRiding) {
                    this.isWallRiding = true
                    this.trickState.wallRides += 1
                }

                const mass = rb.mass()
                const gravityDir = rb.gravityScale() < 0 ? -1 : 1
                rb.applyImpulse({ x: 0, y: 9.81 * mass * (1.0/60.0) * gravityDir, z: 0 }, true)
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

    showLevelCompleteModal(completionTime, newRecord) {
        const modal = document.getElementById('level-complete-modal')
        if (!modal) return

        const level = LEVELS[this.currentLevel]
        const levelName = level?.name || this.currentLevel

        // Format time as MM:SS.ms
        const minutes = Math.floor(completionTime / 60)
        const seconds = Math.floor(completionTime % 60)
        const milliseconds = Math.floor((completionTime % 1) * 10)
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds}`

        // Determine medal based on time
        let medal = ''
        let medalEmoji = ''
        if (completionTime < 30) {
            medal = 'gold'
            medalEmoji = '🥇'
        } else if (completionTime < 60) {
            medal = 'silver'
            medalEmoji = '🥈'
        } else if (completionTime < 120) {
            medal = 'bronze'
            medalEmoji = '🥉'
        } else {
            medalEmoji = '⭐'
        }

        // Calculate score breakdown
        const baseScore = this.score || 0
        const timeBonus = Math.max(0, Math.floor((180 - completionTime) * 10))
        const maxCombo = this.combo || 1
        const comboBonus = (maxCombo - 1) * 50
        const totalScore = baseScore + timeBonus + comboBonus

        // Update modal content
        document.getElementById('modal-level-name').textContent = levelName
        document.getElementById('modal-completion-time').textContent = formattedTime
        document.getElementById('modal-medal').textContent = medalEmoji
        document.getElementById('modal-base-score').textContent = baseScore.toLocaleString()
        document.getElementById('modal-time-bonus').textContent = `+${timeBonus.toLocaleString()}`
        document.getElementById('modal-combo-bonus').textContent = `+${comboBonus.toLocaleString()}`
        document.getElementById('modal-total-score').textContent = totalScore.toLocaleString()

        const newRecordBadge = document.getElementById('modal-new-record')
        if (newRecordBadge) {
            newRecordBadge.style.display = newRecord ? 'inline-block' : 'none'
        }

        // Setup button handlers with smooth transitions
        const btnNext = document.getElementById('btn-next-level')
        const btnRetry = document.getElementById('btn-retry')
        const btnMenu = document.getElementById('btn-main-menu')

        // Get ordered list of level IDs
        const levelIds = Object.keys(LEVELS)
        const currentIndex = levelIds.indexOf(this.currentLevel)
        const nextLevelId = levelIds[currentIndex + 1]

        if (btnNext) {
            btnNext.onclick = () => {
                this.hideLevelCompleteModal(() => {
                    if (nextLevelId && typeof this.loadLevel === 'function') {
                        this.loadLevel(nextLevelId)
                    } else if (typeof this.returnToMenu === 'function') {
                        this.returnToMenu()
                    }
                })
            }
            btnNext.style.display = nextLevelId ? 'block' : 'none'
        }

        if (btnRetry) {
            btnRetry.onclick = () => {
                this.hideLevelCompleteModal(() => {
                    if (typeof this.loadLevel === 'function') {
                        this.loadLevel(this.currentLevel)
                    }
                })
            }
        }

        if (btnMenu) {
            btnMenu.onclick = () => {
                this.hideLevelCompleteModal(() => {
                    if (typeof this.returnToMenu === 'function') {
                        this.returnToMenu()
                    }
                })
            }
        }

        // Blur game view and show modal with animation
        modal.classList.remove('exiting')
        modal.classList.add('active')

        // Trigger confetti after modal appears
        setTimeout(() => {
            this.startConfetti()
        }, 300)
    }

    hideLevelCompleteModal(callback) {
        const modal = document.getElementById('level-complete-modal')
        if (modal) {
            // Add exit animation class
            modal.classList.add('exiting')
            
            // Stop confetti immediately
            this.stopConfetti()
            
            // Wait for exit animation to complete before hiding
            setTimeout(() => {
                modal.classList.remove('active', 'exiting')
                if (callback) callback()
            }, 400)
        } else if (callback) {
            callback()
        }
    }

    startConfetti() {
        const canvas = document.getElementById('confetti-canvas')
        if (!canvas) return

        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const ctx = canvas.getContext('2d')
        const particles = []
        const colors = ['#e94560', '#ffd700', '#00ffff', '#ff00ff', '#00ff88', '#ff8800', '#ffffff']

        // Create particles
        for (let i = 0; i < 150; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 1) * 15 - 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 8 + 4,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                gravity: 0.3,
                drag: 0.99
            })
        }

        let animationId = null
        let frameCount = 0

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            frameCount++

            let activeParticles = 0

            for (const p of particles) {
                // Update physics
                p.vy += p.gravity
                p.vx *= p.drag
                p.vy *= p.drag
                p.x += p.vx
                p.y += p.vy
                p.rotation += p.rotationSpeed

                // Draw particle
                ctx.save()
                ctx.translate(p.x, p.y)
                ctx.rotate(p.rotation)
                ctx.fillStyle = p.color
                ctx.globalAlpha = Math.max(0, 1 - frameCount / 300) // Fade out over time
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
                ctx.restore()

                if (p.y < canvas.height + 50 && ctx.globalAlpha > 0) {
                    activeParticles++
                }
            }

            // Stop animation after 5 seconds or when all particles are gone
            if (frameCount < 300 && activeParticles > 0) {
                animationId = requestAnimationFrame(animate)
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height)
            }
        }

        // Store animation ID for cleanup
        this.confettiAnimationId = animationId
        animate()

        // Auto-stop after 5 seconds
        this.confettiTimeout = setTimeout(() => this.stopConfetti(), 5000)
    }

    stopConfetti() {
        if (this.confettiAnimationId) {
            cancelAnimationFrame(this.confettiAnimationId)
            this.confettiAnimationId = null
        }
        if (this.confettiTimeout) {
            clearTimeout(this.confettiTimeout)
            this.confettiTimeout = null
        }
        const canvas = document.getElementById('confetti-canvas')
        if (canvas) {
            const ctx = canvas.getContext('2d')
            ctx.clearRect(0, 0, canvas.width, canvas.height)
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
