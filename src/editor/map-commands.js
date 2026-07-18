/** @typedef {import('./map-commands.js').MapCommand} MapCommand */

import {
    cloneMap,
    recountCollectiblesTotal,
    syncCheckpointsFromZones,
    syncGoalsFromZones,
} from './map-document.js';

/**
 * @param {import('../types/map.js').MapDefinition} map
 * @param {import('../types/map.js').MapZoneDefinition} zone
 * @returns {number}
 */
export function placeZone(map, zone) {
    map.zones.push(zone);
    const index = map.zones.length - 1;
    if (zone.type === 'goal') syncGoalsFromZones(map);
    if (zone.type === 'checkpoint') syncCheckpointsFromZones(map);
    recountCollectiblesTotal(map);
    return index;
}

/**
 * @param {import('../types/map.js').MapDefinition} map
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
 * @param {import('../types/map.js').MapDefinition} map
 * @param {number[]} indices
 * @param {{ x?: number, y?: number, z?: number }} delta
 */
export function moveZonesAt(map, indices, delta) {
    for (const i of indices) {
        const zone = map.zones[i];
        if (!zone) continue;
        if (delta.x) zone.pos.x += delta.x;
        if (delta.y) zone.pos.y += delta.y;
        if (delta.z) zone.pos.z += delta.z;
    }
    const movedGoal = indices.some((i) => map.zones[i]?.type === 'goal');
    const movedCheckpoint = indices.some((i) => map.zones[i]?.type === 'checkpoint');
    if (movedGoal) syncGoalsFromZones(map);
    if (movedCheckpoint) syncCheckpointsFromZones(map);
}

/**
 * @param {import('../types/map.js').MapDefinition} map
 * @param {number[]} indices
 * @param {number} deltaRad
 */
export function rotateZonesAt(map, indices, deltaRad) {
    for (const i of indices) {
        const zone = map.zones[i];
        if (!zone) continue;
        zone.rotY = ((zone.rotY || 0) + deltaRad) % (Math.PI * 2);
    }
}

/**
 * @param {import('../types/map.js').MapDefinition} map
 * @param {{ x: number, y: number, z: number }} spawn
 */
export function setSpawn(map, spawn) {
    map.spawn = { ...spawn };
}

/**
 * @param {import('../types/map.js').MapDefinition} map
 * @param {number} index
 * @param {Partial<import('../types/map.js').MapZoneDefinition>} props
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
 * @param {import('../types/map.js').MapDefinition} map
 * @param {Partial<import('../types/map.js').MapDefinition>} meta
 */
export function updateMapMeta(map, meta) {
    for (const [key, value] of Object.entries(meta)) {
        if (value !== undefined) map[key] = value;
    }
}

/**
 * @param {import('../types/map.js').MapDefinition} map
 * @param {import('../types/map.js').MapZoneDefinition} zone
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
 * @param {import('../types/map.js').MapDefinition} map
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
 * @param {import('../types/map.js').MapDefinition} map
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
 * @param {import('../types/map.js').MapDefinition} map
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
 * @param {import('../types/map.js').MapDefinition} map
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
 * @param {import('../types/map.js').MapDefinition} map
 * @param {number} index
 * @param {Partial<import('../types/map.js').MapZoneDefinition>} props
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
 * @param {import('../types/map.js').MapDefinition} map
 * @param {Partial<import('../types/map.js').MapDefinition>} meta
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
 * @param {import('../types/map.js').MapDefinition} map
 * @param {import('../types/map.js').MapDefinition} nextMap
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
