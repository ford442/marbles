import { applyZoneSetupCore } from './zone-setup/core.js';
import { applyZoneSetupAssets } from './zone-setup/assets.js';
import { applyZoneSetupEnvironment } from './zone-setup/environment.js';
import { applyZoneSetupGrapple } from './zone-setup/grapple.js';
import { createMushroomBounceZone } from './mushroom_bounce_zone.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { createSphere } from './sphere.js';
import { createSpaceStationZone } from './space_station.js';
import { createSkateParkZone } from './skate_park.js';
import { createHelixZone } from './helix_zone.js';
import { createPinballZone } from './pinball_zone.js';
import { createClockworkZone } from './clockwork_zone.js';
import { createBumperArenaZone } from './bumper_arena.js';
import { createPinwheelAlleyZone } from './pinwheel_alley.js';
import { createPlinkoZone } from './plinko_zone.js';
import { createPlinkoObstacleZone } from './plinko_obstacle_zone.js';
import { createCanyonRunZone } from './canyon_run.js';
import { createVolcanoZone } from './volcano_zone.js';
import { createWindTunnelZone } from './wind_tunnel_zone.js';
import { createCyberTrackZone } from './cyber_track_zone.js';
import { createWaterSlideZone } from './water_slide_zone.js';
import { createGrappleCourseZone } from './grapple_course_zone.js';
import { createIceCaveZone } from './ice_cave_zone.js';
import { createAntigravityZone } from './antigravity_zone.js';
import { createTrampolineParkZone } from './zones/trampoline-park.js';
import { createSpaceElevatorZone } from './zones/space-elevator.js';
import { createMysticForestZone } from './zones/mystic-forest.js';
import { createCloudCityZone } from './zones/cloud-city.js';
import { createDesertRuinsZone } from './zones/desert-ruins.js';
import { createNeonGridZone } from './zones/neon-grid.js';
import { createIceBridgesZone } from './zones/ice-bridges.js';
import { createJungleRunZone } from './zones/jungle-run.js';
import { createLavaTubesZone } from './zones/lava-tubes.js';
import { createStarlightAscentZone } from './zones/starlight-ascent.js';
import { createZenGardenZone } from './zones/zen-garden.js';
import { createToxicSwampZone } from './zones/toxic-swamp.js';
import { createGalaxySpiralZone } from './zones/galaxy-spiral.js';
import { createGlacialChasmZone } from './zones/glacial-chasm.js';
import { createQuantumLeapZone } from './zones/quantum-leap.js';
import { createFrostbiteCavernZone } from './zones/frostbite-cavern.js';
import { createMagneticCanyonZone } from './zones/magnetic-canyon.js';
import { createMagneticCavernZone } from './zones/magnetic-cavern.js';
import { createGravityWellZone } from './zones/gravity-well.js';
import { createCyberIceTrackZone } from './zones/cyber-ice-track.js';
import { createChronoCanyonZone } from './zones/chrono-canyon.js';
import { createNeonAlleyZone } from './zones/neon-alley.js';
import { createSynthwaveSurgeZone } from './zones/synthwave-surge.js';
import { createMeteoriteHollowZone } from './zones/meteorite-hollow.js';
import { createRadiantReactorZone } from "./zones/radiant-reactor.js";
import { createPlasmaPipelineZone } from "./zones/plasma-pipeline.js";
import { createNeonPulseGridZone } from "./zones/neon-pulse-grid.js";
import { createNebulaNexusZone } from "./zones/nebula-nexus.js";
import { createQuantumTunnelZone } from './zones/quantum-tunnel.js';
import { createAbyssalTrenchZone } from './zones/abyssal-trench.js';
import { CUBE_VERTICES, CUBE_INDICES } from './cube-geometry.js';
import { audio } from './audio.js';
import { DEFAULT_MSAA_SAMPLE_COUNT, getPostFxQualityFlags, getShadowQualityConfig } from './rendering-defaults.js';
import { getBloomQualityConfig, getSsaoQualityConfig, getVignetteConfig, getColorGradingConfig, getEnvironmentColorGradingPreset, getFogQualityConfig, getEnvironmentFogPreset } from './rendering/post-fx-presets.js';
import {
    buildEnvironmentLighting,
    destroyEnvironmentLighting,
    destroyEnvironmentWithCubemaps,
    upgradeEnvironmentWithCubemap,
    CUBEMAP_QUALITY_LEVELS,
    ENVIRONMENT_PRESETS,
} from './rendering/environment.js';

export class ZoneSetupMethods {
    async createZone(zone) {
        const pos = zone.pos || { x: 0, y: 0, z: 0 }
        const offset = { x: pos.x, y: pos.y, z: pos.z }

        switch (zone.type) {
            case 'floor':
                this.createFloorZone(offset, zone.size)
                break
            case 'track':
                this.createTrackZone(offset)
                break
            case 'landing':
                this.createLandingZone(offset)
                break
            case 'jump':
                this.createJumpZone(offset)
                break
            case 'slalom':
                this.createSlalomZone(offset)
                break
            case 'staircase':
                this.createStaircaseZone(offset)
                break
            case 'split':
                this.createSplitZone(offset)
                break
            case 'forest':
                this.createForestZone(offset)
                break
            case 'goal':
                this.createGoalZone(offset, zone.color)
                break
            case 'orchard':
                this.createOrchardZone(zone.center, zone.radius)
                break
            case 'spiral':
                this.createSpiralZone(offset)
                break
            case 'zigzag':
                this.createZigZagZone(offset)
                break
            case 'pinwheel_alley':
                createPinwheelAlleyZone(this, offset)
                break
            case 'plinko':
                createPlinkoZone(this, offset)
                break;
            case 'plinko_obstacle':
                createPlinkoObstacleZone(this, offset)
                break;
            case 'neon_city':
                this.createNeonCityZone(offset)
                break
            case 'loop':
                this.createLoopZone(offset)
                break
            case 'block':
                this.createBlockZone(offset)
                break
            case 'bowling':
                this.createBowlingZone(offset)
                break
            case 'castle':
                this.createCastleZone(offset)
                break
            case 'checkpoint':
                this.createCheckpointZone(offset, zone.size)
                break
            case 'domino':
                this.createDominoZone(offset)
                break
            case 'pyramid':
                this.createPyramidZone(offset)
                break
            case 'powerup':
                this.createPowerUpZone(offset)
                break
            case 'space_station':
                createSpaceStationZone(this, offset)
                break
            case 'skate_park':
                createSkateParkZone(this, offset)
                break
            case 'helix':
                createHelixZone(this, offset)
                break
            case 'pinball':
                createPinballZone(this, offset)
                break
            case 'moving':
                this.createMovingZone(offset)
                break
            case 'clockwork':
                createClockworkZone(this, offset)
                break
            case 'bumper_arena':
                createBumperArenaZone(this, offset)
                break
            case 'canyon_run':
                createCanyonRunZone(this, offset)
                break
            case 'volcano':
                createVolcanoZone(this, offset)
                break
            case 'mushroom_bounce':
                createMushroomBounceZone(this, offset)
                break
            case 'wind_tunnel':
                createWindTunnelZone(this, offset)
                break
            case 'cyber_track':
                createCyberTrackZone(this, offset)
                break
            case 'water_slide':
                createWaterSlideZone(this, offset)
                break
            case 'grapple_course':
                createGrappleCourseZone(this, offset)
                break
            case 'ice_cave':
                createIceCaveZone(this, offset)
                break
            case 'antigravity':
                createAntigravityZone(this, offset)
                break
            case 'trampoline_park':
                createTrampolineParkZone(this, offset)
                break
            case 'space_elevator':
                createSpaceElevatorZone(this, offset)
                break
            case 'mystic_forest':
                createMysticForestZone(this, offset)
                break
            case 'cloud_city':
                createCloudCityZone(this, offset)
                break
            case 'desert_ruins':
                createDesertRuinsZone(this, offset)
                break
            case 'neon_grid':
                createNeonGridZone(this, offset)
                break
            case 'ice_bridges':
                createIceBridgesZone(this, offset)
                break
            case 'jungle_run':
                createJungleRunZone(this, offset)
                break
            case 'lava_tubes':
                createLavaTubesZone(this, offset)
                break
            case 'quantum_leap':
                createQuantumLeapZone(this, offset)
                break
            case 'frostbite_cavern':
                createFrostbiteCavernZone(this, offset)
                break
            case 'magnetic_canyon':
                createMagneticCanyonZone(this, offset)
                break
            case 'magnetic_cavern':
                createMagneticCavernZone(this, offset)
                break
            case 'gravity_well':
                createGravityWellZone(this, offset)
                break
            case 'cyber_ice_track':
                createCyberIceTrackZone(this, offset)
                break
            case 'neon_alley':
                createNeonAlleyZone(this, offset)
                break
            case 'chrono_canyon':
                createChronoCanyonZone(this, offset)
                break
            case 'synthwave_surge':
                createSynthwaveSurgeZone(this, offset)
                break
            case 'meteorite_hollow':
                createMeteoriteHollowZone(this, offset)
                break
            case 'radiant_reactor':
                createRadiantReactorZone(this, offset)
                break
            case 'plasma_pipeline':
                createPlasmaPipelineZone(this, offset)
                break
            case 'starlight_ascent':
                createStarlightAscentZone(this, offset)
                break
            case 'zen_garden':
                createZenGardenZone(this, offset)
                break
            case 'toxic_swamp':
                createToxicSwampZone(this, offset)
                break
            case 'galaxy_spiral':
                createGalaxySpiralZone(this, offset)
                break
            case 'glacial_chasm':
                createGlacialChasmZone(this, offset)
                break
            case 'neon_pulse_grid':
                createNeonPulseGridZone(this, offset)
                break
            case 'nebula_nexus':
                createNebulaNexusZone(this, offset)
                break
            case 'quantum_tunnel':
                createQuantumTunnelZone(this, offset)
                break
            case 'abyssal_trench':
                createAbyssalTrenchZone(this, offset)
                break
        }
    }

    async setupAssets() {
        // Load the known-good material by default. The procedural package was
        // compiled by an older matc and can abort newer Filament runtimes during
        // createMaterial(), so keep it as an explicit development opt-in.
        const useProceduralMaterial = new URLSearchParams(window.location.search).get('proceduralMaterial') === '1'
        const materialFiles = useProceduralMaterial
            ? ['./baked_procedural.filament', './baked_color.filmat']
            : ['./baked_color.filmat']
        let materialBuffer = null
        let materialFile = null

        for (const file of materialFiles) {
            try {
                console.log(`[ASSETS] Trying to load material: ${file}`)
                const response = await fetch(file)
                if (!response.ok) {
                    console.warn(`[ASSETS] ${file} HTTP ${response.status}, trying next...`)
                    continue
                }
                materialBuffer = await response.arrayBuffer()
                materialFile = file
                console.log(`[ASSETS] Loaded ${materialBuffer.byteLength} bytes from ${file}`)
                break
            } catch (e) {
                console.warn(`[ASSETS] Failed to fetch ${file}:`, e)
            }
        }

        if (!materialBuffer) {
            throw new Error('[ASSETS] Could not load any material file')
        }

        try {
            this.material = this.engine.createMaterial(new Uint8Array(materialBuffer))
            console.log(`[ASSETS] Material created from ${materialFile}`)
        } catch (e) {
            // If the preferred material fails, try the fallback directly
            if (materialFile !== './baked_color.filmat') {
                console.warn('[ASSETS] Primary material creation failed, trying baked_color.filmat...', e)
                const resp = await fetch('./baked_color.filmat')
                const buf = await resp.arrayBuffer()
                this.material = this.engine.createMaterial(new Uint8Array(buf))
                materialFile = './baked_color.filmat'
                console.log('[ASSETS] Fallback material created')
            } else {
                throw e
            }
        }

        // Track whether the enhanced procedural material is active so we know
        // which material parameters are safe to set on material instances.
        this.hasProceduralMaterial = (materialFile === './baked_procedural.filament')
        console.log(`[ASSETS] Procedural material active: ${this.hasProceduralMaterial}`)

        const VertexAttribute = this.Filament['VertexAttribute']
        const AttributeType = this.Filament['VertexBuffer$AttributeType']

        this.vb = this.Filament.VertexBuffer.Builder()
            .vertexCount(24)
            .bufferCount(1)
            .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 36)
            .attribute(VertexAttribute.TANGENTS, 0, AttributeType.FLOAT4, 12, 36)
            .attribute(VertexAttribute.UV0, 0, AttributeType.FLOAT2, 28, 36)
            .build(this.engine)
        this.vb.setBufferAt(this.engine, 0, CUBE_VERTICES)

        this.ib = this.Filament.IndexBuffer.Builder()
            .indexCount(36)
            .bufferType(this.Filament['IndexBuffer$IndexType'].USHORT)
            .build(this.engine)
        this.ib.setBuffer(this.engine, CUBE_INDICES)

        const sphereData = createSphere(0.5, 64, 32)
        this.sphereVb = this.Filament.VertexBuffer.Builder()
            .vertexCount(sphereData.vertices.length / 9)
            .bufferCount(1)
            .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 36)
            .attribute(VertexAttribute.TANGENTS, 0, AttributeType.FLOAT4, 12, 36)
            .attribute(VertexAttribute.UV0, 0, AttributeType.FLOAT2, 28, 36)
            .build(this.engine)
        this.sphereVb.setBufferAt(this.engine, 0, sphereData.vertices)

        this.sphereIb = this.Filament.IndexBuffer.Builder()
            .indexCount(sphereData.indices.length)
            .bufferType(this.Filament['IndexBuffer$IndexType'].USHORT)
            .build(this.engine)
        this.sphereIb.setBuffer(this.engine, sphereData.indices)

        this.createCueStick()
        this.createGrappleLine()
    }

    createGrappleLine() {
        this.grappleEntity = this.Filament.EntityManager.get().create()
        const grappleColor = [0.0, 1.0, 1.0]
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, grappleColor)
        matInstance.setFloatParameter('roughness', 0.2)
        if (this.hasProceduralMaterial) {
            matInstance.setFloatParameter('metallic', 0.8)
            matInstance.setFloatParameter('reflectance', 1.0)
            matInstance.setFloatParameter('bumpScale', 0.0)
            matInstance.setFloatParameter('bumpFrequency', 0.0)
        }

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, this.grappleEntity)

        this.scene.addEntity(this.grappleEntity)

        const tcm = this.engine.getTransformManager()
        this.grappleInst = tcm.getInstance(this.grappleEntity)

        // Hide initially
        const zeroMat = new Float32Array(16)
        zeroMat[15] = 1
        tcm.setTransform(this.grappleInst, zeroMat)
    }

    createCueStick() {
        this.cueEntity = this.Filament.EntityManager.get().create()
        const cueColor = [1.0, 1.0, 0.0]
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, cueColor)
        matInstance.setFloatParameter('roughness', 0.2)
        if (this.hasProceduralMaterial) {
            matInstance.setFloatParameter('metallic', 0.0)
            matInstance.setFloatParameter('reflectance', 0.6)
            matInstance.setFloatParameter('bumpScale', 0.005)
            matInstance.setFloatParameter('bumpFrequency', 15.0)
        }

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, this.cueEntity)

        this.scene.addEntity(this.cueEntity)

        const tcm = this.engine.getTransformManager()
        this.cueInst = tcm.getInstance(this.cueEntity)

        const zeroMat = new Float32Array(16)
        zeroMat[15] = 1
        tcm.setTransform(this.cueInst, zeroMat)
    }

    startGrapple() {
        if (!this.playerMarble || !this.world) return

        const rb = this.playerMarble.rigidBody
        const pos = rb.translation()

        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)
        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        const rayOrigin = { x: pos.x, y: pos.y, z: pos.z }
        const rayDir = { x: dirX, y: dirY, z: dirZ }
        const ray = new RAPIER.Ray(rayOrigin, rayDir)

        const hit = this.world.castRay(ray, this.grappleMaxDist, true)
        if (hit) {
            this.grappleTarget = {
                x: rayOrigin.x + rayDir.x * hit.toi,
                y: rayOrigin.y + rayDir.y * hit.toi,
                z: rayOrigin.z + rayDir.z * hit.toi
            }
            this.grappleRestLength = hit.toi * 0.8 // slightly pull them in initially
            this.isGrappling = true
            console.log("[GAME] Grapple attached at", this.grappleTarget)
            if (audio && audio.playCollect) audio.playCollect()
        }
    }

    stopGrapple() {
        // Slingshot Boost logic before releasing the grapple
        if (this.isGrappling && this.playerMarble && this.grappleTarget) {
            const rb = this.playerMarble.rigidBody
            const vel = rb.linvel()
            const speed = Math.hypot(vel.x, vel.y, vel.z)

            if (speed > 15.0) {
                // Apply forward and upward physics impulse
                const boostForce = 15.0
                const dirX = vel.x / speed
                const dirY = Math.max(0.2, vel.y / speed) + 0.5 // Add some vertical kick
                const dirZ = vel.z / speed

                rb.applyImpulse({
                    x: dirX * boostForce,
                    y: dirY * boostForce,
                    z: dirZ * boostForce
                }, true)

                // Call awardTrickPoints if available
                if (typeof this.awardTrickPoints === 'function') {
                    this.awardTrickPoints('Slingshot Boost!', 150, '#ff00ff')
                }
            }
        }

        this.isGrappling = false
        this.grappleTarget = null

        if (this.grappleInst) {
            const tcm = this.engine.getTransformManager()
            const zeroMat = new Float32Array(16)
            zeroMat[15] = 1
            tcm.setTransform(this.grappleInst, zeroMat)
        }
    }

    updateGrapple() {
        if (!this.isGrappling || !this.playerMarble || !this.grappleTarget) {
            if (this.isGrappling) this.stopGrapple()
            return
        }

        const rb = this.playerMarble.rigidBody
        const pos = rb.translation()
        const target = this.grappleTarget

        const dx = target.x - pos.x
        const dy = target.y - pos.y
        const dz = target.z - pos.z
        const dist = Math.hypot(dx, dy, dz)

        const dirX = dx / dist
        const dirY = dy / dist
        const dirZ = dz / dist

        // Apply Spring/Pendulum force instead of constant pull
        const restLength = this.grappleRestLength || 10.0

        if (dist > restLength) {
            const stiffness = 15.0
            const damping = 2.0

            const springForce = (dist - restLength) * stiffness

            const vel = rb.linvel()
            const velAlongString = vel.x * dirX + vel.y * dirY + vel.z * dirZ
            const dampingForce = -velAlongString * damping

            const totalForce = springForce + dampingForce

            if (totalForce > 0) {
                rb.applyImpulse({
                    x: dirX * totalForce * 0.016, // scale by rough dt
                    y: dirY * totalForce * 0.016,
                    z: dirZ * totalForce * 0.016
                }, true)
            }
        }

        // Counter-gravity when swinging
        if (dirY > 0 && dist > restLength) {
            rb.applyImpulse({ x: 0, y: 0.5, z: 0 }, true)
        }

        // Visuals
        if (this.grappleInst) {
            let ux = 0, uy = 1, uz = 0
            if (Math.abs(dirY) > 0.99) {
                ux = 1; uy = 0; uz = 0
            }

            let rx = uy * dirZ - uz * dirY
            let ry = uz * dirX - ux * dirZ
            let rz = ux * dirY - uy * dirX
            const rLen = Math.hypot(rx, ry, rz)
            rx /= rLen; ry /= rLen; rz /= rLen

            let newUx = dirY * rz - dirZ * ry
            let newUy = dirZ * rx - dirX * rz
            let newUz = dirX * ry - dirY * rx

            const thick = 0.05

            const midX = (pos.x + target.x) / 2
            const midY = (pos.y + target.y) / 2
            const midZ = (pos.z + target.z) / 2

            const mat = new Float32Array([
                rx * thick, ry * thick, rz * thick, 0,
                newUx * thick, newUy * thick, newUz * thick, 0,
                dx, dy, dz, 0,
                midX, midY, midZ, 1
            ])

            const tcm = this.engine.getTransformManager()
            tcm.setTransform(this.grappleInst, mat)
        }
    }

    shootMarble() {
        if (!this.playerMarble) return

        const force = 50.0 + this.chargePower * 150.0
        const cosP = Math.cos(this.pitchAngle)
        const sinP = Math.sin(this.pitchAngle)

        const dirX = Math.sin(this.aimYaw) * cosP
        const dirY = sinP
        const dirZ = Math.cos(this.aimYaw) * cosP

        this.playerMarble.rigidBody.applyImpulse({
            x: dirX * force,
            y: dirY * force,
            z: dirZ * force
        }, true)

        this.chargePower = 0
        this.powerbarEl.style.width = '0%'
    }

    setupPostProcessing() {
        const quality = this.settings?.graphics?.quality || 'medium';
        const { taaEnabled, motionBlurEnabled, ssrEnabled } = getPostFxQualityFlags(quality)

        // Bloom — resolution, strength, and quality scale with the quality tier
        try {
            this.view.setBloomOptions(getBloomQualityConfig(quality, this.Filament))
        } catch (e) {
            console.warn('[POST] Bloom setup failed:', e)
        }

        // SSAO — radius, resolution, and quality scale with the quality tier
        try {
            this.view.setAmbientOcclusionOptions(getSsaoQualityConfig(quality, this.Filament))
        } catch (e) {
            console.warn('[POST] SSAO setup failed:', e)
        }

        // MSAA is disabled when TAA is active to avoid stacking both techniques.
        try {
            this.view.setMultiSampleAntiAliasingOptions({ enabled: !taaEnabled, sampleCount: DEFAULT_MSAA_SAMPLE_COUNT })
        } catch (e) {
            console.warn('[POST] MSAA setup failed:', e)
        }

        // TAA - temporal anti-aliasing reduces edge shimmering during motion
        try {
            this.view.setTemporalAntiAliasingOptions({
                enabled: taaEnabled,
                // filterWidth: width of the temporal filter kernel; higher = softer but more stable
                filterWidth: 2.0,
                feedback: 0.85,
                jitterSpread: 0.75,
            })
        } catch (e) {
            console.warn('[POST] TAA setup failed:', e)
        }

        // Motion Blur - cinematic blur for fast-moving marbles and camera.
        // Some Filament JS builds do not expose this wrapper; skip cleanly.
        if (typeof this.view.setMotionBlurOptions === 'function') {
            try {
                this.view.setMotionBlurOptions({
                    enabled: motionBlurEnabled,
                    intensity: 0.32,
                    maxDisplacement: 0.18,
                })
            } catch (e) {
                console.warn('[POST] Motion Blur setup failed:', e)
            }
        }

        // SSR - screen-space reflections for shiny floor and ice surfaces
        try {
            this.view.setScreenSpaceReflectionsOptions({
                enabled: ssrEnabled,
                thickness: 0.1,
                bias: 0.01,
                maxDistance: 3.0,
                stride: 2.0,
            })
        } catch (e) {
            console.warn('[POST] SSR setup failed:', e)
        }

        // ACES tone mapping with per-tier contrast/saturation for a richer look on high-end hardware
        try {
            const cgConfig = getColorGradingConfig(quality)
            const colorGrading = this.Filament.ColorGrading.Builder()
                .toneMapping(this.Filament['ColorGrading$ToneMapping'].ACES)
                .contrast(cgConfig.contrast)
                .saturation(cgConfig.saturation)
                .build(this.engine)
            this.view.setColorGrading(colorGrading)
        } catch (e) {
            console.warn('[POST] Color grading setup failed:', e)
        }

        // Vignette — subtle filmic darkening on high/ultra; disabled on medium and low
        try {
            this.view.setVignetteOptions(getVignetteConfig(quality))
        } catch (e) {
            // setVignetteOptions may not be present in all Filament builds; silently skip
        }

        // Production shadow quality — gated behind high/ultra presets.
        // medium and below use basic PCF shadows (cheaper, still decent).
        const { shadowOptions, vsmOptions, softOptions } = getShadowQualityConfig(quality);
        if (this.view) {
            if (typeof this.view.setShadowOptions === 'function') {
                try {
                    this.view.setShadowOptions(shadowOptions);
                } catch (e) {
                    console.warn('[POST] setShadowOptions failed:', e);
                }
            }

            if (vsmOptions) {
                try {
                    this.view.setVsmShadowOptions(vsmOptions);
                } catch (e) {
                    console.warn('[POST] setVsmShadowOptions failed:', e);
                }
            }

            if (softOptions) {
                try {
                    this.view.setSoftShadowOptions(softOptions);
                } catch (e) {
                    console.warn('[POST] setSoftShadowOptions failed:', e);
                }
            }
        }

        // Fog — atmospheric depth haze with quality tiering and environment-specific tints
        // Disabled on low quality; medium/high/ultra use exponential fog with height falloff
        try {
            const fogConfig = getFogQualityConfig(quality);
            if (fogConfig.enabled) {
                // Start with quality-tier defaults
                const fogOptions = { ...fogConfig };

                // Merge environment-specific overrides (color, density, height falloff, etc)
                // Default environment is 'default'; will be overridden per-level in applyEnvironment()
                const envFogPreset = getEnvironmentFogPreset(this.currentEnvironment || 'default');
                Object.assign(fogOptions, envFogPreset);

                // Prevent negative heights or invalid configs
                if (fogOptions.heightFalloff < 0) fogOptions.heightFalloff = 0;
                if (fogOptions.heightFalloff > 1) fogOptions.heightFalloff = 1;

                fogOptions.color = fogOptions.color?.slice(0, 3) || [1.0, 1.0, 1.0];
                this.view.setFogOptions(fogOptions);
                console.log(`[POST] Fog enabled: quality=${quality}, env=${this.currentEnvironment || 'default'}`);
            } else {
                this.view.setFogOptions({ enabled: false });
            }
        } catch (e) {
            console.warn('[POST] Fog setup failed:', e);
        }

        // Indirect Light (IBL) + Skybox — themed per-environment
        // Calls setupEnvironmentLighting() which builds from the named preset.
        // The initial environment is 'default'; levels override it via
        // applyEnvironment() called from loadLevel().
        this.setupEnvironmentLighting('default');
    }

    /**
     * Build and apply an IndirectLight + Skybox for the given environment.
     * Destroys any previously created IBL/Skybox objects first.
     *
     * For 'high' and 'ultra' quality, fires an async upgrade that replaces the
     * SH-only IBL with a full specular IBL backed by a KTX1 cubemap once the
     * asset has loaded.  The SH fallback remains active until then.
     *
     * @param {string} envName - Key from ENVIRONMENT_PRESETS (e.g. 'ice', 'volcanic')
     */
    setupEnvironmentLighting(envName = 'default') {
        const quality = this.settings?.graphics?.quality || 'medium';

        // Tear down existing IBL / skybox (including any previously loaded cubemap textures)
        if (this._iblObject || this._skyboxObject) {
            destroyEnvironmentWithCubemaps(
                this.engine, this.scene,
                this._iblObject, this._skyboxObject,
                this._iblTexture || null, this._skyboxTexture || null,
            );
            this._iblObject = null;
            this._skyboxObject = null;
            this._iblTexture = null;
            this._skyboxTexture = null;
        }

        const { ibl, skybox } = buildEnvironmentLighting(
            this.engine,
            this.scene,
            this.Filament,
            envName,
            quality,
        );

        // Keep references so we can destroy them on the next switch or cleanup
        this._iblObject = ibl;
        this._skyboxObject = skybox;
        this._iblTexture = null;
        this._skyboxTexture = null;
        this.currentEnvironment = envName;

        // Back-compat: keep this.ibl pointing at the active IBL object
        this.ibl = ibl;
        this.skyboxEntity = skybox;

        // For high/ultra quality, asynchronously upgrade to full specular IBL
        if (CUBEMAP_QUALITY_LEVELS.has(quality)) {
            this._upgradeEnvironmentWithCubemap(envName);
        }
    }

    /**
     * Apply fog effects for the given environment name.
     * Merges environment-specific fog preset with quality-tier fog config.
     * Called automatically by applyEnvironment() when switching zones.
     *
     * @param {string} envName - Environment preset name (e.g. 'default', 'space_nebula', 'underwater')
     */
    applyEnvironmentFog(envName = 'default') {
        if (!this.view) return;

        const quality = this.settings?.graphics?.quality || 'medium';

        try {
            const fogConfig = getFogQualityConfig(quality);
            if (fogConfig.enabled) {
                // Start with quality-tier defaults
                const fogOptions = { ...fogConfig };

                // Merge environment-specific overrides
                const envFogPreset = getEnvironmentFogPreset(envName);
                Object.assign(fogOptions, envFogPreset);

                // Validate fog config
                if (fogOptions.heightFalloff < 0) fogOptions.heightFalloff = 0;
                if (fogOptions.heightFalloff > 1) fogOptions.heightFalloff = 1;

                fogOptions.color = fogOptions.color?.slice(0, 3) || [1.0, 1.0, 1.0];
                this.view.setFogOptions(fogOptions);
                console.log(`[FOG] Applied: quality=${quality}, env=${envName}`);
            } else {
                this.view.setFogOptions({ enabled: false });
            }
        } catch (e) {
            console.warn('[FOG] Failed to apply environment fog:', e);
        }
    }

    /**
     * Apply per-environment color grading to the view.
     * Merges the quality-tier base config from getColorGradingConfig() with
     * environment-specific overrides from getEnvironmentColorGradingPreset(),
     * then rebuilds and sets a new Filament ColorGrading object.
     *
     * Called automatically by applyEnvironment() and optionally overridden
     * by the level's `colorGrade` field in loadLevel().
     *
     * @param {string} envName - Environment/color-grade preset key
     */
    applyColorGradingForEnvironment(envName = 'default') {
        if (!this.view || !this.Filament || !this.engine) return;

        try {
            const quality = this.settings?.graphics?.quality || this.graphicsQuality || 'medium';
            const baseConfig = getColorGradingConfig(quality);
            const envConfig = getEnvironmentColorGradingPreset(envName);

            // Env-specific values fully replace their quality-tier counterparts
            const merged = { ...baseConfig, ...envConfig };

            const builder = this.Filament.ColorGrading.Builder()
                .toneMapping(this.Filament['ColorGrading$ToneMapping'].ACES)
                .contrast(merged.contrast)
                .saturation(merged.saturation);

            // vibrance: protects already-saturated hues; safe try-catch in case
            // the Filament WASM build doesn't expose this method.
            if (merged.vibrance != null) {
                try { builder.vibrance(merged.vibrance); } catch (_) { /* unsupported */ }
            }

            const colorGrading = builder.build(this.engine);
            this.view.setColorGrading(colorGrading);

            console.log(`[GRADE] Applied: env=${envName}, contrast=${merged.contrast.toFixed(2)}, sat=${merged.saturation.toFixed(2)}`);
        } catch (e) {
            console.warn('[GRADE] Color grading update failed:', e);
        }
    }

    /**
     * Async helper: load KTX1 cubemaps and upgrade the current SH-only
     * environment to full specular IBL.  Guards against stale upgrades if the
     * environment was changed before the fetch completed.
     *
     * @param {string} envName
     */
    async _upgradeEnvironmentWithCubemap(envName) {
        const result = await upgradeEnvironmentWithCubemap(
            this.engine,
            this.scene,
            this.Filament,
            envName,
            this._iblObject,
            this._skyboxObject,
        );

        // Guard: environment may have changed while we were awaiting
        if (!result || this.currentEnvironment !== envName) {
            return;
        }

        this._iblObject = result.ibl;
        this._skyboxObject = result.skybox;
        this._iblTexture = result.iblTexture;
        this._skyboxTexture = result.skyboxTexture;

        // Keep back-compat references current
        this.ibl = result.ibl;
        this.skyboxEntity = result.skybox;
    }

    /**
     * Switch to a different environment at runtime (e.g. when a level loads).
     * Safe to call before Filament is fully initialised – does nothing in that case.
     *
     * @param {string} envName - Key from ENVIRONMENT_PRESETS
     */
    applyEnvironment(envName = 'default') {
        if (!this.engine || !this.scene || !this.Filament) {
            return;
        }
        if (envName === this.currentEnvironment) {
            return;
        }
        this.setupEnvironmentLighting(envName);
        
        // Apply environment-specific directional and fill lights
        if (this.lightingSystem) {
            try {
                const envPreset = ENVIRONMENT_PRESETS[envName] || ENVIRONMENT_PRESETS['default'];
                this.lightingSystem.applyEnvironmentLighting(envName, envPreset);
            } catch (e) {
                console.warn('[LightingSystem] Failed to apply environment lighting:', e);
            }
        }

        // Apply environment-specific fog after switching environment
        this.applyEnvironmentFog(envName);

        // Apply environment-specific color grading (contrast, saturation, vibrance)
        this.applyColorGradingForEnvironment(envName);
    }
}

export function applyZoneSetupMethods(targetClass) {
    applyZoneSetupCore(targetClass);
    applyZoneSetupAssets(targetClass);
    applyZoneSetupEnvironment(targetClass);
    applyZoneSetupGrapple(targetClass);
}
