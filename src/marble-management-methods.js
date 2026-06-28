import RAPIER from '@dimforge/rapier3d-compat';
import { audio } from './audio.js';
import { marblesInfo } from './marbles_data.js';
import { quaternionToMat4 } from './math.js';
import { materialPresets } from './material-system.js';
import {
    createMarbleMaterialInstance,
    applyMarbleMaterialPreset,
    MATERIAL_TIER,
} from './marble-material-tier.js';
import { shouldUseMarbleProxyLight, LIGHT_OWNER } from './lighting-budget.js';

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

            const isCube = info.geometry === 'cube'
            const isPlayerSpawn = this.marbles.length === 0
            const spawnTier = isPlayerSpawn ? MATERIAL_TIER.FULL : MATERIAL_TIER.SIMPLIFIED
            const presetName = info.materialType || 'polishedMarble'

            const { instance: matInstance, preset } = createMarbleMaterialInstance(
                this,
                presetName,
                info.color,
                spawnTier
            )

            const startLod = isCube ? null : (isPlayerSpawn ? 0 : 1)
            const lodMeshes = isCube ? null : this.marbleLodMeshes
            const vb = isCube ? this.vb : (lodMeshes?.[startLod]?.vb ?? this.sphereVb)
            const ib = isCube ? this.ib : (lodMeshes?.[startLod]?.ib ?? this.sphereIb)
            const castShadows = isCube ? true : (lodMeshes?.[startLod]?.castShadows !== false)

            this.Filament.RenderableManager.Builder(1)
                .boundingBox({ center: [0, 0, 0], halfExtent: [radius, radius, radius] })
                .material(0, matInstance)
                .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, vb, ib)
                .receiveShadows(true)
                .castShadows(castShadows)
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
                originalGravityScale: info.gravityScale !== undefined ? info.gravityScale : 1.0,
                // Store full preset metadata for future GPU upgrades
                materialPreset: { ...(preset || {}), ...this._marbleInfoMaterialFields(info) },
                materialPresetName: presetName,
                matInstance,
                _materialTier: spawnTier,
                geometry: info.geometry || 'sphere',
                lodMeshes,
                lodLevel: startLod ?? 1,
            }

            // Emissive proxy light — prefer explicit marbles_data flag, then fall
            // back to the material preset's emissiveIntensity field.
            if (info.emissive) {
                marbleObj.emissive = true
                marbleObj.lightColor = info.lightColor || info.color
                marbleObj.lightIntensity = info.lightIntensity || 10000.0
            } else if (preset && preset.emissiveIntensity > 0) {
                marbleObj.emissive = true
                // Use the preset's rimLightColor as the proxy light colour, falling back
                // to the emissive color, then the marble base color, then white.
                marbleObj.lightColor = preset.rimLightColor || preset.emissive || info.color || [1, 1, 1]
                marbleObj.lightIntensity = preset.emissiveIntensity * 10000
            }

            this.marbles.push(marbleObj)
            this.dynamicBodies.add(rigidBody)
            applyMarbleMaterialPreset(marbleObj, this, spawnTier)
            this._applyMarbleMaterialOverrides(marbleObj, info)
        }

        this.currentMarbleIndex = 0
        this.playerMarble = this.marbles[0]
        this.selectedEl.textContent = `Selected: ${this.playerMarble.name}`
        this.updateActiveMarbleLight()
    }

    _marbleInfoMaterialFields(info) {
        const fields = {}
        const keys = [
            'roughness', 'metallic', 'reflectance', 'clearCoat', 'clearCoatRoughness',
            'bumpScale', 'bumpFrequency', 'anisotropy', 'grainScale', 'scratchesIntensity',
            'iridescenceScale', 'sparkleDensity', 'heatIntensity', 'crackGlow',
            'thickness', 'fresnelStrength', 'chromaticDispersion', 'emissiveIntensity',
        ]
        for (const key of keys) {
            if (info[key] !== undefined) fields[key] = info[key]
        }
        return fields
    }

    _applyMarbleMaterialOverrides(marble, info) {
        const mat = marble?.matInstance
        if (!mat) return
        if (info.roughness !== undefined) mat.setFloatParameter('roughness', info.roughness)
        if (!this.hasProceduralMaterial) return
        if (info.metallic !== undefined) mat.setFloatParameter('metallic', info.metallic)
        if (info.reflectance !== undefined) mat.setFloatParameter('reflectance', info.reflectance)
        if (info.clearCoat !== undefined) mat.setFloatParameter('clearCoat', info.clearCoat)
        if (info.clearCoatRoughness !== undefined) mat.setFloatParameter('clearCoatRoughness', info.clearCoatRoughness)
        if (info.bumpScale !== undefined) mat.setFloatParameter('bumpScale', info.bumpScale)
        if (info.bumpFrequency !== undefined) mat.setFloatParameter('bumpFrequency', info.bumpFrequency)
        if (info.anisotropy !== undefined) mat.setFloatParameter('anisotropyStrength', info.anisotropy)
        if (info.grainScale !== undefined) mat.setFloatParameter('grainScale', info.grainScale)
        if (info.scratchesIntensity !== undefined) mat.setFloatParameter('scratchesIntensity', info.scratchesIntensity)
        if (info.emissive !== undefined) {
            mat.setColor3Parameter('emissive', this.Filament.RgbType.LINEAR, info.emissive)
        }
        if (info.emissiveIntensity !== undefined) {
            mat.setFloatParameter('emissiveIntensity', info.emissiveIntensity)
        }
    }

    updateActiveMarbleLight() {
        if (this.activeMarbleLightEntity) {
            this.lightingBudget?.unregister(this.activeMarbleLightEntity)
            this.scene.remove(this.activeMarbleLightEntity)
            this.engine.destroyEntity(this.activeMarbleLightEntity)
            this.Filament.EntityManager.get().destroy(this.activeMarbleLightEntity)
            this.activeMarbleLightEntity = null
        }

        const marble = this.playerMarble
        if (!marble || !marble.emissive) return

        const quality = this.settings?.graphics?.quality || 'medium'
        if (!shouldUseMarbleProxyLight(quality)) {
            return
        }

        const lightEntity = this.Filament.EntityManager.get().create()
        this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].POINT)
            .color(marble.lightColor || marble.color)
            .intensity(marble.lightIntensity || 10000.0)
            .falloff(20.0)
            .castShadows(false)
            .build(this.engine, lightEntity)
        this.scene.addEntity(lightEntity)
        this.activeMarbleLightEntity = lightEntity
        marble.lightEntity = lightEntity

        this.lightingBudget?.register({
            entity: lightEntity,
            owner: LIGHT_OWNER.player,
            getPos: () => {
                const t = marble.rigidBody?.translation?.()
                return t ? { x: t.x, y: t.y, z: t.z } : marble.initialPos
            },
            falloff: 20,
            baseIntensity: marble.lightIntensity || 10000,
            castsShadow: false,
        })
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

    respawnToLastCheckpoint() {
        if (!this.playerMarble) return

        const m = this.playerMarble
        const respawn = m.respawnPos || m.initialPos
        m.rigidBody.setTranslation(respawn, true)
        m.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
        m.rigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
        m.scoredGoals.clear()

        this._rewindHead = 0; this._rewindCount = 0
        if (this.score > 0) {
            this.score = Math.max(0, this.score - 50)
            if (this.scoreEl) this.scoreEl.textContent = 'Score: ' + this.score
            if (typeof this.showTrickMessage === 'function') {
                this.showTrickMessage('-50 Respawn Penalty', '#ff0000')
            }
        }

        this.combo = 1
        if (this.comboEl) {
            this.comboEl.style.display = 'none'
            this.comboEl.textContent = 'Combo: x1'
        }
        if (this.combobarContainerEl) {
            this.combobarContainerEl.style.display = 'none'
        }

        if (typeof this.triggerCheckpointFlash === 'function') {
            this.triggerCheckpointFlash()
        }

        if (typeof audio !== 'undefined' && audio.playJump) {
            // Play a sound to indicate respawn
            audio.playJump()
        }
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
        this._rewindHead = 0; this._rewindCount = 0
        this.ghostRecording = []
        this.ghostPlaybackIndex = 0
        this.levelStartTime = Date.now()

        if (this.portalA) this.destroyPortal(this.portalA)
        if (this.portalB) this.destroyPortal(this.portalB)
        this.portalA = null
        this.portalB = null
        document.getElementById('portal-a-status').style.color = '#444'
        document.getElementById('portal-b-status').style.color = '#444'

        const drainProjectiles = (list) => {
            if (!list?.length) return []
            for (const obj of [...list]) {
                if (obj.rigidBody) {
                    this.dynamicBodies.delete(obj.rigidBody)
                    this.world.removeRigidBody(obj.rigidBody)
                }
                this.effectPool?.releaseProjectile(obj)
            }
            return []
        }

        this.activeMissiles = drainProjectiles(this.activeMissiles)
        this.activeBombs = drainProjectiles(this.activeBombs)
        this.activeBlackHoles = drainProjectiles(this.activeBlackHoles)

        // Rebuild dynamicBodies Set from the surviving tracked arrays
        this.dynamicBodies = new Set()
        for (const m of this.marbles) this.dynamicBodies.add(m.rigidBody)
        for (const obj of this.dynamicObjects) this.dynamicBodies.add(obj.rigidBody)
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
