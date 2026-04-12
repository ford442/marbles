import { quaternionToMat4, quatFromEuler } from './math.js';

export class GameLoopSyncMethods {
    syncTransformsAndRender(now) {
        // Handle visual particles lifecycle
        for (let i = this.visualParticles.length - 1; i >= 0; i--) {
            const p = this.visualParticles[i]
            const timeAlive = now - p.spawnTime

            if (timeAlive > p.duration) {
                this.scene.remove(p.entity)
                if (p.matInstance) this.engine.destroyMaterialInstance(p.matInstance)
                this.engine.destroyEntity(p.entity)
                this.Filament.EntityManager.get().destroy(p.entity)
                this.visualParticles.splice(i, 1)
            } else {
                if (p.isEMPRing) {
                    // EMP shockwave ring effect
                    const progress = timeAlive / p.duration
                    
                    // Expand from start radius to max radius
                    const currentRadius = p.startRadius + (p.maxRadius - p.startRadius) * progress
                    p.scale = currentRadius / p.startRadius
                    
                    // Fade opacity as it expands - cyan to transparent
                    const opacity = 1.0 - progress
                    const r = 0.0
                    const g = 0.8 + progress * 0.2  // Slight color shift as it fades
                    const b = 1.0
                    
                    if (p.matInstance) {
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
                    }

                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4(p.pos, { x: 0, y: 0, z: 0, w: 1 })

                    // Scale XZ for the expanding ring, Y stays thin
                    const sXZ = currentRadius
                    const sY = 0.05 * (1.0 - progress * 0.5)  // Gets slightly thinner
                    mat[0] *= sXZ; mat[1] *= sXZ; mat[2] *= sXZ
                    mat[4] *= sY; mat[5] *= sY; mat[6] *= sY
                    mat[8] *= sXZ; mat[9] *= sXZ; mat[10] *= sXZ

                    tcm.setTransform(inst, mat)
                } else if (p.isEMPSpark) {
                    // EMP spark particle effect
                    p.pos.x += p.vel.x * 0.016
                    p.pos.y += p.vel.y * 0.016
                    p.pos.z += p.vel.z * 0.016

                    // Sparks shrink and fade quickly
                    const progress = timeAlive / p.duration
                    p.scale = Math.max(0, 1.0 - progress * progress)  // Quadratic fade

                    if (p.matInstance) {
                        // Bright cyan to fading blue
                        const r = 0.2 * (1.0 - progress)
                        const g = 0.9 * (1.0 - progress * 0.5)
                        const b = 1.0
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
                    }

                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4(p.pos, { x: 0, y: 0, z: 0, w: 1 })

                    const s = 0.2 * p.scale
                    mat[0] *= s; mat[1] *= s; mat[2] *= s
                    mat[4] *= s; mat[5] *= s; mat[6] *= s
                    mat[8] *= s; mat[9] *= s; mat[10] *= s

                    tcm.setTransform(inst, mat)
                } else if (p.isRing) {
                    const progress = timeAlive / p.duration
                    p.scale = 1.0 + progress * 20.0

                    if (p.matInstance) {
                        const r = 1.0 - progress
                        const g = 0.2 - progress * 0.2
                        const b = 0.0
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
                    }

                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4(p.pos, { x: 0, y: 0, z: 0, w: 1 })

                    const sXZ = 0.1 * p.scale
                    const sY = 0.1 * (1.0 - progress)
                    mat[0] *= sXZ; mat[1] *= sXZ; mat[2] *= sXZ
                    mat[4] *= sY; mat[5] *= sY; mat[6] *= sY
                    mat[8] *= sXZ; mat[9] *= sXZ; mat[10] *= sXZ

                    tcm.setTransform(inst, mat)
                } else if (p.isGoalParticle) {
                    // Goal fountain particle - rises then fades
                    p.pos.x += p.vel.x * 0.016
                    p.pos.y += p.vel.y * 0.016
                    p.pos.z += p.vel.z * 0.016
                    
                    // Add gravity slowdown
                    p.vel.y *= 0.98
                    p.vel.x += (Math.random() - 0.5) * 0.02
                    p.vel.z += (Math.random() - 0.5) * 0.02

                    const progress = timeAlive / p.duration
                    p.scale = Math.max(0, 1.0 - progress * progress)

                    if (p.matInstance) {
                        // Gold to amber fade
                        const r = 1.0
                        const g = 0.9 - progress * 0.5
                        const b = 0.3 - progress * 0.3
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
                    }

                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4(p.pos, { x: 0, y: 0, z: 0, w: 1 })

                    const s = 0.15 * p.scale
                    mat[0] *= s; mat[1] *= s; mat[2] *= s
                    mat[4] *= s; mat[5] *= s; mat[6] *= s
                    mat[8] *= s; mat[9] *= s; mat[10] *= s

                    tcm.setTransform(inst, mat)
                } else if (p.isCheckpointParticle) {
                    // Checkpoint burst particle - upward burst with gravity
                    p.pos.x += p.vel.x * 0.016
                    p.pos.y += p.vel.y * 0.016
                    p.pos.z += p.vel.z * 0.016
                    
                    // Apply gravity
                    p.vel.y -= 9.81 * 0.016 * 0.3 // Reduced gravity for slower fall
                    
                    // Slow expansion
                    p.vel.x *= 0.98
                    p.vel.z *= 0.98

                    const progress = timeAlive / p.duration
                    p.scale = Math.max(0, 1.0 - progress)

                    if (p.matInstance) {
                        // Cyan/blue to fading white
                        const fade = 1.0 - progress
                        const r = progress * 0.5
                        const g = 0.6 + progress * 0.4 * fade
                        const b = 0.8 + progress * 0.2 * fade
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
                    }

                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4(p.pos, { x: 0, y: 0, z: 0, w: 1 })

                    const s = 0.15 * p.scale
                    mat[0] *= s; mat[1] *= s; mat[2] *= s
                    mat[4] *= s; mat[5] *= s; mat[6] *= s
                    mat[8] *= s; mat[9] *= s; mat[10] *= s

                    tcm.setTransform(inst, mat)
                } else if (p.isCheckpointRing) {
                    // Checkpoint expanding ring pulse
                    const progress = timeAlive / p.duration
                    
                    // Expand from start radius to max radius
                    const currentRadius = p.startRadius + (p.maxRadius - p.startRadius) * progress
                    p.scale = currentRadius / p.startRadius
                    
                    // Fade opacity as it expands - cyan to transparent
                    const fade = 1.0 - progress
                    const r = 0.0
                    const g = 0.9 * fade
                    const b = 1.0 * fade
                    
                    if (p.matInstance) {
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
                    }

                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4(p.pos, { x: 0, y: 0, z: 0, w: 1 })

                    // Scale XZ for the expanding ring, Y stays very thin
                    const sXZ = currentRadius
                    const sY = 0.05 * fade // Gets thinner as it fades
                    mat[0] *= sXZ; mat[1] *= sXZ; mat[2] *= sXZ
                    mat[4] *= sY; mat[5] *= sY; mat[6] *= sY
                    mat[8] *= sXZ; mat[9] *= sXZ; mat[10] *= sXZ

                    tcm.setTransform(inst, mat)
                } else if (p.isCollectionParticle) {
                    // Collection burst particle - sparkles with gravity
                    const progress = timeAlive / p.duration
                    
                    // Apply physics with gravity
                    p.vel.y -= 4.0 * 0.016  // Gravity
                    p.pos.x += p.vel.x * 0.016
                    p.pos.y += p.vel.y * 0.016
                    p.pos.z += p.vel.z * 0.016
                    
                    // Particles shrink and fade
                    p.scale = Math.max(0, 1.0 - progress * progress)
                    
                    // Color brightens then fades
                    if (p.matInstance) {
                        const brightness = 1.0 - progress * 0.5
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [brightness, brightness * 0.9, brightness * 0.5])
                    }
                    
                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    
                    // Add rotation
                    const rotY = (p.rotationSpeed || 0) * timeAlive * 0.01
                    const mat = quaternionToMat4(p.pos, quatFromEuler(0, rotY, 0))
                    
                    const s = 0.15 * p.scale
                    mat[0] *= s; mat[1] *= s; mat[2] *= s
                    mat[4] *= s; mat[5] *= s; mat[6] *= s
                    mat[8] *= s; mat[9] *= s; mat[10] *= s
                    
                    tcm.setTransform(inst, mat)
                } else if (p.isCollectionRing) {
                    // Collection ring - expands outward with fade
                    const progress = timeAlive / p.duration
                    
                    // Expand ring
                    const currentRadius = p.startRadius + (p.maxRadius - p.startRadius) * progress
                    
                    // Fade color to transparent
                    if (p.matInstance) {
                        const opacity = 1.0 - progress
                        const r = p.color.r * opacity + 1.0 * (1.0 - opacity)
                        const g = p.color.g * opacity + 1.0 * (1.0 - opacity)
                        const b = p.color.b * opacity + 1.0 * (1.0 - opacity)
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
                    }
                    
                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4(p.pos, { x: 0, y: 0, z: 0, w: 1 })
                    
                    // Scale ring outward, getting thinner
                    const sXZ = currentRadius
                    const sY = 0.05 * (1.0 - progress)
                    mat[0] *= sXZ; mat[1] *= sXZ; mat[2] *= sXZ
                    mat[4] *= sY; mat[5] *= sY; mat[6] *= sY
                    mat[8] *= sXZ; mat[9] *= sXZ; mat[10] *= sXZ
                    
                    tcm.setTransform(inst, mat)
                } else if (p.isCollectionRay) {
                    // Collection rays - shoot outward
                    const progress = timeAlive / p.duration
                    
                    p.pos.x += p.vel.x * 0.016
                    p.pos.y += p.vel.y * 0.016
                    p.pos.z += p.vel.z * 0.016
                    
                    // Rays stretch and fade
                    p.scale = 1.0 - progress
                    
                    if (p.matInstance) {
                        const brightness = 1.0 - progress * 0.5
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [1.0, 1.0, brightness])
                    }
                    
                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    
                    // Orient ray along velocity direction
                    const yaw = p.angle
                    const mat = quaternionToMat4(p.pos, quatFromEuler(0, yaw, 0))
                    
                    const sXZ = 0.03 * p.scale
                    const sY = 0.03 * p.scale
                    const sZ = 0.4 * p.scale * (1.0 + progress)  // Stretch as it moves
                    mat[0] *= sXZ; mat[1] *= sXZ; mat[2] *= sXZ
                    mat[4] *= sY; mat[5] *= sY; mat[6] *= sY
                    mat[8] *= sZ; mat[9] *= sZ; mat[10] *= sZ
                    
                    tcm.setTransform(inst, mat)
                } else if (p.isCollectionFlash) {
                    // Collection flash - quick expand and fade
                    const progress = timeAlive / p.duration
                    
                    // Rapid expansion
                    const scale = p.maxScale * (1.0 - Math.pow(progress, 2))
                    
                    // Quick fade
                    if (p.matInstance) {
                        const brightness = 1.0 - progress
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [brightness, brightness * 0.9, brightness * 0.5])
                    }
                    
                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4(p.pos, { x: 0, y: 0, z: 0, w: 1 })
                    
                    mat[0] *= scale; mat[1] *= scale; mat[2] *= scale
                    mat[4] *= scale; mat[5] *= scale; mat[6] *= scale
                    mat[8] *= scale; mat[9] *= scale; mat[10] *= scale
                    
                    tcm.setTransform(inst, mat)
                } else {
                    p.pos.x += p.vel.x * 0.016
                    p.pos.y += p.vel.y * 0.016
                    p.pos.z += p.vel.z * 0.016

                    p.scale = Math.max(0, 1.0 - (timeAlive / p.duration))

                    if (p.matInstance) {
                        const progress = timeAlive / p.duration
                        const r = 1.0 - progress * 0.8
                        const g = 0.6 - progress * 0.6
                        const b = 0.0
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
                    }

                    const tcm = this.engine.getTransformManager()
                    const inst = tcm.getInstance(p.entity)
                    const mat = quaternionToMat4(p.pos, { x: 0, y: 0, z: 0, w: 1 })

                    const s = 0.2 * p.scale
                    mat[0] *= s; mat[1] *= s; mat[2] *= s
                    mat[4] *= s; mat[5] *= s; mat[6] *= s
                    mat[8] *= s; mat[9] *= s; mat[10] *= s

                    tcm.setTransform(inst, mat)
                }
            }
        }

        // Handle temporary platforms lifecycle
        for (let i = this.temporaryPlatforms.length - 1; i >= 0; i--) {
            const p = this.temporaryPlatforms[i]
            const timeAlive = now - p.spawnTime
            const maxDuration = p.duration || this.holoDuration

            if (timeAlive > maxDuration) {
                this.world.removeRigidBody(p.rigidBody)
                this.scene.remove(p.entity)
                if (p.matInstance) this.engine.destroyMaterialInstance(p.matInstance)
                this.engine.destroyEntity(p.entity)
                this.Filament.EntityManager.get().destroy(p.entity)
                this.temporaryPlatforms.splice(i, 1)
            } else {
                const timeLeft = maxDuration - timeAlive
                if (timeLeft < 1000) {
                    const blink = Math.floor(now / 100) % 2 === 0
                    if (p.matInstance && !p.duration) {
                        const color = blink ? [1.0, 0.0, 0.0] : [0.0, 1.0, 1.0]
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color)
                    } else if (p.matInstance && p.duration) {
                        const color = blink ? [1.0, 1.0, 1.0] : [0.5, 0.9, 1.0]
                        p.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color)
                    }
                }
            }
        }

        // Skip physics and game logic when paused
        if (!this.isPaused) {
            this.world.step()
            this.processCollisionEvents()
            this.checkGameLogic()
        }

        const tcm = this.engine.getTransformManager()
        for (const m of this.marbles) {
            const t = m.rigidBody.translation()
            const r = m.rigidBody.rotation()
            const mat = quaternionToMat4(t, r)

            if (m.scale && m.scale !== 1.0) {
                mat[0] *= m.scale; mat[1] *= m.scale; mat[2] *= m.scale
                mat[4] *= m.scale; mat[5] *= m.scale; mat[6] *= m.scale
                mat[8] *= m.scale; mat[9] *= m.scale; mat[10] *= m.scale
            }

            const inst = tcm.getInstance(m.entity)
            tcm.setTransform(inst, mat)

            if (m.rainbow) {
                const time = Date.now() * 0.002
                const r = Math.sin(time) * 0.5 + 0.5
                const g = Math.sin(time + 2.094) * 0.5 + 0.5
                const b = Math.sin(time + 4.188) * 0.5 + 0.5
                const rcm = this.engine.getRenderableManager()
                const renderInst = rcm.getInstance(m.entity)
                rcm.getMaterialInstanceAt(renderInst, 0).setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [r, g, b])
            }

            if (m.lightEntity) {
                const lightInst = tcm.getInstance(m.lightEntity)
                const lightMat = quaternionToMat4(t, { x: 0, y: 0, z: 0, w: 1 })
                tcm.setTransform(lightInst, lightMat)
            }
        }

        for (const obj of this.dynamicObjects) {
            const t = obj.rigidBody.translation()
            const r = obj.rigidBody.rotation()
            const mat = quaternionToMat4(t, r)

            if (obj.halfExtents) {
                const sx = obj.halfExtents.x * 2
                const sy = obj.halfExtents.y * 2
                const sz = obj.halfExtents.z * 2
                mat[0] *= sx; mat[1] *= sx; mat[2] *= sx
                mat[4] *= sy; mat[5] *= sy; mat[6] *= sy
                mat[8] *= sz; mat[9] *= sz; mat[10] *= sz
            }

            const inst = tcm.getInstance(obj.entity)
            tcm.setTransform(inst, mat)
        }

        if (this.cameraMode === 'follow' && this.playerMarble && this.charging && this.cueInst) {
            const cosP = Math.cos(this.pitchAngle)
            const sinP = Math.sin(this.pitchAngle)
            const dirX = Math.sin(this.aimYaw) * cosP
            const dirY = sinP
            const dirZ = Math.cos(this.aimYaw) * cosP
            const length = 0.5 + this.chargePower * 2.5
            const r = this.playerMarble.scale * 0.5 || 0.5
            const marbleT = this.playerMarble.rigidBody.translation()
            const cuePos = {
                x: marbleT.x - dirX * (r + 0.2),
                y: marbleT.y - dirY * (r + 0.2),
                z: marbleT.z - dirZ * (r + 0.2)
            }
            const quat = quatFromEuler(this.aimYaw, this.pitchAngle, 0)
            let mat = quaternionToMat4(cuePos, quat)
            const thin = 0.04
            mat[0] *= thin; mat[1] *= thin; mat[2] *= thin
            mat[4] *= thin; mat[5] *= thin; mat[6] *= thin
            mat[8] *= length; mat[9] *= length; mat[10] *= length
            this.engine.getTransformManager().setTransform(this.cueInst, mat)
        } else if (this.cueInst) {
            const zeroMat = new Float32Array(16)
            zeroMat[15] = 1
            this.engine.getTransformManager().setTransform(this.cueInst, zeroMat)
        }

        // Render speed lines overlay
        if (this.renderSpeedLines) {
            this.renderSpeedLines()
        }

        if (this.renderer && this.swapChain && this.view) {
            if (this.renderer.beginFrame(this.swapChain)) {
                this.renderer.renderView(this.view)
                this.renderer.endFrame()
            }
            this.engine.execute()
        }
    }
}

export function applyGameLoopSyncMethods(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopSyncMethods.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopSyncMethods.prototype[name];
        }
    }
}
