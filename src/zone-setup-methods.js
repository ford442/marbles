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
import { createTrampolineParkZone, createSpaceElevatorZone, createMysticForestZone, createCloudCityZone, createDesertRuinsZone, createNeonGridZone, createIceBridgesZone, createJungleRunZone, createLavaTubesZone, createStarlightAscentZone, createZenGardenZone, createToxicSwampZone } from './zone_draft.js';
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
            case 'starlight_ascent':
                createStarlightAscentZone(this, offset)
                break
            case 'zen_garden':
                createZenGardenZone(this, offset)
                break
            case 'toxic_swamp':
                createToxicSwampZone(this, offset)
                break
        }
    }

    async setupAssets() {
        console.log('[ASSETS] Loading baked_color.filmat...')
        let response
        try {
            response = await fetch('./baked_color.filmat')
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
        } catch (e) {
            console.error('[ASSETS] Failed to fetch material:', e)
            throw e
        }
        const buffer = await response.arrayBuffer()
        console.log(`[ASSETS] Loaded ${buffer.byteLength} bytes`)
        this.material = this.engine.createMaterial(new Uint8Array(buffer))
        console.log('[ASSETS] Material created successfully')

        const VertexAttribute = this.Filament['VertexAttribute']
        const AttributeType = this.Filament['VertexBuffer$AttributeType']

        this.vb = this.Filament.VertexBuffer.Builder()
            .vertexCount(24)
            .bufferCount(1)
            .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 28)
            .attribute(VertexAttribute.TANGENTS, 0, AttributeType.FLOAT4, 12, 28)
            .build(this.engine)
        this.vb.setBufferAt(this.engine, 0, CUBE_VERTICES)

        this.ib = this.Filament.IndexBuffer.Builder()
            .indexCount(36)
            .bufferType(this.Filament['IndexBuffer$IndexType'].USHORT)
            .build(this.engine)
        this.ib.setBuffer(this.engine, CUBE_INDICES)

        const sphereData = createSphere(0.5, 64, 32)
        this.sphereVb = this.Filament.VertexBuffer.Builder()
            .vertexCount(sphereData.vertices.length / 7)
            .bufferCount(1)
            .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, 28)
            .attribute(VertexAttribute.TANGENTS, 0, AttributeType.FLOAT4, 12, 28)
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
        // Bright cyan/blue color for the grapple line
        const grappleColor = [0.0, 1.0, 1.0]
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, grappleColor)
        matInstance.setFloatParameter('roughness', 0.2)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
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
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, cueColor)
        matInstance.setFloatParameter('roughness', 0.2)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
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
            this.isGrappling = true
            console.log("[GAME] Grapple attached at", this.grappleTarget)
            if (audio && audio.playCollect) audio.playCollect()
        }
    }

    stopGrapple() {
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

        // Apply pulling force
        rb.applyImpulse({
            x: dirX * this.grappleForce,
            y: dirY * this.grappleForce,
            z: dirZ * this.grappleForce
        }, true)

        // Counter-gravity
        if (dirY > 0) {
            rb.applyImpulse({ x: 0, y: 1.0, z: 0 }, true)
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
        
        this.light = F.EntityManager.get().create()
        F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
            .color([1.0, 0.95, 0.85])
            .intensity(120000.0)
            .direction([0.5, -1.0, -0.7])
            .castShadows(true)
            .sunAngularRadius(1.9)
            .sunHaloSize(10.0)
            .sunHaloFalloff(80.0)
            .build(this.engine, this.light)
        this.scene.addEntity(this.light)

        this.fillLight = F.EntityManager.get().create()
        F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
            .color([0.7, 0.8, 1.0])
            .intensity(35000.0)
            .direction([-0.5, -0.3, 0.6])
            .castShadows(false)
            .build(this.engine, this.fillLight)
        this.scene.addEntity(this.fillLight)

        this.backLight = F.EntityManager.get().create()
        F.LightManager.Builder(F['LightManager$Type'].DIRECTIONAL)
            .color([0.6, 0.6, 0.75])
            .intensity(25000.0)
            .direction([0.0, -0.5, 1.0])
            .castShadows(false)
            .build(this.engine, this.backLight)
        this.scene.addEntity(this.backLight)
    }

    setupPostProcessing() {
        // Bloom - makes bright marbles and lights glow
        this.view.setBloomOptions({
            enabled: true,
            strength: 0.3,
            resolution: 256,
            levels: 6,
            threshold: true,
            highlight: 10.0,
            blendMode: this.Filament['View$BloomOptions$BlendMode'].ADD,
            quality: this.Filament['View$QualityLevel'].MEDIUM,
        })

        // SSAO - ambient occlusion for contact shadows under marbles
        this.view.setAmbientOcclusion(this.Filament['View$AmbientOcclusion'].SSAO)
        this.view.setAmbientOcclusionOptions({
            radius: 0.5,
            power: 1.8,
            bias: 0.005,
            resolution: 0.5,
            intensity: 1.5,
            quality: this.Filament['View$QualityLevel'].MEDIUM,
            enabled: true,
        })

        // MSAA 4x - smooth sphere edges
        this.view.setMultiSampleAntiAliasingOptions({ enabled: true, sampleCount: 4 })

        // ACES tone mapping for cinematic, physically-correct look
        const colorGrading = this.Filament.ColorGrading.Builder()
            .toneMapping(this.Filament['ColorGrading$ToneMapping'].ACES)
            .contrast(1.05)
            .saturation(1.1)
            .build(this.engine)
        this.view.setColorGrading(colorGrading)

        // Indirect Light (IBL) via 2-band Spherical Harmonics
        // Simulates a cool blue sky above with warm ground bounce below
        const iblSh = new Float32Array([
            // L00 - overall ambient (neutral blue-white)
            0.9, 0.92, 1.05,
            // L1-1 - warm floor bounce (Y negative)
            0.12, 0.10, 0.06,
            // L10 - sky direction (Y positive)
            -0.18, -0.18, -0.28,
            // L11 - X side contribution
            0.04, 0.04, 0.05,
        ])
        this.ibl = this.Filament.IndirectLight.Builder()
            .irradianceSh(2, iblSh)
            .intensity(30000.0)
            .build(this.engine)
        this.scene.setIndirectLight(this.ibl)

        // Skybox - replace flat gray background with a deep space blue
        this.skyboxEntity = this.Filament.Skybox.Builder()
            .color([0.08, 0.10, 0.18, 1.0])
            .build(this.engine)
        this.scene.setSkybox(this.skyboxEntity)
    }

}

export function applyZoneSetupMethods(targetClass) {
    for (const name of Object.getOwnPropertyNames(ZoneSetupMethods.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = ZoneSetupMethods.prototype[name];
        }
    }
}
