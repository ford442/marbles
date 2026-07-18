import RAPIER from '@dimforge/rapier3d-compat';
import { quatFromEuler } from '../math.js';
import { audio } from '../audio.js';
import { resolveAssetModelPath, modelBasePath } from './model-paths.js';
import {
    parseGlbMeshes,
    mergeMeshes,
    transformPositions,
    computeMeshBounds,
} from './glb-mesh-parser.js';

/**
 * @typedef {object} TrackModelEntry
 * @property {string} modelPath
 * @property {{ x: number, y: number, z: number }} offset
 * @property {{ center: number[], halfExtent: number[], radius: number }} bounds
 * @property {object[]} renderGroups
 * @property {number} activeLod
 * @property {{ distance: number, model: string }[]} lodLevels
 * @property {object} [asset]
 * @property {number[]} entities
 */

/**
 * Ensure a singleton Filament gltfio AssetLoader exists on the game instance.
 * @param {object} game
 */
export function ensureGltfAssetLoader(game) {
    if (game.gltfAssetLoader || !game.engine?.createAssetLoader) return game.gltfAssetLoader;
    game.gltfAssetLoader = game.engine.createAssetLoader();
    return game.gltfAssetLoader;
}

/**
 * Load a GLB/GLTF track model: Filament renderables + Rapier collider.
 * Falls back to box track geometry when fetch or parse fails.
 *
 * @param {object} game
 * @param {object} zone
 * @param {{ x: number, y: number, z: number }} offset
 */
export async function createModelZone(game, zone, offset) {
    const modelRef = zone.model;
    const modelPath = resolveAssetModelPath(modelRef);
    if (!modelPath) {
        console.warn('[TRACK] Zone missing model path, using box fallback');
        game.createTrackZone(offset);
        return;
    }

    let buffer;
    try {
        const response = await fetch(modelPath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        buffer = await response.arrayBuffer();
    } catch (error) {
        console.warn(`[TRACK] Failed to fetch ${modelPath}:`, error);
        game.createTrackZone(offset);
        return;
    }

    let meshes;
    try {
        meshes = parseGlbMeshes(buffer);
    } catch (error) {
        console.warn(`[TRACK] Failed to parse ${modelPath}:`, error);
        game.createTrackZone(offset);
        return;
    }

    const scale = zone.scale ?? 1;
    const rotY = zone.rotY ?? 0;
    const colliderType = zone.collider || 'trimesh';
    const friction = zone.friction ?? 0.5;
    const material = zone.material || 'metal';

    const merged = mergeMeshes(meshes);
    const localPositions = transformPositions(merged.positions, scale, rotY);
    const bounds = computeMeshBounds(localPositions);

    if (colliderType !== 'none') {
        createMeshCollider(game, localPositions, merged.indices, offset, rotY, colliderType, friction, material);
    }

    /** @type {TrackModelEntry} */
    const entry = {
        modelPath,
        offset,
        bounds,
        renderGroups: [],
        activeLod: 0,
        lodLevels: Array.isArray(zone.lod) ? zone.lod : [],
        entities: [],
    };

    if (game.rendererType !== 'simple-webgl' && !window.usingSimpleRenderer) {
        try {
            const group = await loadFilamentRenderGroup(game, buffer, modelPath, offset, rotY, scale, zone);
            entry.renderGroups.push(group);
            entry.entities = group.entities;
            entry.asset = group.asset;
        } catch (error) {
            console.warn(`[TRACK] Filament render failed for ${modelPath}:`, error);
            spawnDebugBoxesFromBounds(game, offset, bounds, zone.color);
        }
    } else {
        spawnDebugBoxesFromBounds(game, offset, bounds, zone.color);
    }

    if (entry.lodLevels.length > 0) {
        for (const lodDef of entry.lodLevels) {
            const lodPath = resolveAssetModelPath(lodDef.model);
            if (!lodPath) continue;
            try {
                const lodResponse = await fetch(lodPath);
                if (!lodResponse.ok) continue;
                const lodBuffer = await lodResponse.arrayBuffer();
                const lodGroup = await loadFilamentRenderGroup(
                    game, lodBuffer, lodPath, offset, rotY, scale, zone
                );
                entry.renderGroups.push(lodGroup);
            } catch (error) {
                console.warn(`[TRACK] LOD load failed for ${lodDef.model}:`, error);
            }
        }

        if (entry.renderGroups.length > 1) {
            game.trackLodManager?.register(entry);
            for (let i = 1; i < entry.renderGroups.length; i++) {
                for (const entity of entry.renderGroups[i].entities) {
                    game.scene.remove(entity);
                }
            }
        }
    }

    if (!game.loadedTrackModels) game.loadedTrackModels = [];
    game.loadedTrackModels.push(entry);

    console.log(`[TRACK] Loaded model ${modelRef} (${meshes.length} mesh(es), collider=${colliderType})`);
}

/**
 * @param {object} game
 * @param {Float32Array} positions
 * @param {Uint32Array} indices
 * @param {{ x: number, y: number, z: number }} offset
 * @param {number} rotY
 * @param {string} colliderType
 * @param {number} friction
 * @param {string} material
 */
function createMeshCollider(game, positions, indices, offset, rotY, colliderType, friction, material) {
    const q = rotY ? quatFromEuler(rotY, 0, 0) : { x: 0, y: 0, z: 0, w: 1 };
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(offset.x, offset.y, offset.z)
        .setRotation(q);
    const body = game.world.createRigidBody(bodyDesc);

    let colliderDesc = null;
    if (colliderType === 'convexHull') {
        colliderDesc = RAPIER.ColliderDesc.convexHull(positions);
        if (!colliderDesc) {
            console.warn('[TRACK] convexHull failed, falling back to trimesh');
            colliderDesc = RAPIER.ColliderDesc.trimesh(positions, indices);
        }
    } else {
        colliderDesc = RAPIER.ColliderDesc.trimesh(positions, indices);
    }

    colliderDesc.setFriction(friction);
    const collider = game.world.createCollider(colliderDesc, body);
    collider.setCollisionGroups(0x00020001);
    game.staticBodies.push(body);
    audio.registerBodyMaterial(body, material);
}

/**
 * @param {object} game
 * @param {ArrayBuffer} buffer
 * @param {string} modelPath
 * @param {{ x: number, y: number, z: number }} offset
 * @param {number} rotY
 * @param {number} scale
 * @param {object} zone
 */
async function loadFilamentRenderGroup(game, buffer, modelPath, offset, rotY, scale, zone) {
    const loader = ensureGltfAssetLoader(game);
    if (!loader) throw new Error('Filament AssetLoader unavailable');

    const asset = loader.createAsset(new Uint8Array(buffer));
    const basePath = modelBasePath(modelPath);

    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('GLTF resource load timeout')), 30000);
        asset.loadResources(
            () => { clearTimeout(timeout); resolve(); },
            null,
            basePath
        );
    });

    const entities = asset.getRenderableEntities();
    if (!entities.length) throw new Error('No renderable entities in model');

    applyZoneTransform(game, entities, offset, rotY, scale);

    if (zone.materialPreset && game.material) {
        applyMaterialPresetOverride(game, entities, zone.materialPreset, zone.color);
    }

    game.scene.addEntities(entities);
    return { asset, entities };
}

/**
 * @param {object} game
 * @param {number[]} entities
 * @param {{ x: number, y: number, z: number }} offset
 * @param {number} rotY
 * @param {number} scale
 */
function applyZoneTransform(game, entities, offset, rotY, scale) {
    const tcm = game.engine.getTransformManager();
    const q = rotY ? quatFromEuler(rotY, 0, 0) : { x: 0, y: 0, z: 0, w: 1 };

    const mat = new Float32Array(16);
    mat[0] = scale; mat[5] = scale; mat[10] = scale; mat[15] = 1;
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    if (rotY) {
        mat[0] = cosY * scale;
        mat[2] = sinY * scale;
        mat[8] = -sinY * scale;
        mat[10] = cosY * scale;
    }
    mat[12] = offset.x;
    mat[13] = offset.y;
    mat[14] = offset.z;

    for (const entity of entities) {
        const inst = tcm.getInstance(entity);
        tcm.setTransform(inst, mat);
    }
}

/**
 * Optional: remap all primitives to the game's PBR material preset.
 * @param {object} game
 * @param {number[]} entities
 * @param {string} materialPreset
 * @param {number[] | undefined} color
 */
function applyMaterialPresetOverride(game, entities, materialPreset, color) {
    const rm = game.engine.getRenderableManager();
    const matInstance = game.createStaticMaterialInstance(
        color || [0.6, 0.6, 0.6],
        materialPreset
    );

    for (const entity of entities) {
        const inst = rm.getInstance(entity);
        const count = rm.getPrimitiveCount(inst);
        for (let i = 0; i < count; i++) {
            rm.setMaterialInstanceAt(inst, i, matInstance);
        }
    }
}

/**
 * Simple-renderer / failed-render fallback: approximate mesh bounds with boxes.
 */
function spawnDebugBoxesFromBounds(game, offset, bounds, color) {
    const c = color || [0.5, 0.2, 0.8];
    const q = { x: 0, y: 0, z: 0, w: 1 };
    game.createStaticBox(
        {
            x: offset.x + bounds.center[0],
            y: offset.y + bounds.center[1],
            z: offset.z + bounds.center[2],
        },
        q,
        { x: bounds.halfExtent[0], y: bounds.halfExtent[1], z: bounds.halfExtent[2] },
        c,
        'metal'
    );
}

/**
 * Release loaded track model GPU resources.
 * @param {object} game
 */
export function destroyLoadedTrackModels(game) {
    if (!game.loadedTrackModels?.length) return;

    const destroyed = new Set();
    for (const entry of game.loadedTrackModels) {
        for (const group of entry.renderGroups || []) {
            if (!group?.entities) continue;
            game.scene.removeEntities(group.entities);
            for (const entity of group.entities) {
                if (destroyed.has(entity)) continue;
                destroyed.add(entity);
                game.engine.destroyEntity(entity);
            }
            if (group.asset?.releaseSourceData) {
                try { group.asset.releaseSourceData(); } catch (_) { /* noop */ }
            }
        }
    }
    game.loadedTrackModels = [];
}
