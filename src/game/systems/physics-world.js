import RAPIER from '@dimforge/rapier3d-compat';
import { quatFromEuler, quaternionToMat4 } from '../../math.js';
import { audio } from '../../audio.js';
import { applyFullPreset } from '../../material-system.js';
import { CUBE_VERTICES, CUBE_INDICES } from '../../cube-geometry.js';
import {
    batchBoxGeometry,
    batchGeometry,
    buildBatchedBuffers,
    computeBatchBounds,
    computeMeshBatchBounds,
    createBatchedRenderable,
} from '../../gpu-instancing.js';
import {
    DECORATIVE_PRIMITIVES,
    DECORATIVE_VERTEX_STRIDE,
} from '../../decorative-primitives.js';
import {
    getStaticBatchKey,
    isStaticBatchingEnabled,
    resolveStaticSurfacePreset,
} from './physics-world-pure.js';

const DEFAULT_SURFACE_ROUGHNESS = 0.4;

/**
 * Rapier world lifecycle + static/dynamic body factories (Phase B subsystem).
 */
export class PhysicsWorld {
    /** @param {object} game */
    constructor(game) {
        this.game = game;
    }

    /** @param {{ x: number, y: number, z: number }} [gravity] */
    init(gravity = { x: 0.0, y: -9.81, z: 0.0 }) {
        const g = this.game;
        g.physicsGravity = gravity;
        g.world = new RAPIER.World(gravity);
        return g.world;
    }

    step() {
        const backend = this.game.physicsBackend;
        if (backend?.isWorkerMode?.()) {
            backend.step();
            return;
        }
        this.game.world?.step();
    }

    _isWorkerMode() {
        return Boolean(this.game.physicsBackend?.isWorkerMode?.());
    }

    _rotationArray(rotation) {
        if (rotation?.w != null) {
            return [rotation.x, rotation.y, rotation.z, rotation.w];
        }
        return rotation || [0, 0, 0, 1];
    }

    /**
     * @param {'fixed'|'dynamic'|'kinematic'} type
     * @param {{ x: number, y: number, z: number }} pos
     * @param {object} rotation
     * @param {object} collider
     * @param {object} [options]
     */
    _createSimBody(type, pos, rotation, collider, options = {}) {
        const g = this.game;
        if (this._isWorkerMode()) {
            return g.physicsBackend.registerBody({
                type,
                translation: [pos.x, pos.y, pos.z],
                rotation: this._rotationArray(rotation),
                collider: {
                    ...collider,
                    halfExtents: collider.halfExtents?.x != null
                        ? [collider.halfExtents.x, collider.halfExtents.y, collider.halfExtents.z]
                        : collider.halfExtents,
                },
                gravityScale: options.gravityScale,
                linearDamping: options.linearDamping,
                angularDamping: options.angularDamping,
                canSleep: options.canSleep,
            });
        }

        let bodyDesc;
        if (type === 'fixed') {
            bodyDesc = RAPIER.RigidBodyDesc.fixed()
                .setTranslation(pos.x, pos.y, pos.z)
                .setRotation(rotation);
        } else if (type === 'kinematic') {
            bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
                .setTranslation(pos.x, pos.y, pos.z)
                .setRotation(rotation);
        } else {
            bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(pos.x, pos.y, pos.z)
                .setRotation(rotation);
            if (options.gravityScale != null) bodyDesc.setGravityScale(options.gravityScale);
            if (options.linearDamping != null) bodyDesc.setLinearDamping(options.linearDamping);
            if (options.angularDamping != null) bodyDesc.setAngularDamping(options.angularDamping);
            if (options.canSleep === false) bodyDesc.setCanSleep(false);
        }

        const body = g.world.createRigidBody(bodyDesc);
        let colliderDesc;
        if (collider.type === 'ball') {
            colliderDesc = RAPIER.ColliderDesc.ball(collider.radius ?? 0.5);
        } else if (collider.type === 'sensor_ball') {
            colliderDesc = RAPIER.ColliderDesc.ball(collider.radius ?? 0.5).setSensor(true);
        } else {
            const h = collider.halfExtents;
            colliderDesc = RAPIER.ColliderDesc.cuboid(h.x, h.y, h.z);
        }
        if (collider.density != null) colliderDesc.setDensity(collider.density);
        if (collider.friction != null) colliderDesc.setFriction(collider.friction);
        if (collider.restitution != null) colliderDesc.setRestitution(collider.restitution);
        if (collider.collisionGroups != null) colliderDesc.setCollisionGroups(collider.collisionGroups);
        const coll = g.world.createCollider(colliderDesc, body);
        void coll;
        return body;
    }

    isStaticBatchingEnabled() {
        const g = this.game;
        return isStaticBatchingEnabled({
            rendererType: g.rendererType,
            usingSimpleRenderer: typeof window !== 'undefined' ? window.usingSimpleRenderer : false,
        });
    }

    resolveStaticSurfacePreset(materialPreset) {
        return resolveStaticSurfacePreset(materialPreset);
    }

    getStaticBatchKey(color, materialPreset, surfacePreset) {
        return getStaticBatchKey(color, materialPreset, surfacePreset);
    }

    createStaticMaterialInstance(color, materialPreset, surfacePreset = null) {
        const g = this.game;
        const matInstance = g.material.createInstance();
        const baseColor = surfacePreset?.baseColor ? surfacePreset.baseColor : color;
        matInstance.setColor3Parameter('baseColor', g.Filament['RgbType'].sRGB, baseColor);

        if (surfacePreset) {
            applyFullPreset(matInstance, surfacePreset, g.hasProceduralMaterial, g.Filament);
        } else {
            matInstance.setFloatParameter('roughness', DEFAULT_SURFACE_ROUGHNESS);
            if (g.hasProceduralMaterial) {
                matInstance.setFloatParameter('bumpScale', 0.01);
                matInstance.setFloatParameter('bumpFrequency', 20.0);
            }
        }

        return matInstance;
    }

    queueStaticBoxBatch(pos, rotation, halfExtents, color, materialPreset, surfacePreset) {
        const g = this.game;
        if (!g._staticBoxBatchGroups) g._staticBoxBatchGroups = new Map();

        const key = getStaticBatchKey(color, materialPreset, surfacePreset);
        let group = g._staticBoxBatchGroups.get(key);
        if (!group) {
            group = {
                key,
                color: [...color],
                materialPreset,
                surfacePreset,
                instances: [],
            };
            g._staticBoxBatchGroups.set(key, group);
        }

        group.instances.push({
            position: [pos.x, pos.y, pos.z],
            rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
            scale: [halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2],
        });
    }

    getDecorativeBatchKey(primitiveType, color, materialPreset, surfacePreset) {
        return `${primitiveType}|${getStaticBatchKey(color, materialPreset, surfacePreset)}`;
    }

    queueDecorativeBatch(primitiveType, instances, color, materialPreset = null) {
        const g = this.game;
        if (!DECORATIVE_PRIMITIVES[primitiveType]) {
            console.warn(`[BATCH] unknown decorative primitive: ${primitiveType}`);
            return;
        }
        if (!g._decorativeBatchGroups) g._decorativeBatchGroups = new Map();

        const surfacePreset = resolveStaticSurfacePreset(materialPreset);
        const key = this.getDecorativeBatchKey(primitiveType, color, materialPreset, surfacePreset);
        let group = g._decorativeBatchGroups.get(key);
        if (!group) {
            group = {
                key,
                primitiveType,
                color: [...color],
                materialPreset,
                surfacePreset,
                instances: [],
            };
            g._decorativeBatchGroups.set(key, group);
        }
        group.instances.push(...instances);
    }

    queueDecorativeBoxes(instances, color, materialPreset = null) {
        if (!instances?.length) return;
        const surfacePreset = resolveStaticSurfacePreset(materialPreset);
        for (const inst of instances) {
            const pos = inst.position || [0, 0, 0];
            const rot = inst.rotation || [0, 0, 0, 1];
            const scl = inst.scale || [1, 1, 1];
            this.queueStaticBoxBatch(
                { x: pos[0], y: pos[1], z: pos[2] },
                { x: rot[0], y: rot[1], z: rot[2], w: rot[3] },
                { x: scl[0] / 2, y: scl[1] / 2, z: scl[2] / 2 },
                color,
                materialPreset,
                surfacePreset,
            );
        }
    }

    flushDecorativeBatches() {
        const g = this.game;
        const groups = g._decorativeBatchGroups;
        if (!groups || groups.size === 0) {
            return { groups: 0, instances: 0, collapsedEntities: 0 };
        }

        if (!g.staticBatchResources) g.staticBatchResources = [];

        let instances = 0;
        let groupsBuilt = 0;
        for (const group of groups.values()) {
            if (!group.instances.length) continue;
            const mesh = DECORATIVE_PRIMITIVES[group.primitiveType];
            const batch = batchGeometry(mesh.vertices, mesh.indices, group.instances, DECORATIVE_VERTEX_STRIDE);
            const { vb, ib } = buildBatchedBuffers(g.Filament, g.engine, batch, DECORATIVE_VERTEX_STRIDE);
            const matInstance = this.createStaticMaterialInstance(group.color, group.materialPreset, group.surfacePreset);
            const bounds = computeMeshBatchBounds(mesh.vertices, mesh.indices, group.instances, DECORATIVE_VERTEX_STRIDE);
            const radius = Math.hypot(bounds.halfExtent[0], bounds.halfExtent[1], bounds.halfExtent[2]);
            const entity = createBatchedRenderable(g.engine, g.scene, g.Filament, vb, ib, matInstance, bounds);

            g.staticEntities.push(entity);
            g.staticBatchResources.push({
                entity,
                vb,
                ib,
                matInstance,
                bounds,
                radius,
                boxes: group.instances.length,
                decorative: group.primitiveType,
            });
            instances += group.instances.length;
            groupsBuilt += 1;
        }

        groups.clear();
        return {
            groups: groupsBuilt,
            instances,
            collapsedEntities: Math.max(0, instances - groupsBuilt),
        };
    }

    flushStaticBatches() {
        const g = this.game;
        const groups = g._staticBoxBatchGroups;
        if (!g.staticBatchResources) g.staticBatchResources = [];

        let boxes = 0;
        let groupsBuilt = 0;
        if (groups && groups.size > 0) {
            for (const group of groups.values()) {
                if (!group.instances.length) continue;
                const batch = batchBoxGeometry(CUBE_VERTICES, CUBE_INDICES, group.instances);
                const { vb, ib } = buildBatchedBuffers(g.Filament, g.engine, batch, 9);
                const matInstance = this.createStaticMaterialInstance(group.color, group.materialPreset, group.surfacePreset);
                const bounds = computeBatchBounds(group.instances);
                const radius = Math.hypot(bounds.halfExtent[0], bounds.halfExtent[1], bounds.halfExtent[2]);
                const entity = createBatchedRenderable(g.engine, g.scene, g.Filament, vb, ib, matInstance, bounds);

                g.staticEntities.push(entity);
                g.staticBatchResources.push({ entity, vb, ib, matInstance, bounds, radius, boxes: group.instances.length });
                boxes += group.instances.length;
                groupsBuilt += 1;
            }
            groups.clear();
        }

        g.staticBatchStats = {
            groups: groupsBuilt,
            boxes,
            collapsedEntities: Math.max(0, boxes - groupsBuilt),
            decorative: { groups: 0, instances: 0, collapsedEntities: 0 },
        };

        if (this.isStaticBatchingEnabled()) {
            const decorativeStats = this.flushDecorativeBatches();
            g.staticBatchStats.decorative = decorativeStats;
            g.staticBatchStats.groups += decorativeStats.groups;
            g.staticBatchStats.collapsedEntities += decorativeStats.collapsedEntities;
        }

        if (typeof window !== 'undefined') {
            window.staticBatchStats = g.staticBatchStats;
        }
        console.info('[BATCH] static boxes', g.staticBatchStats);
    }

    createPhaseBox(pos, rotation, halfExtents, color, material = 'glass') {
        const g = this.game;
        const body = this._createSimBody('fixed', pos, rotation, {
            type: 'cuboid',
            halfExtents,
            collisionGroups: 0x00020001,
        });
        g.staticBodies.push(body);

        audio.registerBodyMaterial(body, material);

        const entity = g.Filament.EntityManager.get().create();
        const matInstance = g.material.createInstance();
        matInstance.setColor3Parameter('baseColor', g.Filament['RgbType'].sRGB, color);
        matInstance.setFloatParameter('roughness', 0.2);
        if (g.hasProceduralMaterial) {
            matInstance.setFloatParameter('reflectance', 1.0);
            matInstance.setFloatParameter('clearCoat', 1.0);
            matInstance.setFloatParameter('clearCoatRoughness', 0.0);
            matInstance.setFloatParameter('bumpScale', 0.0);
            matInstance.setFloatParameter('bumpFrequency', 0.0);
        }

        g.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, g.Filament['RenderableManager$PrimitiveType'].TRIANGLES, g.vb, g.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(g.engine, entity);

        const tcm = g.engine.getTransformManager();
        const inst = tcm.getInstance(entity);

        const mat = quaternionToMat4(pos, rotation);
        const sx = halfExtents.x * 2;
        const sy = halfExtents.y * 2;
        const sz = halfExtents.z * 2;

        mat[0] *= sx; mat[1] *= sx; mat[2] *= sx;
        mat[4] *= sy; mat[5] *= sy; mat[6] *= sy;
        mat[8] *= sz; mat[9] *= sz; mat[10] *= sz;

        tcm.setTransform(inst, mat);
        g.scene.addEntity(entity);
        g.staticEntities.push(entity);
    }

    createStaticBox(pos, rotation, halfExtents, color, materialPreset = null) {
        const g = this.game;
        const body = this._createSimBody('fixed', pos, rotation, {
            type: 'cuboid',
            halfExtents,
        });
        g.staticBodies.push(body);

        const surfacePreset = resolveStaticSurfacePreset(materialPreset);
        const audioMaterial = typeof materialPreset === 'string' ? materialPreset : 'wood';
        audio.registerBodyMaterial(body, audioMaterial);

        if (this.isStaticBatchingEnabled()) {
            this.queueStaticBoxBatch(pos, rotation, halfExtents, color, materialPreset, surfacePreset);

            if (surfacePreset?.emissiveIntensity > 0 && surfacePreset.emissive) {
                const lightEntity = g.Filament.EntityManager.get().create();
                const lightColor = surfacePreset.emissive;
                const lightIntensity = surfacePreset.emissiveIntensity * 8000;
                g.Filament.LightManager.Builder(g.Filament['LightManager$Type'].POINT)
                    .color(lightColor)
                    .intensity(lightIntensity)
                    .falloff(15.0)
                    .build(g.engine, lightEntity);
                const ltcm = g.engine.getTransformManager();
                const linst = ltcm.getInstance(lightEntity);
                const lmat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, pos.x, pos.y + halfExtents.y, pos.z, 1];
                ltcm.setTransform(linst, lmat);
                g.scene.addEntity(lightEntity);
                g.staticEntities.push(lightEntity);
            }

            return;
        }

        const entity = g.Filament.EntityManager.get().create();
        const matInstance = this.createStaticMaterialInstance(color, materialPreset, surfacePreset);

        g.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [0.5, 0.5, 0.5] })
            .material(0, matInstance)
            .geometry(0, g.Filament['RenderableManager$PrimitiveType'].TRIANGLES, g.vb, g.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(g.engine, entity);

        const tcm = g.engine.getTransformManager();
        const inst = tcm.getInstance(entity);

        const mat = quaternionToMat4(pos, rotation);
        const sx = halfExtents.x * 2;
        const sy = halfExtents.y * 2;
        const sz = halfExtents.z * 2;

        mat[0] *= sx; mat[1] *= sx; mat[2] *= sx;
        mat[4] *= sy; mat[5] *= sy; mat[6] *= sy;
        mat[8] *= sz; mat[9] *= sz; mat[10] *= sz;

        tcm.setTransform(inst, mat);
        g.scene.addEntity(entity);
        g.staticEntities.push(entity);

        if (surfacePreset?.emissiveIntensity > 0 && surfacePreset.emissive) {
            const lightEntity = g.Filament.EntityManager.get().create();
            const lightColor = surfacePreset.emissive;
            const lightIntensity = surfacePreset.emissiveIntensity * 8000;
            g.Filament.LightManager.Builder(g.Filament['LightManager$Type'].POINT)
                .color(lightColor)
                .intensity(lightIntensity)
                .falloff(15.0)
                .build(g.engine, lightEntity);
            const ltcm = g.engine.getTransformManager();
            const linst = ltcm.getInstance(lightEntity);
            const lmat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, pos.x, pos.y + halfExtents.y, pos.z, 1];
            ltcm.setTransform(linst, lmat);
            g.scene.addEntity(lightEntity);
            g.staticEntities.push(lightEntity);
        }
    }

    createDynamicBox(pos, rotation, halfExtents, color, density = 1.0, material = 'wood', gravityScale = 1.0) {
        const g = this.game;
        const body = this._createSimBody('dynamic', pos, rotation, {
            type: 'cuboid',
            halfExtents,
            density,
        }, { gravityScale });

        audio.registerBodyMaterial(body, material);

        const entity = g.Filament.EntityManager.get().create();
        const matInstance = g.material.createInstance();
        matInstance.setColor3Parameter('baseColor', g.Filament['RgbType'].sRGB, color);
        matInstance.setFloatParameter('roughness', 0.4);
        if (g.hasProceduralMaterial) {
            matInstance.setFloatParameter('bumpScale', 0.02);
            matInstance.setFloatParameter('bumpFrequency', 25.0);
        }

        g.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, g.Filament['RenderableManager$PrimitiveType'].TRIANGLES, g.vb, g.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(g.engine, entity);

        g.scene.addEntity(entity);

        g.dynamicObjects.push({
            rigidBody: body,
            entity,
            halfExtents,
        });
        g.dynamicBodies.add(body);
    }

    createRotatingBox(pos, halfExtents, color, axis = 'y', speed = 0.01, initialAngle = 0, material = 'metal') {
        const g = this.game;
        const rotation = quatFromEuler(0, initialAngle, 0);

        const body = this._createSimBody('kinematic', pos, rotation, {
            type: 'cuboid',
            halfExtents,
        });

        if (audio?.registerBodyMaterial) {
            audio.registerBodyMaterial(body, material);
        }

        const entity = g.Filament.EntityManager.get().create();
        const matInstance = g.material.createInstance();
        matInstance.setColor3Parameter('baseColor', g.Filament['RgbType'].sRGB, color);
        matInstance.setFloatParameter('roughness', 0.2);
        if (g.hasProceduralMaterial) {
            matInstance.setFloatParameter('metallic', 0.6);
            matInstance.setFloatParameter('reflectance', 0.8);
            matInstance.setFloatParameter('bumpScale', 0.01);
            matInstance.setFloatParameter('bumpFrequency', 30.0);
        }

        g.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [halfExtents.x, halfExtents.y, halfExtents.z] })
            .material(0, matInstance)
            .geometry(0, g.Filament['RenderableManager$PrimitiveType'].TRIANGLES, g.vb, g.ib)
            .receiveShadows(true)
            .castShadows(true)
            .build(g.engine, entity);

        g.scene.addEntity(entity);

        g.rotatingPlatforms.push({
            rigidBody: body,
            entity,
            halfExtents,
            axis,
            speed,
            angle: initialAngle,
            pos,
        });
    }

    /**
     * Spawn an authoritative network marble for host simulation (Phase 3).
     * @param {string} playerId
     * @param {{ x: number, y: number, z: number }} spawn
     * @param {number} colorIndex
     */
    createNetworkMarble(playerId, spawn, colorIndex = 0) {
        const g = this.game;
        if (!g.networkMarbles) g.networkMarbles = new Map();

        const radius = 0.5;
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawn.x, spawn.y, spawn.z)
            .setCanSleep(false);
        const rigidBody = g.world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.ball(radius)
            .setRestitution(0.5)
            .setFriction(0.5)
            .setDensity(1.0);
        g.world.createCollider(colliderDesc, rigidBody);

        const palette = [
            [1.0, 0.35, 0.45],
            [0.35, 0.85, 1.0],
            [0.55, 1.0, 0.45],
            [1.0, 0.85, 0.25],
        ];
        const color = palette[colorIndex % palette.length];

        const entity = g.Filament.EntityManager.get().create();
        const matInstance = g.material.createInstance();
        matInstance.setColor3Parameter('baseColor', g.Filament.RgbType.sRGB, color);
        matInstance.setFloatParameter('roughness', 0.25);

        g.Filament.RenderableManager.Builder(1)
            .boundingBox({ center: [0, 0, 0], halfExtent: [radius, radius, radius] })
            .material(0, matInstance)
            .geometry(0, g.Filament.RenderableManager$PrimitiveType.TRIANGLES, g.sphereVb, g.sphereIb)
            .receiveShadows(true)
            .castShadows(true)
            .build(g.engine, entity);

        g.scene.addEntity(entity);

        const entry = { playerId, rigidBody, entity, matInstance, colorIndex };
        g.networkMarbles.set(playerId, entry);
        g.dynamicBodies.add(rigidBody);
        return entry;
    }

    /**
     * Apply decoded input snapshot to a network marble (host authority).
     * @param {string} playerId
     * @param {number} bits
     * @param {number} yaw
     * @param {number} pitch
     */
    applyInputToMarble(playerId, bits, yaw, pitch) {
        const g = this.game;
        const entry = g.networkMarbles?.get(playerId);
        if (!entry?.rigidBody) return;

        const impulseStrength = 0.5;
        const forwardX = Math.sin(yaw);
        const forwardZ = Math.cos(yaw);
        const rightX = Math.sin(yaw - Math.PI / 2);
        const rightZ = Math.cos(yaw - Math.PI / 2);
        const body = entry.rigidBody;

        if (bits & 1) body.applyImpulse({ x: forwardX * impulseStrength, y: 0, z: forwardZ * impulseStrength }, true);
        if (bits & 2) body.applyImpulse({ x: -forwardX * impulseStrength, y: 0, z: -forwardZ * impulseStrength }, true);
        if (bits & 4) body.applyImpulse({ x: rightX * impulseStrength, y: 0, z: rightZ * impulseStrength }, true);
        if (bits & 8) body.applyImpulse({ x: -rightX * impulseStrength, y: 0, z: -rightZ * impulseStrength }, true);

        void pitch;
    }

    removeNetworkMarbles() {
        const g = this.game;
        if (!g.networkMarbles) return;
        for (const entry of g.networkMarbles.values()) {
            g.dynamicBodies.delete(entry.rigidBody);
            g.world.removeRigidBody(entry.rigidBody);
            g.scene.remove(entry.entity);
            if (entry.matInstance) g.engine.destroyMaterialInstance(entry.matInstance);
            g.engine.destroyEntity(entry.entity);
            g.Filament.EntityManager.get().destroy(entry.entity);
        }
        g.networkMarbles.clear();
    }
}

export {
    getStaticBatchKey,
    isStaticBatchingEnabled,
    MATERIAL_SURFACE_ALIASES,
    resolveStaticSurfacePreset,
} from './physics-world-pure.js';
