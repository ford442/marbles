import RAPIER from '@dimforge/rapier3d-compat';
import { quatFromEuler, quaternionToMat4 } from './math.js';
import { audio } from './audio.js';
import { materialPresets } from './material-system.js';

export class PhysicsFactoryMethods {
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

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.vb, this.ib)
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

        // Use preset name for audio if provided, otherwise default
        const audioMaterial = typeof materialPreset === 'string' ? materialPreset : 'wood';
        audio.registerBodyMaterial(body, audioMaterial)

        const entity = this.Filament.EntityManager.get().create()
        const matInstance = this.material.createInstance()
        matInstance.setColor3Parameter('baseColor', this.Filament['RgbType'].sRGB, color)

        // Apply PBR properties from preset if provided
        if (materialPreset && typeof materialPreset === 'object') {
            matInstance.setFloatParameter('roughness', materialPreset.roughness ?? 0.4)
            if (materialPreset.metallic !== undefined) {
                matInstance.setFloatParameter('metallic', materialPreset.metallic)
            }
            if (materialPreset.reflectance !== undefined) {
                matInstance.setFloatParameter('reflectance', materialPreset.reflectance)
            }
            if (materialPreset.clearCoat !== undefined && materialPreset.clearCoat > 0) {
                matInstance.setFloatParameter('clearCoat', materialPreset.clearCoat)
                matInstance.setFloatParameter('clearCoatRoughness', materialPreset.clearCoatRoughness ?? 0.0)
            }
        } else {
            matInstance.setFloatParameter('roughness', 0.4)
        }

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, this.Filament['RenderableManager$PrimitiveType'].TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
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
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color)
        matInstance.setFloatParameter('roughness', 0.4)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
            .build(this.engine, entity)

        this.scene.addEntity(entity)

        this.dynamicObjects.push({
            rigidBody: body,
            entity: entity,
            halfExtents: halfExtents
        })
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
        matInstance.setColor3Parameter('baseColor', this.Filament.RgbType.sRGB, color)
        matInstance.setFloatParameter('roughness', 0.2)

        this.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, this.Filament.RenderableManager$PrimitiveType.TRIANGLES, this.vb, this.ib)
            .receiveShadows(true)
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
