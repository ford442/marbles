// @ts-check
import { createSphere } from './sphere.ts';
import { applyMarbleMaterialPreset } from './marble-material-tier.ts';

/** @typedef {import('./types/filament.ts').FilamentHandle} FilamentHandle */
/** @typedef {import('./types/engine-context.ts').EngineContext} EngineContext */
/** @typedef {import('./types/frame-host.ts').FrameState} FrameState */
/** @typedef {import('./types/game-state.ts').MarbleObject} MarbleObject */
/** @typedef {import('./types/geometry.ts').Vec3} Vec3 */

/** Filament buffers for one procedural sphere. */
/** @typedef {{ vb: FilamentHandle, ib: FilamentHandle, indexCount: number, vertexCount: number }} SphereMeshBuffers */

/**
 * One shared marble LOD mesh (`game.marbleLodMeshes[level]`).
 * @typedef {SphereMeshBuffers & { level: number, castShadows: boolean, widthSegments: number, heightSegments: number }} MarbleLodMesh
 */

/** Marbles per LOD tier this frame (also mirrored to `window.lodStats`). */
/** @typedef {{ lod0: number, lod1: number, lod2: number }} LodStats */

/** What building a sphere mesh needs: the Filament module / engine and the renderer kind. */
/**
 * @typedef {Pick<EngineContext, 'engine' | 'Filament'>
 *     & Pick<import('./game/systems/physics-world.ts').PhysicsWorldHost, 'rendererType'>} SphereMeshHost
 */

/**
 * `buildMarbleLodMeshes` also publishes the meshes and repoints the legacy
 * sphere buffers at LOD1.
 * @typedef {SphereMeshHost & Pick<EngineContext, 'sphereVb' | 'sphereIb'>
 *     & { marbleLodMeshes?: MarbleLodMesh[] | null }} MarbleLodMeshHost
 */

/**
 * The game members `MarbleLodManager` reads each frame (marbles, camera pose /
 * FOV, viewport, quality) plus what `applyMarbleMaterialPreset` needs after a
 * mesh swap.
 * @typedef {MarbleLodMeshHost
 *     & import('./marble-material-tier.ts').MaterialTierHost
 *     & Pick<FrameState, 'marbles' | 'playerMarble' | '_cameraState' | 'activeFov' | 'currentFov'>
 *     & Pick<import('./types/game-state.ts').GameState, 'canvas'>
 *     & Pick<import('./types/settings.ts').SettingsContext, 'settings'>} MarbleLodHost
 */

/** Distance thresholds (meters) — aligned with docs/MARBLE_RENDERING_GUIDE.md */
export const LOD_DISTANCE = {
    lod1: 12,
    lod2: 35,
};

export const LOD_HYSTERESIS_M = 2.5;
export const LOD_SWITCH_THROTTLE_MS = 500;
/** Screen-space radius (px) that can promote a marble to LOD0 in follow-cam. */
export const LOD0_MIN_SCREEN_PX = 28;
/** Dynamic culling show distance — never assign LOD0 beyond this. */
export const LOD0_MAX_CAMERA_DIST = 180;

/** @type {ReadonlyArray<{ widthSegments: number, heightSegments: number, castShadows: boolean }>} */
const LOD_SPECS = [
    { widthSegments: 48, heightSegments: 24, castShadows: true },
    { widthSegments: 16, heightSegments: 8, castShadows: true },
    { widthSegments: 8, heightSegments: 4, castShadows: false },
];

/**
 * @template T
 * @param {Array<T | null>} list
 * @returns {list is T[]}
 */
function allPresent(list) {
    return !list.some(item => !item);
}

/**
 * @param {SphereMeshHost} game
 * @param {number} radius
 * @param {number} widthSegments
 * @param {number} heightSegments
 * @returns {SphereMeshBuffers | null} null on the simple-WebGL renderer or before Filament is up.
 */
export function createFilamentSphereMesh(game, radius, widthSegments, heightSegments) {
    if (!game.engine || !game.Filament || game.rendererType === 'simple-webgl') {
        return null;
    }

    const sphereData = createSphere(radius, widthSegments, heightSegments);
    const VertexAttribute = game.Filament['VertexAttribute'];
    const AttributeType = game.Filament['VertexBuffer$AttributeType'];
    const stride = 36;
    const vb = game.Filament.VertexBuffer.Builder()
        .vertexCount(sphereData.vertices.length / 9)
        .bufferCount(1)
        .attribute(VertexAttribute.POSITION, 0, AttributeType.FLOAT3, 0, stride)
        .attribute(VertexAttribute.TANGENTS, 0, AttributeType.FLOAT4, 12, stride)
        .attribute(VertexAttribute.UV0, 0, AttributeType.FLOAT2, 28, stride)
        .build(game.engine);
    vb.setBufferAt(game.engine, 0, sphereData.vertices);

    const ib = game.Filament.IndexBuffer.Builder()
        .indexCount(sphereData.indices.length)
        .bufferType(game.Filament['IndexBuffer$IndexType'].USHORT)
        .build(game.engine);
    ib.setBuffer(game.engine, sphereData.indices);

    return {
        vb,
        ib,
        indexCount: sphereData.indices.length,
        vertexCount: sphereData.vertices.length / 9,
    };
}

/**
 * Build shared LOD0/1/2 sphere meshes once at init.
 * Sets game.marbleLodMeshes and points sphereVb/sphereIb at LOD1 for legacy callers.
 *
 * @param {MarbleLodMeshHost} game
 * @param {number} [radius]
 * @returns {MarbleLodMesh[] | null}
 */
export function buildMarbleLodMeshes(game, radius = 0.5) {
    if (game.rendererType === 'simple-webgl') {
        game.marbleLodMeshes = null;
        return null;
    }

    const meshes = LOD_SPECS.map((spec, level) => {
        const built = createFilamentSphereMesh(game, radius, spec.widthSegments, spec.heightSegments);
        if (!built) return null;
        return {
            level,
            ...built,
            castShadows: spec.castShadows,
            widthSegments: spec.widthSegments,
            heightSegments: spec.heightSegments,
        };
    });

    if (!allPresent(meshes)) {
        game.marbleLodMeshes = null;
        return null;
    }

    game.marbleLodMeshes = meshes;
    // LOD_SPECS has three entries, so meshes[1] always exists here.
    const lod1 = meshes[1];
    if (lod1) {
        game.sphereVb = lod1.vb;
        game.sphereIb = lod1.ib;
    }
    return meshes;
}

/**
 * @param {number} worldRadius
 * @param {number} distance
 * @param {number} viewportHeight px
 * @param {number} fovDeg vertical FOV
 * @returns {number} Projected radius in px (0 for degenerate input).
 */
export function projectScreenRadiusPx(worldRadius, distance, viewportHeight, fovDeg) {
    if (!distance || distance <= 0.001 || !viewportHeight || !fovDeg) return 0;
    const halfFovRad = (fovDeg * 0.5) * (Math.PI / 180);
    const projected = (worldRadius / distance) * (viewportHeight * 0.5) / Math.tan(halfFovRad);
    return projected;
}

/**
 * @param {number | null | undefined} currentLod
 * @param {number} distance
 * @param {number} [hysteresis]
 * @returns {number} 0, 1 or 2.
 */
export function resolveLodWithHysteresis(currentLod, distance, hysteresis = LOD_HYSTERESIS_M) {
    let lod = Math.max(0, Math.min(currentLod ?? 1, 2));

    while (lod < 2) {
        const nextThreshold = (lod === 0 ? LOD_DISTANCE.lod1 : LOD_DISTANCE.lod2) + hysteresis;
        if (distance >= nextThreshold) {
            lod += 1;
        } else {
            break;
        }
    }

    while (lod > 0) {
        const currentThreshold = (lod === 1 ? LOD_DISTANCE.lod1 : LOD_DISTANCE.lod2) - hysteresis;
        if (distance < currentThreshold) {
            lod -= 1;
        } else {
            break;
        }
    }

    return lod;
}

/**
 * @typedef {object} LodSelectionInput
 * @property {number} [currentLod]
 * @property {number} distance
 * @property {number} [screenRadiusPx]
 * @property {boolean} [isPlayer]
 * @property {boolean} [allowLod0]
 * @property {string | null} [quality]
 * @property {number | null} [forceMaxLod]
 */

/**
 * Pure LOD tier selection — quality caps, player priority, screen-size boost.
 *
 * @param {LodSelectionInput} input
 * @returns {number} 0, 1 or 2.
 */
export function selectMarbleLodLevel({
    currentLod = 1,
    distance,
    screenRadiusPx = 0,
    isPlayer = false,
    allowLod0 = true,
    quality = 'medium',
    forceMaxLod = null,
}) {
    if (forceMaxLod !== null && forceMaxLod !== undefined) {
        return Math.max(0, Math.min(forceMaxLod, 2));
    }

    let lod;
    if (isPlayer) {
        lod = 0;
    } else {
        lod = resolveLodWithHysteresis(currentLod, distance);
        if (allowLod0 && screenRadiusPx >= LOD0_MIN_SCREEN_PX && lod === 1 && distance < LOD_DISTANCE.lod1) {
            lod = 0;
        }
    }

    if (!allowLod0 && lod === 0) {
        lod = 1;
    }

    const q = (quality || 'medium').toLowerCase();
    if (q === 'low') {
        lod = Math.max(lod, 1);
    }

    return lod;
}

export class MarbleLodManager {
    /** @param {MarbleLodHost} game */
    constructor(game) {
        this.game = game;
        /** @type {LodStats} */
        this.stats = { lod0: 0, lod1: 0, lod2: 0 };
        /** @type {number | null} Cap set by the quality governor (null = none). */
        this.forceMaxLod = null;
        /** @type {Set<MarbleObject>} Non-player marbles allowed LOD0 on 'medium'. */
        this._nearestLod0Keys = new Set();
        window.lodStats = this.stats;
    }

    /** @returns {void} */
    reset() {
        this.stats = { lod0: 0, lod1: 0, lod2: 0 };
        this._nearestLod0Keys = new Set();
        window.lodStats = this.stats;
    }

    /**
     * @param {number | null | undefined} level
     * @returns {void}
     */
    setForceMaxLod(level) {
        this.forceMaxLod = level === null || level === undefined ? null : Math.max(0, Math.min(level, 2));
    }

    /** @returns {Vec3} Camera eye, else the player, else the origin. */
    getReferencePosition() {
        const camera = this.game._cameraState?.eye;
        if (camera) return { x: camera[0], y: camera[1], z: camera[2] };
        const player = this.game.playerMarble?.rigidBody?.translation?.();
        if (player) return player;
        return { x: 0, y: 0, z: 0 };
    }

    /**
     * @param {readonly MarbleObject[] | null | undefined} marbles
     * @param {Vec3 | null | undefined} playerPos
     * @param {number} [limit]
     * @returns {Set<MarbleObject>}
     */
    computeNearestLod0Candidates(marbles, playerPos, limit = 3) {
        if (!playerPos || !marbles?.length) return new Set();

        const ranked = marbles
            .filter(m => m !== this.game.playerMarble && m.geometry !== 'cube')
            .map(m => {
                const t = m.rigidBody.translation();
                const dx = t.x - playerPos.x;
                const dy = t.y - playerPos.y;
                const dz = t.z - playerPos.z;
                return { marble: m, distSq: dx * dx + dy * dy + dz * dz };
            })
            .sort((a, b) => a.distSq - b.distSq)
            .slice(0, limit);

        return new Set(ranked.map(entry => entry.marble));
    }

    /**
     * @param {MarbleObject} marble
     * @param {number} cameraDist
     * @param {boolean} culledHidden
     * @returns {boolean}
     */
    canUseLod0(marble, cameraDist, culledHidden) {
        if (marble.geometry === 'cube') return false;
        if (culledHidden) return false;
        if (cameraDist > LOD0_MAX_CAMERA_DIST) return false;
        return true;
    }

    /**
     * @param {MarbleObject} marble
     * @param {number} lodLevel
     * @returns {boolean} true when the renderable's geometry was swapped.
     */
    swapMarbleGeometry(marble, lodLevel) {
        const game = this.game;
        if (game.rendererType === 'simple-webgl' || marble.geometry === 'cube') return false;
        const lodMeshes = game.marbleLodMeshes;
        const mesh = lodMeshes?.[lodLevel];
        if (!lodMeshes || !mesh) return false;
        if (marble.lodLevel === lodLevel) return false;

        const rcm = game.engine.getRenderableManager();
        const inst = marble._renderInst ?? rcm.getInstance(marble.entity);
        if (!inst) return false;

        const primitiveType = game.Filament['RenderableManager$PrimitiveType'].TRIANGLES;
        if (typeof rcm.setGeometryAt === 'function') {
            rcm.setGeometryAt(inst, 0, primitiveType, mesh.vb, mesh.ib, 0, mesh.indexCount);
        } else {
            return false;
        }

        if (typeof rcm.setCastShadows === 'function') {
            rcm.setCastShadows(inst, mesh.castShadows !== false);
        }
        if (typeof rcm.setReceiveShadows === 'function') {
            rcm.setReceiveShadows(inst, true);
        }

        marble.lodLevel = lodLevel;
        marble._renderInst = inst;
        marble._renderEntity = marble.entity;
        marble.lodMeshes = lodMeshes;
        marble._lastLodSwitchAt = performance.now();
        applyMarbleMaterialPreset(marble, game);
        return true;
    }

    /**
     * @param {number} [now]
     * @returns {void}
     */
    updateMarbles(now = performance.now()) {
        const game = this.game;
        if (!game.marbles?.length || !game.marbleLodMeshes || game.rendererType === 'simple-webgl') {
            this.reset();
            return;
        }

        const ref = this.getReferencePosition();
        const quality = game.settings?.graphics?.quality || 'medium';
        const viewportHeight = game.canvas?.height || window.innerHeight || 720;
        const fovDeg = game.activeFov || game.currentFov || 45;
        const playerPos = game.playerMarble?.rigidBody?.translation?.() || ref;

        if (quality === 'medium') {
            this._nearestLod0Keys = this.computeNearestLod0Candidates(game.marbles, playerPos, 3);
        } else {
            this._nearestLod0Keys = new Set();
        }

        const stats = { lod0: 0, lod1: 0, lod2: 0 };

        for (const marble of game.marbles) {
            if (marble.geometry === 'cube') {
                stats.lod1 += 1;
                continue;
            }

            const t = marble.rigidBody.translation();
            const dx = t.x - ref.x;
            const dy = t.y - ref.y;
            const dz = t.z - ref.z;
            const distance = Math.hypot(dx, dy, dz);
            const worldRadius = (marble.scale || 1) * 0.5;
            const screenRadiusPx = projectScreenRadiusPx(worldRadius, distance, viewportHeight, fovDeg);

            const isPlayer = marble === game.playerMarble;
            const allowLod0 = isPlayer
                || (this.canUseLod0(marble, distance, false)
                    && (quality !== 'medium' || this._nearestLod0Keys.has(marble)));

            const desiredLod = selectMarbleLodLevel({
                currentLod: marble.lodLevel ?? 1,
                distance,
                screenRadiusPx,
                isPlayer,
                allowLod0,
                quality,
                forceMaxLod: this.forceMaxLod,
            });

            if (desiredLod === 0) stats.lod0 += 1;
            else if (desiredLod === 1) stats.lod1 += 1;
            else stats.lod2 += 1;

            const canSwitch = !marble._lastLodSwitchAt || (now - marble._lastLodSwitchAt) >= LOD_SWITCH_THROTTLE_MS;
            if (canSwitch && desiredLod !== marble.lodLevel) {
                this.swapMarbleGeometry(marble, desiredLod);
            }
        }

        this.stats = stats;
        window.lodStats = stats;
    }
}

export default MarbleLodManager;
