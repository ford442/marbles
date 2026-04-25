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
import { CUBE_VERTICES, CUBE_INDICES } from './cube-geometry.js';
import { audio } from './audio.js';

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
        }
    }

    async setupAssets() {
        // Try loading the enhanced procedural PBR material first, fall back to the simple material
        const materialFiles = ['./baked_procedural.filament', './baked_color.filmat']
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

    createLight() {
        const F = this.Filament
        
        // Primary sun light - warm daylight
        this.light = F.EntityManager.get().create()
        F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
            .color([1.0, 0.96, 0.88])
            .intensity(150000.0)
            .direction([0.4, -1.0, -0.65])
            .castShadows(true)
            .sunAngularRadius(1.9)
            .sunHaloSize(10.0)
            .sunHaloFalloff(80.0)
            .build(this.engine, this.light)
        this.scene.addEntity(this.light)

        // Blue-sky fill light from opposite direction
        this.fillLight = F.EntityManager.get().create()
        F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
            .color([0.65, 0.78, 1.0])
            .intensity(45000.0)
            .direction([-0.4, -0.2, 0.7])
            .castShadows(false)
            .build(this.engine, this.fillLight)
        this.scene.addEntity(this.fillLight)

        // Warm ambient back light (simulates ground-reflected light)
        this.backLight = F.EntityManager.get().create()
        F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
            .color([0.72, 0.62, 0.52])
            .intensity(30000.0)
            .direction([0.0, -0.3, 1.0])
            .castShadows(false)
            .build(this.engine, this.backLight)
        this.scene.addEntity(this.backLight)
    }

    setupPostProcessing() {
        // Bloom - makes bright marbles and lights glow
        try {
            this.view.setBloomOptions({
                enabled: true,
                strength: 0.4,
                resolution: 384,
                levels: 6,
                threshold: true,
                highlight: 8.0,
                blendMode: this.Filament['View$BloomOptions$BlendMode'].ADD,
                quality: this.Filament['View$QualityLevel'].HIGH,
                lensFlare: false,
            })
        } catch (e) {
            console.warn('[POST] Bloom setup failed:', e)
        }

        // SSAO - ambient occlusion for contact shadows under marbles
        // Use the modern API (setAmbientOcclusionOptions with enabled:true) instead of
        // the deprecated setAmbientOcclusion() which may not exist or have valid enum values.
        try {
            this.view.setAmbientOcclusionOptions({
                radius: 0.4,
                power: 2.0,
                bias: 0.005,
                resolution: 0.5,
                intensity: 1.8,
                quality: this.Filament['View$QualityLevel'].MEDIUM,
                enabled: true,
            })
        } catch (e) {
            console.warn('[POST] SSAO setup failed:', e)
        }

        // MSAA 4x - smooth sphere edges
        try {
            this.view.setMultiSampleAntiAliasingOptions({ enabled: true, sampleCount: 4 })
        } catch (e) {
            console.warn('[POST] MSAA setup failed:', e)
        }

        // ACES tone mapping for cinematic, physically-correct look
        try {
            const colorGrading = this.Filament.ColorGrading.Builder()
                .toneMapping(this.Filament['ColorGrading$ToneMapping'].ACES)
                .contrast(1.08)
                .saturation(1.15)
                .build(this.engine)
            this.view.setColorGrading(colorGrading)
        } catch (e) {
            console.warn('[POST] Color grading setup failed:', e)
        }

        // Indirect Light (IBL) via 3-band Spherical Harmonics
        // Simulates a vibrant blue sky above with warm amber ground bounce below.
        // Coefficients represent a physically-plausible studio-like environment.
        try {
            const iblSh = new Float32Array([
                // L00 - DC term: base ambient brightness (blue-white sky tone)
                 1.10,  1.12,  1.28,
                // L1-1 - Y-axis negative (warm floor/ground bounce, amber-orange)
                 0.18,  0.14,  0.06,
                // L10  - Y-axis positive (blue sky contribution above)
                -0.22, -0.20, -0.35,
                // L11  - X-axis side contribution
                 0.06,  0.06,  0.07,
                // L2-2 - horizontal diagonal
                 0.02,  0.02,  0.02,
                // L2-1 - front-bottom
                 0.04,  0.03,  0.01,
                // L20  - vertical axis
                -0.02, -0.02, -0.03,
                // L21  - front-top
                 0.03,  0.03,  0.02,
                // L22  - horizontal diagonal 2
                 0.01,  0.01,  0.01,
            ])
            this.ibl = this.Filament.IndirectLight.Builder()
                .irradianceSh(3, iblSh)
                .intensity(40000.0)
                .build(this.engine)
            this.scene.setIndirectLight(this.ibl)
        } catch (e) {
            console.warn('[POST] IBL setup failed:', e)
            // Fallback: minimal 1-band IBL
            try {
                const iblShFallback = new Float32Array([1.0, 1.0, 1.1])
                this.ibl = this.Filament.IndirectLight.Builder()
                    .irradianceSh(1, iblShFallback)
                    .intensity(30000.0)
                    .build(this.engine)
                this.scene.setIndirectLight(this.ibl)
            } catch (e2) {
                console.warn('[POST] IBL fallback also failed:', e2)
            }
        }

        // Skybox - deep space blue with subtle gradient
        try {
            this.skyboxEntity = this.Filament.Skybox.Builder()
                .color([0.06, 0.08, 0.16, 1.0])
                .build(this.engine)
            this.scene.setSkybox(this.skyboxEntity)
        } catch (e) {
            console.warn('[POST] Skybox setup failed:', e)
        }
    }

}

export function applyZoneSetupMethods(targetClass) {
    for (const name of Object.getOwnPropertyNames(ZoneSetupMethods.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = ZoneSetupMethods.prototype[name];
        }
    }
}
