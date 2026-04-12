import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from './audio.js';
import { marblesInfo } from './marbles_data.js';
import { quaternionToMat4 } from './math.js';
import { materialPresets } from './material-system.js';

export class MarbleManagementMethods {
    createMarbles(spawnPos) {
        const baseSpawn = spawnPos || { x: 0, y: 8, z: -12 }

        for (const info of marblesInfo) {
            const radius = info.radius || 0.5
            const scale = radius / 0.5
            const pos = {
                x: baseSpawn.x + info.offset.x,
                y: baseSpawn.y + info.offset.y,
                z: baseSpawn.z + info.offset.z
            }

            const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(pos.x, pos.y, pos.z)
                .setCanSleep(false)

            if (info.gravityScale !== undefined) bodyDesc.setGravityScale(info.gravityScale)
            if (info.linearDamping !== undefined) bodyDesc.setLinearDamping(info.linearDamping)
            if (info.angularDamping !== undefined) bodyDesc.setAngularDamping(info.angularDamping)

            const rigidBody = this.world.createRigidBody(bodyDesc)

            const colliderDesc = RAPIER.ColliderDesc.ball(radius)
                .setRestitution(info.restitution !== undefined ? info.restitution : 0.5)

            if (info.density) colliderDesc.setDensity(info.density)
            if (info.friction !== undefined) colliderDesc.setFriction(info.friction)

            const collider = this.world.createCollider(colliderDesc, rigidBody)

            const entity = this.Filament.EntityManager.get().create()
            const matInstance = this.material.createInstance()
            
            // Apply base color using bracket notation for sRGB (consistent with other methods)
            matInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, info.color)
            
            // Apply PBR material properties from preset, with marble-specific overrides
            const preset = info.materialType ? materialPresets[info.materialType] : null
            
            // Roughness: marble override > preset > default (0.4)
            const roughness = info.roughness !== undefined ? info.roughness : (preset ? preset.roughness : 0.4)
            matInstance.setFloatParameter('roughness', roughness)
            
            // Extended PBR parameters are only available in the procedural material
            if (this.hasProceduralMaterial) {
                if (preset) {
                    // Metallic: marble override > preset > 0.0
                    const metallic = info.metallic !== undefined ? info.metallic : preset.metallic
                    matInstance.setFloatParameter('metallic', metallic)
                    
                    // Reflectance: marble override > preset > 0.5
                    const reflectance = info.reflectance !== undefined ? info.reflectance : preset.reflectance
                    matInstance.setFloatParameter('reflectance', reflectance)
                    
                    // Clear coat: apply if preset has it (> 0)
                    if (preset.clearCoat > 0) {
                        const clearCoat = info.clearCoat !== undefined ? info.clearCoat : preset.clearCoat
                        matInstance.setFloatParameter('clearCoat', clearCoat)
                        const clearCoatRoughness = info.clearCoatRoughness !== undefined ? info.clearCoatRoughness : preset.clearCoatRoughness
                        matInstance.setFloatParameter('clearCoatRoughness', clearCoatRoughness)
                    }
                    
                    const bumpScale = info.bumpScale !== undefined ? info.bumpScale : (preset.bumpScale !== undefined ? preset.bumpScale : 0.02)
                    const bumpFrequency = info.bumpFrequency !== undefined ? info.bumpFrequency : (preset.bumpFrequency !== undefined ? preset.bumpFrequency : 50.0)
                    matInstance.setFloatParameter('bumpScale', bumpScale)
                    matInstance.setFloatParameter('bumpFrequency', bumpFrequency)
                } else {
                    // Default procedural bump for marbles without a preset
                    matInstance.setFloatParameter('bumpScale', info.bumpScale !== undefined ? info.bumpScale : 0.02)
                    matInstance.setFloatParameter('bumpFrequency', info.bumpFrequency !== undefined ? info.bumpFrequency : 50.0)
                }
            }

            const vb = info.geometry === 'cube' ? this.vb : this.sphereVb
            const ib = info.geometry === 'cube' ? this.ib : this.sphereIb

            this.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [radius, radius, radius] })
                .material(0, matInstance)
                .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, vb, ib)
                .receiveShadows(true)
                .castShadows(true)
                .build(this.engine, entity)

            this.scene.addEntity(entity)

            const marbleObj = {
                name: info.name || `Marble ${this.marbles.length + 1}`,
                rigidBody,
                collider,
                entity,
                scale,
                baseScale: scale,
                baseRadius: radius,
                baseRestitution: info.restitution !== undefined ? info.restitution : 0.5,
                baseFriction: info.friction !== undefined ? info.friction : 0.5,
                baseDensity: info.density,
                color: [...info.color],
                originalColor: [...info.color],
                initialPos: pos,
                respawnPos: { ...pos },
                scoredGoals: new Set(),
                rainbow: info.rainbow,
                baseGravityScale: info.gravityScale !== undefined ? info.gravityScale : 1.0,
                originalGravityScale: info.gravityScale !== undefined ? info.gravityScale : 1.0
            }

            if (info.emissive) {
                const lightEntity = this.Filament.EntityManager.get().create()
                this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].POINT)
                    .color(info.lightColor || info.color)
                    .intensity(info.lightIntensity || 10000.0)
                    .falloff(20.0)
                    .build(this.engine, lightEntity)
                this.scene.addEntity(lightEntity)
                marbleObj.lightEntity = lightEntity
            }

            this.marbles.push(marbleObj)
        }

        this.currentMarbleIndex = 0
        this.playerMarble = this.marbles[0]
        this.selectedEl.textContent = `Selected: ${this.playerMarble.name}`
    }

    getLeader() {
        let maxZ = -Infinity
        let leader = null
        for (const m of this.marbles) {
            const t = m.rigidBody.translation()
            if (t.z > maxZ) {
                maxZ = t.z
                leader = m
            }
        }
        return leader
    }

    resetMarbles() {
        audio.stopAllRolling()

        for (const m of this.marbles) {
            m.rigidBody.setTranslation(m.initialPos, true)
            m.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
            m.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
            m.scoredGoals.clear()
            m.respawnPos = { ...m.initialPos }

            // Reset Size Shift
            m.sizeState = 0
            if (m.scale !== m.baseScale) {
                if (m.collider) {
                    this.world.removeCollider(m.collider, true)
                }
                const desc = RAPIER.ColliderDesc.ball(m.baseRadius)
                    .setRestitution(m.baseRestitution !== undefined ? m.baseRestitution : 0.5)
                    .setFriction(m.baseFriction !== undefined ? m.baseFriction : 0.5)
                if (m.baseDensity) {
                    desc.setDensity(m.baseDensity)
                }
                m.collider = this.world.createCollider(desc, m.rigidBody)
                m.scale = m.baseScale
            }
        }

        for (const cp of this.checkpoints) {
            cp.activated = false
            if (cp.matInstance) {
                cp.matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, [0.0, 1.0, 1.0])
            }
        }

        this.score = 0
        this.scoreEl.textContent = 'Score: 0'
        this.combo = 1
        this.comboTimer = 0
        if (this.comboEl) {
            this.comboEl.style.display = 'none'
            this.comboEl.textContent = 'Combo: x1'
        }
        if (this.combobarContainerEl) this.combobarContainerEl.style.display = 'none'
        if (this.combobarEl) this.combobarEl.style.width = '0%'

        this.currentMarbleIndex = 0
        this.playerMarble = this.marbles[0]
        this.selectedEl.textContent = `Selected: ${this.playerMarble ? this.playerMarble.name : 'None'}`

        this.adrenaline = 0
        this.currentFov = this.baseFov
        if (this.nearMisses) this.nearMisses.clear()

        // Reset Chameleon State
        this.chameleonState = 0
        if (this.playerMarble) {
            // Restore actual marble's base state from marblesInfo or initial creation
            this.playerMarble.baseGravityScale = this.playerMarble.originalGravityScale || this.playerMarble.baseGravityScale || 1.0;
            this.playerMarble.rigidBody.setGravityScale(this.playerMarble.baseGravityScale, true)
            const rcm = this.engine.getRenderableManager()
            const inst = rcm.getInstance(this.playerMarble.entity)
            if (this.playerMarble.originalColor) {
                this.playerMarble.color = [...this.playerMarble.originalColor]
                rcm.getMaterialInstanceAt(inst, 0).setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, this.playerMarble.originalColor)
            }
        }

        this.flipActive = false
        this.jetpackActive = false
        this.aimYaw = 0
        this.chargePower = 0
        this.charging = false
        this.powerbarEl.style.width = '0%'
        this.levelComplete = false
        this.rewindHistory = []
        this.ghostRecording = []
        this.ghostPlaybackIndex = 0
        this.levelStartTime = Date.now()

        if (this.portalA) this.destroyPortal(this.portalA)
        if (this.portalB) this.destroyPortal(this.portalB)
        this.portalA = null
        this.portalB = null
        document.getElementById('portal-a-status').style.color = '#444'
        document.getElementById('portal-b-status').style.color = '#444'

        if (this.activeMissiles) {
            for (const m of this.activeMissiles) {
                this.world.removeRigidBody(m.rigidBody)
                this.scene.remove(m.entity)
                if (m.matInstance) this.engine.destroyMaterialInstance(m.matInstance)
                this.engine.destroyEntity(m.entity)
                this.Filament.EntityManager.get().destroy(m.entity)

                if (m.lightEntity) {
                    this.scene.remove(m.lightEntity)
                    this.engine.destroyEntity(m.lightEntity)
                    this.Filament.EntityManager.get().destroy(m.lightEntity)
                }
            }
            this.activeMissiles = []
        }

        if (this.activeBombs) {
            for (const b of this.activeBombs) {
                this.world.removeRigidBody(b.rigidBody)
                this.scene.remove(b.entity)
                if (b.matInstance) this.engine.destroyMaterialInstance(b.matInstance)
                this.engine.destroyEntity(b.entity)
                this.Filament.EntityManager.get().destroy(b.entity)

                if (b.lightEntity) {
                    this.scene.remove(b.lightEntity)
                    this.engine.destroyEntity(b.lightEntity)
                    this.Filament.EntityManager.get().destroy(b.lightEntity)
                }
            }
            this.activeBombs = []
        }

        if (this.activeMissiles) {
            for (const m of this.activeMissiles) {
                this.world.removeRigidBody(m.rigidBody)
                this.scene.remove(m.entity)
                if (m.matInstance) this.engine.destroyMaterialInstance(m.matInstance)
                this.engine.destroyEntity(m.entity)
                this.Filament.EntityManager.get().destroy(m.entity)

                if (m.lightEntity) {
                    this.scene.remove(m.lightEntity)
                    this.engine.destroyEntity(m.lightEntity)
                    this.Filament.EntityManager.get().destroy(m.lightEntity)
                }
            }
            this.activeMissiles = []
        }

        if (this.activeBlackHoles) {
            for (const bh of this.activeBlackHoles) {
                this.world.removeRigidBody(bh.rigidBody)
                this.scene.remove(bh.entity)
                if (bh.matInstance) this.engine.destroyMaterialInstance(bh.matInstance)
                this.engine.destroyEntity(bh.entity)
                this.Filament.EntityManager.get().destroy(bh.entity)

                if (bh.lightEntity) {
                    this.scene.remove(bh.lightEntity)
                    this.engine.destroyEntity(bh.lightEntity)
                    this.Filament.EntityManager.get().destroy(bh.lightEntity)
                }
            }
            this.activeBlackHoles = []
        }
    }

    returnToMenu() {
        audio.stopAllRolling()
        this.clearLevel()
        this.showLevelSelection()
    }

    processCollisionEvents() {
        if (!this.world) return

        const processedCollisions = new Set()
        const touchingSurfaces = new Map()

        for (let i = 0; i < this.marbles.length; i++) {
            const marble = this.marbles[i]
            const rb = marble.rigidBody
            const velocity = rb.linvel()
            const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
            const angVel = rb.angvel()
            const angularSpeed = Math.hypot(angVel.x, angVel.y, angVel.z)

            const radius = marble.scale * 0.5 || 0.5
            const pos = rb.translation()

            const rayOrigin = { x: pos.x, y: pos.y, z: pos.z }
            const rayDir = { x: 0, y: this.flipActive ? 1 : -1, z: 0 }
            const ray = new RAPIER.Ray(rayOrigin, rayDir)
            const maxToi = radius + 0.1

            const hit = this.world.castRay(ray, maxToi, true)
            if (hit) {
                const otherCollider = hit.collider
                const otherBody = otherCollider.parent()

                if (otherBody && otherBody !== rb) {
                    if (otherBody.bodyType() === RAPIER.RigidBodyType.Fixed) {
                        const material = audio.getMaterial(otherBody.handle)

                        touchingSurfaces.set(i, { material, speed, angularSpeed, radius })

                        const collisionId = `${rb.handle}-${otherBody.handle}`
                        if (!processedCollisions.has(collisionId) && speed > 2.5) {
                            processedCollisions.add(collisionId)
                            audio.playSurfaceHit(speed, radius, material, `surface-${rb.handle}`)
                        }
                    }
                }
            }
        }

        for (let i = 0; i < this.marbles.length; i++) {
            const marbleId = `marble-${i}`
            const surfaceInfo = touchingSurfaces.get(i)

            if (surfaceInfo && surfaceInfo.speed > 0.3) {
                const rollingId = `${marbleId}-rolling`
                if (!audio.rollingSounds || !audio.rollingSounds.has(rollingId)) {
                    audio.startRolling(rollingId, surfaceInfo.radius, surfaceInfo.material)
                }
                audio.updateRolling(rollingId, surfaceInfo.speed, surfaceInfo.angularSpeed)
            } else {
                audio.stopRolling(`${marbleId}-rolling`)
            }
        }
    }

}

export function applyMarbleManagementMethods(targetClass) {
    for (const name of Object.getOwnPropertyNames(MarbleManagementMethods.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = MarbleManagementMethods.prototype[name];
        }
    }
}
