import RAPIER from '@dimforge/rapier3d-compat';
import { quatFromEuler, quaternionToMat4 } from './math.js';
import { audio } from './audio.js';
import { materialPresets, trackSurfacePresets, applyFullPreset } from './material-system.js';
import { CUBE_VERTICES, CUBE_INDICES } from './cube-geometry.js';
import {
    batchBoxGeometry,
    buildBatchedBuffers,
    computeBatchBounds,
    createBatchedRenderable
} from './gpu-instancing.js';

// Default roughness applied to surfaces that have no matching preset
const DEFAULT_SURFACE_ROUGHNESS = 0.4

// Aliases so callers can pass common English names that map to trackSurfacePresets keys
const MATERIAL_SURFACE_ALIASES = {
    glass:       'crystal',
    stone:       'obsidian',
    lava:        'volcanicRock',
    volcanic:    'volcanicRock',
    dirt:        'sand',
    rock:        'obsidian',
    steel:       'metal',
    tile:        'metal',
    carpet:      'rubber',
    grass:       'sand',
};

export class PhysicsFactoryMethods {
    isStaticBatchingEnabled() {
        if (this.rendererType === 'simple-webgl' || window.usingSimpleRenderer) return false
        const params = new URLSearchParams(window.location.search)
        return !(params.get('staticBatch') === '0' || params.has('noStaticBatch') || params.has('noBatch'))
    }

    resolveStaticSurfacePreset(materialPreset) {
        if (typeof materialPreset === 'string') {
            const key = MATERIAL_SURFACE_ALIASES[materialPreset] || materialPreset
            return trackSurfacePresets[key] || null
        }
        return materialPreset && typeof materialPreset === 'object' ? materialPreset : null
    }

    createStaticMaterialInstance(color, materialPreset, surfacePreset = null) {
        const matInstance = this.material.createInstance()
        const baseColor = (surfacePreset && surfacePreset.baseColor) ? surfacePreset.baseColor : color
        matInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, baseColor)

        if (surfacePreset) {
            applyFullPreset(matInstance, surfacePreset, this.hasProceduralMaterial, this.Filament)
        } else {
            matInstance.setFloatParameter('roughness', DEFAULT_SURFACE_ROUGHNESS)
            if (this.hasProceduralMaterial) {
                matInstance.setFloatParameter('bumpScale', 0.01)
                matInstance.setFloatParameter('bumpFrequency', 20.0)
            }
        }

        return matInstance
    }

    getStaticBatchKey(color, materialPreset, surfacePreset) {
        const presetKey = typeof materialPreset === 'string'
            ? `preset:${MATERIAL_SURFACE_ALIASES[materialPreset] || materialPreset}`
            : `preset-object:${JSON.stringify(surfacePreset || null)}`
        const colorKey = surfacePreset?.baseColor
            ? 'preset-color'
            : (color || []).map(v => Number(v).toFixed(3)).join(',')
        return `${presetKey}|color:${colorKey}`
    }

    queueStaticBoxBatch(pos, rotation, halfExtents, color, materialPreset, surfacePreset) {
        if (!this._staticBoxBatchGroups) this._staticBoxBatchGroups = new Map()

        const key = this.getStaticBatchKey(color, materialPreset, surfacePreset)
        let group = this._staticBoxBatchGroups.get(key)
        if (!group) {
            group = {
                key,
                color: [...color],
                materialPreset,
                surfacePreset,
                instances: []
            }
            this._staticBoxBatchGroups.set(key, group)
        }

        group.instances.push({
            position: [pos.x, pos.y, pos.z],
            rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
            scale: [halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2]
        })
    }

    flushStaticBatches() {
        const groups = this._staticBoxBatchGroups
        if (!groups || groups.size === 0) {
            this.staticBatchStats = { groups: 0, boxes: 0, collapsedEntities: 0 }
            return
        }

        if (!this.staticBatchResources) this.staticBatchResources = []

        let boxes = 0
        let groupsBuilt = 0
        for (const group of groups.values()) {
            if (!group.instances.length) continue
            const batch = batchBoxGeometry(CUBE_VERTICES, CUBE_INDICES, group.instances)
            const { vb, ib } = buildBatchedBuffers(this.Filament, this.engine, batch, 9)
            const matInstance = this.createStaticMaterialInstance(group.color, group.materialPreset, group.surfacePreset)
            const bounds = computeBatchBounds(group.instances)
            const radius = Math.hypot(bounds.halfExtent[0], bounds.halfExtent[1], bounds.halfExtent[2])
            const entity = createBatchedRenderable(this.engine, this.scene, this.Filament, vb, ib, matInstance, bounds)

            this.staticEntities.push(entity)
            this.staticBatchResources.push({ entity, vb, ib, matInstance, bounds, radius, boxes: group.instances.length })
            boxes += group.instances.length
            groupsBuilt += 1
        }

        this.staticBatchStats = {
            groups: groupsBuilt,
            boxes,
            collapsedEntities: Math.max(0, boxes - groupsBuilt)
        }
        window.staticBatchStats = this.staticBatchStats
        console.info('[BATCH] static boxes', this.staticBatchStats)
        groups.clear()
    }

    createPhaseBox(pos, rotation, halfExtents, color, material = 'glass') {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(rotation)
        const body = this.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        const collider = this.world.createCollider(colliderDesc, body)
        // Group 2, collides with Group 1
        collider.setCollisionGroups(0x00020001)
        this.staticBodies.push(body)

        audio.registerBodyMaterial(body, material)

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, color)
        matInstance.setFloatParameter('roughness', 0.2) // Glassy
        if (this.hasProceduralMaterial) {
            matInstance.setFloatParameter('reflectance', 1.0)
            matInstance.setFloatParameter('clearCoat', 1.0)
            matInstance.setFloatParameter('clearCoatRoughness', 0.0)
            matInstance.setFloatParameter('bumpScale', 0.0)
            matInstance.setFloatParameter('bumpFrequency', 0.0)
        }

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity)

        const tcm = this.engine.getTransformManager()
        const inst = tcm.getInstance(entity)

        const mat = quaternionToMat4(pos, rotation)
        const sx = halfExtents.x * 2
        const sy = halfExtents.y * 2
        const sz = halfExtents.z * 2

        mat[0] *= sx; mat[1] *= sx; mat[2] *= sx
        mat[4] *= sy; mat[5] *= sy; mat[6] *= sy
        mat[8] *= sz; mat[9] *= sz; mat[10] *= sz

        tcm.setTransform(inst, mat)
        this.scene.addEntity(entity)
        this.staticEntities.push(entity)
    }

    createStaticBox(pos, rotation, halfExtents, color, materialPreset = null) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(rotation)
        const body = this.world.createRigidBody(bodyDesc)
        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        this.world.createCollider(colliderDesc, body)
        this.staticBodies.push(body)

        // Resolve surface preset: string key → trackSurfacePresets lookup (with alias)
        const surfacePreset = this.resolveStaticSurfacePreset(materialPreset)

        // Use preset name for audio if provided, otherwise default
        const audioMaterial = typeof materialPreset === 'string' ? materialPreset : 'wood'
        audio.registerBodyMaterial(body, audioMaterial)

        if (this.isStaticBatchingEnabled()) {
            this.queueStaticBoxBatch(pos, rotation, halfExtents, color, materialPreset, surfacePreset)

            if (surfacePreset && surfacePreset.emissiveIntensity > 0 && surfacePreset.emissive) {
                const lightEntity = this.Filament.EntityManager.get().create()
                const lightColor = surfacePreset.emissive
                const lightIntensity = surfacePreset.emissiveIntensity * 8000
                this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].POINT)
                    .color(lightColor)
                    .intensity(lightIntensity)
                    .falloff(15.0)
                    .build(this.engine, lightEntity)
                const ltcm = this.engine.getTransformManager()
                const linst = ltcm.getInstance(lightEntity)
                const lmat = [1,0,0,0, 0,1,0,0, 0,0,1,0, pos.x, pos.y + halfExtents.y, pos.z, 1]
                ltcm.setTransform(linst, lmat)
                this.scene.addEntity(lightEntity)
                this.staticEntities.push(lightEntity)
            }

            return
        }

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.createStaticMaterialInstance(color, materialPreset, surfacePreset)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity)

        const tcm = this.engine.getTransformManager()
        const inst = tcm.getInstance(entity)

        const mat = quaternionToMat4(pos, rotation)
        const sx = halfExtents.x * 2
        const sy = halfExtents.y * 2
        const sz = halfExtents.z * 2

        mat[0] *= sx; mat[1] *= sx; mat[2] *= sx
        mat[4] *= sy; mat[5] *= sy; mat[6] *= sy
        mat[8] *= sz; mat[9] *= sz; mat[10] *= sz

        tcm.setTransform(inst, mat)
        this.scene.addEntity(entity)
        this.staticEntities.push(entity)

        // Spawn an emissive proxy point light for glowing surfaces (e.g. volcanic rock, crystal)
        if (surfacePreset && surfacePreset.emissiveIntensity > 0 && surfacePreset.emissive) {
            const lightEntity = this.Filament.EntityManager.get().create()
            const lightColor = surfacePreset.emissive
            const lightIntensity = surfacePreset.emissiveIntensity * 8000
            this.Filament.LightManager.Builder(this.Filament['LightManager$Type'].POINT)
                .color(lightColor)
                .intensity(lightIntensity)
                .falloff(15.0)
                .build(this.engine, lightEntity)
            // Position the light at the surface centre
            const ltcm = this.engine.getTransformManager()
            const linst = ltcm.getInstance(lightEntity)
            const lmat = [1,0,0,0, 0,1,0,0, 0,0,1,0, pos.x, pos.y + halfExtents.y, pos.z, 1]
            ltcm.setTransform(linst, lmat)
            this.scene.addEntity(lightEntity)
            this.staticEntities.push(lightEntity)
        }
    }

    createDynamicBox(pos, rotation, halfExtents, color, density = 1.0, material = 'wood', gravityScale = 1.0) {
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(rotation)
        if (gravityScale !== 1.0) bodyDesc.setGravityScale(gravityScale)
        const body = this.world.createRigidBody(bodyDesc)

        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
            .setDensity(density)
        this.world.createCollider(colliderDesc, body)

        audio.registerBodyMaterial(body, material)

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, color)
        matInstance.setFloatParameter('roughness', 0.4)
        if (this.hasProceduralMaterial) {
            matInstance.setFloatParameter('bumpScale', 0.02)
            matInstance.setFloatParameter('bumpFrequency', 25.0)
        }

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity)

        this.scene.addEntity(entity)

        this.dynamicObjects.push({
            rigidBody: body,
            entity: entity,
            halfExtents: halfExtents
        })
        this.dynamicBodies.add(body)
    }

    createRotatingBox(pos, halfExtents, color, axis = 'y', speed = 0.01, initialAngle = 0, material = 'metal') {
        const rotation = quatFromEuler(0, initialAngle, 0) // Assume Y axis for now

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation(rotation)
        const body = this.world.createRigidBody(bodyDesc)

        const colliderDesc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        this.world.createCollider(colliderDesc, body)

        if (audio && audio.registerBodyMaterial) {
             audio.registerBodyMaterial(body, material)
        }

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, color)
        matInstance.setFloatParameter('roughness', 0.2)
        if (this.hasProceduralMaterial) {
            matInstance.setFloatParameter('metallic', 0.6)
            matInstance.setFloatParameter('reflectance', 0.8)
            matInstance.setFloatParameter('bumpScale', 0.01)
            matInstance.setFloatParameter('bumpFrequency', 30.0)
        }

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(this.engine, entity)

        this.scene.addEntity(entity)

        this.rotatingPlatforms.push({
            rigidBody: body,
            entity: entity,
            halfExtents: halfExtents,
            axis: axis,
            speed: speed,
            angle: initialAngle,
            pos: pos
        })
    }
}

export function applyPhysicsFactoryMethods(targetClass) {
    for (const name of Object.getOwnPropertyNames(PhysicsFactoryMethods.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = PhysicsFactoryMethods.prototype[name];
        }
    }
}
