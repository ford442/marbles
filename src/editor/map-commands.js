/** @typedef {import('./map-commands.js').MapCommand} MapCommand */

import {
    cloneMap,
    recountCollectiblesTotal,
    syncCheckpointsFromZones,
    syncGoalsFromZones,
} from './map-document.js';
import { PRIMITIVE_ZONE_TYPES } from '../levels/map-normalize.js';

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {import('../types/map.ts').MapZoneDefinition} zone
 * @returns {number}
 */
export function placeZone(map, zone) {
    // v2 primitives need a v2 map (map-rules.js semanticChecks).
    if (PRIMITIVE_ZONE_TYPES.has(zone.type)) map.schemaVersion = 2;
    map.zones.push(zone);
    const index = map.zones.length - 1;
    if (zone.type === 'goal') syncGoalsFromZones(map);
    if (zone.type === 'checkpoint') syncCheckpointsFromZones(map);
    recountCollectiblesTotal(map);
    return index;
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {number[]} indices
 */
export function deleteZonesAt(map, indices) {
    const sorted = [...indices].sort((a, b) => b - a);
    for (const i of sorted) {
        if (i >= 0 && i < map.zones.length) map.zones.splice(i, 1);
    }
    syncGoalsFromZones(map);
    syncCheckpointsFromZones(map);
    recountCollectiblesTotal(map);
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {number[]} indices
 * @param {{ x?: number, y?: number, z?: number }} delta
 */
export function moveZonesAt(map, indices, delta) {
    for (const i of indices) {
        const zone = /** @type {any} */ (map.zones[i]);
        if (!zone) continue;
        // v2 primitives place by pos, from/to (ramp) or path (mover); vec3s
        // may be [x, y, z] arrays or {x, y, z} objects.
        for (const v of [zone.pos, zone.from, zone.to, ...(zone.path || [])]) {
            if (v) translateVec3(v, delta);
        }
    }
    const movedGoal = indices.some((i) => map.zones[i]?.type === 'goal');
    const movedCheckpoint = indices.some((i) => map.zones[i]?.type === 'checkpoint');
    if (movedGoal) syncGoalsFromZones(map);
    if (movedCheckpoint) syncCheckpointsFromZones(map);
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {number[]} indices
 * @param {number} deltaRad
 */
export function rotateZonesAt(map, indices, deltaRad) {
    for (const i of indices) {
        const zone = /** @type {any} */ (map.zones[i]);
        if (!zone) continue;
        if (zone.type === 'ramp') {
            // A ramp's orientation is its from → to line: swing `to` about `from`.
            rotateAboutY(zone.to, zone.from, deltaRad);
        } else if (PRIMITIVE_ZONE_TYPES.has(zone.type)) {
            const yawDeg = ((zone.rot?.yawDeg || 0) + (deltaRad * 180) / Math.PI) % 360;
            zone.rot = { ...zone.rot, yawDeg: Math.round(yawDeg * 1000) / 1000 };
        } else {
            zone.rotY = ((zone.rotY || 0) + deltaRad) % (Math.PI * 2);
        }
    }
}

/**
 * Where a zone sits for picking / the inspector: `pos`, a ramp's `from`, or a
 * mover's first path point, as {x, y, z}.
 * @param {any} zone
 * @returns {{ x: number, y: number, z: number }}
 */
export function zoneAnchor(zone) {
    const v = zone?.pos ?? zone?.from ?? zone?.path?.[0];
    if (Array.isArray(v)) return { x: v[0], y: v[1], z: v[2] };
    return v ? { x: v.x, y: v.y, z: v.z } : { x: 0, y: 0, z: 0 };
}

/** @param {any} v @param {{ x?: number, y?: number, z?: number }} d */
function translateVec3(v, d) {
    const keys = Array.isArray(v) ? [0, 1, 2] : ['x', 'y', 'z'];
    v[keys[0]] += d.x || 0;
    v[keys[1]] += d.y || 0;
    v[keys[2]] += d.z || 0;
}

/** Rotate point `v` about the vertical axis through `c` (yaw: +Z toward +X). @param {any} v @param {any} c @param {number} rad */
function rotateAboutY(v, c, rad) {
    const [xk, zk] = Array.isArray(v) ? [0, 2] : ['x', 'z'];
    const cx = Array.isArray(c) ? c[0] : c.x;
    const cz = Array.isArray(c) ? c[2] : c.z;
    const dx = v[xk] - cx;
    const dz = v[zk] - cz;
    v[xk] = cx + dx * Math.cos(rad) + dz * Math.sin(rad);
    v[zk] = cz - dx * Math.sin(rad) + dz * Math.cos(rad);
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {{ x: number, y: number, z: number }} spawn
 */
export function setSpawn(map, spawn) {
    map.spawn = { ...spawn };
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {number} index
 * @param {Partial<import('../types/map.ts').MapZoneDefinition>} props
 */
export function updateZoneProps(map, index, props) {
    const zone = map.zones[index];
    if (!zone) return;
    Object.assign(zone, props);
    if (zone.type === 'goal') syncGoalsFromZones(map);
    if (zone.type === 'checkpoint') syncCheckpointsFromZones(map);
    if (zone.type === 'collectible' || props.collectible) recountCollectiblesTotal(map);
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {Partial<import('../types/map.ts').MapDefinition>} meta
 */
export function updateMapMeta(map, meta) {
    for (const [key, value] of Object.entries(meta)) {
        if (value !== undefined) map[key] = value;
    }
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {import('../types/map.ts').MapZoneDefinition} zone
 * @returns {MapCommand}
 */
export function cmdPlaceZone(map, zone) {
    const before = cloneMap(map);
    const zoneCopy = structuredClone(zone);
    return {
        label: 'Place zone',
        apply() {
            placeZone(map, structuredClone(zoneCopy));
        },
        revert() {
            Object.assign(map, cloneMap(before));
        },
    };
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {number[]} indices
 * @returns {MapCommand}
 */
export function cmdDeleteZones(map, indices) {
    const before = cloneMap(map);
    const sorted = [...indices].sort((a, b) => a - b);
    return {
        label: 'Delete zones',
        apply() {
            deleteZonesAt(map, sorted);
        },
        revert() {
            Object.assign(map, cloneMap(before));
        },
    };
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {number[]} indices
 * @param {{ x?: number, y?: number, z?: number }} delta
 * @returns {MapCommand}
 */
export function cmdMoveZones(map, indices, delta) {
    const before = cloneMap(map);
    return {
        label: 'Move zones',
        apply() {
            moveZonesAt(map, indices, delta);
        },
        revert() {
            Object.assign(map, cloneMap(before));
        },
    };
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {number[]} indices
 * @param {number} deltaRad
 * @returns {MapCommand}
 */
export function cmdRotateZones(map, indices, deltaRad) {
    const before = cloneMap(map);
    return {
        label: 'Rotate zones',
        apply() {
            rotateZonesAt(map, indices, deltaRad);
        },
        revert() {
            Object.assign(map, cloneMap(before));
        },
    };
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {{ x: number, y: number, z: number }} spawn
 * @returns {MapCommand}
 */
export function cmdSetSpawn(map, spawn) {
    const before = cloneMap(map);
    const spawnCopy = { ...spawn };
    return {
        label: 'Set spawn',
        apply() {
            setSpawn(map, spawnCopy);
        },
        revert() {
            Object.assign(map, cloneMap(before));
        },
    };
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {number} index
 * @param {Partial<import('../types/map.ts').MapZoneDefinition>} props
 * @returns {MapCommand}
 */
export function cmdUpdateZoneProps(map, index, props) {
    const before = cloneMap(map);
    const propsCopy = structuredClone(props);
    return {
        label: 'Update zone',
        apply() {
            updateZoneProps(map, index, structuredClone(propsCopy));
        },
        revert() {
            Object.assign(map, cloneMap(before));
        },
    };
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {Partial<import('../types/map.ts').MapDefinition>} meta
 * @returns {MapCommand}
 */
export function cmdUpdateMapMeta(map, meta) {
    const before = cloneMap(map);
    const metaCopy = structuredClone(meta);
    return {
        label: 'Update map',
        apply() {
            updateMapMeta(map, structuredClone(metaCopy));
        },
        revert() {
            Object.assign(map, cloneMap(before));
        },
    };
}

/**
 * @param {import('../types/map.ts').MapDefinition} map
 * @param {import('../types/map.ts').MapDefinition} nextMap
 * @returns {MapCommand}
 */
export function cmdReplaceMap(map, nextMap) {
    const before = cloneMap(map);
    const after = cloneMap(nextMap);
    syncGoalsFromZones(after);
    syncCheckpointsFromZones(after);
    recountCollectiblesTotal(after);
    return {
        label: 'Replace map',
        apply() {
            Object.assign(map, cloneMap(after));
        },
        revert() {
            Object.assign(map, cloneMap(before));
        },
    };
}
