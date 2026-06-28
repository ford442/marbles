import { createSphere } from './sphere.js';
import { applyMarbleMaterialPreset } from './marble-material-tier.js';

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

const LOD_SPECS = [
    { widthSegments: 48, heightSegments: 24, castShadows: true },
    { widthSegments: 16, heightSegments: 8, castShadows: true },
    { widthSegments: 8, heightSegments: 4, castShadows: false },
];

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

    if (meshes.some(mesh => !mesh)) {
        game.marbleLodMeshes = null;
        return null;
    }

    game.marbleLodMeshes = meshes;
    game.sphereVb = meshes[1].vb;
    game.sphereIb = meshes[1].ib;
    return meshes;
}

export function projectScreenRadiusPx(worldRadius, distance, viewportHeight, fovDeg) {
    if (!distance || distance <= 0.001 || !viewportHeight || !fovDeg) return 0;
    const halfFovRad = (fovDeg * 0.5) * (Math.PI / 180);
    const projected = (worldRadius / distance) * (viewportHeight * 0.5) / Math.tan(halfFovRad);
    return projected;
}

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
 * Pure LOD tier selection — quality caps, player priority, screen-size boost.
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
    constructor(game) {
        this.game = game;
        this.stats = { lod0: 0, lod1: 0, lod2: 0 };
        this.forceMaxLod = null;
        this._nearestLod0Keys = new Set();
        window.lodStats = this.stats;
    }

    reset() {
        this.stats = { lod0: 0, lod1: 0, lod2: 0 };
        this._nearestLod0Keys = new Set();
        window.lodStats = this.stats;
    }

    setForceMaxLod(level) {
        this.forceMaxLod = level === null || level === undefined ? null : Math.max(0, Math.min(level, 2));
    }

    getReferencePosition() {
        const camera = this.game._cameraState?.eye;
        if (camera) return { x: camera[0], y: camera[1], z: camera[2] };
        const player = this.game.playerMarble?.rigidBody?.translation?.();
        if (player) return player;
        return { x: 0, y: 0, z: 0 };
    }

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

    canUseLod0(marble, cameraDist, culledHidden) {
        if (marble.geometry === 'cube') return false;
        if (culledHidden) return false;
        if (cameraDist > LOD0_MAX_CAMERA_DIST) return false;
        return true;
    }

    swapMarbleGeometry(marble, lodLevel) {
        const game = this.game;
        if (game.rendererType === 'simple-webgl' || marble.geometry === 'cube') return false;
        if (!game.marbleLodMeshes?.[lodLevel]) return false;
        if (marble.lodLevel === lodLevel) return false;

        const mesh = game.marbleLodMeshes[lodLevel];
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
        marble.lodMeshes = game.marbleLodMeshes;
        marble._lastLodSwitchAt = performance.now();
        applyMarbleMaterialPreset(marble, game);
        return true;
    }

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

            stats[`lod${desiredLod}`] += 1;

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
