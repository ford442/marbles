import {
    cloneMap,
    recountCollectiblesTotal,
    syncCheckpointsFromZones,
    syncGoalsFromZones,
} from './map-document.ts';
import type { EditorMap } from './map-document.ts';
import { isPrimitiveZone } from '../levels/map-normalize.js';
import type {
    KnownKeys, MapVec3, MapVec3Input, NormalizedStampZone, NormalizedZoneDefinition,
} from '../types/map.ts';

/** An undoable edit (MapDocument keeps the undo / redo stacks). */
export interface MapCommand {
    label: string;
    apply(): void;
    revert(): void;
}

export type Vec3Delta = { x?: number; y?: number; z?: number };

/** Inspector edits merged into a zone (`Object.assign`), stamp-zone fields. */
export type ZonePropsPatch = Partial<NormalizedStampZone>;

/** Map header edits; `undefined` values are skipped by updateMapMeta. */
export type MapMetaPatch = {
    [K in keyof KnownKeys<EditorMap>]?: EditorMap[K] | undefined;
};

/**
 * The placement vectors any zone may carry: `pos`, a ramp's `from` / `to`,
 * a mover's `path`; each `[x, y, z]` or {x, y, z}.
 */
type ZoneVectors = { pos?: MapVec3Input; from?: MapVec3Input; to?: MapVec3Input; path?: MapVec3Input[] };

export function placeZone(map: EditorMap, zone: NormalizedZoneDefinition): number {
    // v2 primitives need a v2 map (map-rules.js semanticChecks).
    if (isPrimitiveZone(zone)) map.schemaVersion = 2;
    map.zones.push(zone);
    const index = map.zones.length - 1;
    if (zone.type === 'goal') syncGoalsFromZones(map);
    if (zone.type === 'checkpoint') syncCheckpointsFromZones(map);
    recountCollectiblesTotal(map);
    return index;
}

export function deleteZonesAt(map: EditorMap, indices: number[]): void {
    const sorted = [...indices].sort((a, b) => b - a);
    for (const i of sorted) {
        if (i >= 0 && i < map.zones.length) map.zones.splice(i, 1);
    }
    syncGoalsFromZones(map);
    syncCheckpointsFromZones(map);
    recountCollectiblesTotal(map);
}

export function moveZonesAt(map: EditorMap, indices: number[], delta: Vec3Delta): void {
    for (const i of indices) {
        const zone: ZoneVectors | undefined = map.zones[i];
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

export function rotateZonesAt(map: EditorMap, indices: number[], deltaRad: number): void {
    for (const i of indices) {
        const zone = map.zones[i];
        if (!zone) continue;
        if (isPrimitiveZone(zone)) {
            if (zone.type === 'ramp') {
                // A ramp's orientation is its from → to line: swing `to` about `from`.
                rotateAboutY(zone.to, zone.from, deltaRad);
            } else {
                const yawDeg = ((zone.rot?.yawDeg || 0) + (deltaRad * 180) / Math.PI) % 360;
                zone.rot = { ...zone.rot, yawDeg: Math.round(yawDeg * 1000) / 1000 };
            }
        } else {
            zone.rotY = ((zone.rotY || 0) + deltaRad) % (Math.PI * 2);
        }
    }
}

/**
 * Where a zone sits for picking / the inspector: `pos`, a ramp's `from`, or a
 * mover's first path point, as {x, y, z}.
 */
export function zoneAnchor(zone: ZoneVectors | null | undefined): MapVec3 {
    const v = zone?.pos ?? zone?.from ?? zone?.path?.[0];
    if (Array.isArray(v)) return { x: v[0], y: v[1], z: v[2] };
    return v ? { x: v.x, y: v.y, z: v.z } : { x: 0, y: 0, z: 0 };
}

function translateVec3(v: MapVec3Input, d: Vec3Delta): void {
    if (Array.isArray(v)) {
        v[0] += d.x || 0;
        v[1] += d.y || 0;
        v[2] += d.z || 0;
    } else {
        v.x += d.x || 0;
        v.y += d.y || 0;
        v.z += d.z || 0;
    }
}

/** Rotate point `v` about the vertical axis through `c` (yaw: +Z toward +X). */
function rotateAboutY(v: MapVec3Input, c: MapVec3Input, rad: number): void {
    const cx = Array.isArray(c) ? c[0] : c.x;
    const cz = Array.isArray(c) ? c[2] : c.z;
    const vx = Array.isArray(v) ? v[0] : v.x;
    const vz = Array.isArray(v) ? v[2] : v.z;
    const dx = vx - cx;
    const dz = vz - cz;
    const nx = cx + dx * Math.cos(rad) + dz * Math.sin(rad);
    const nz = cz - dx * Math.sin(rad) + dz * Math.cos(rad);
    if (Array.isArray(v)) {
        v[0] = nx;
        v[2] = nz;
    } else {
        v.x = nx;
        v.z = nz;
    }
}

export function setSpawn(map: EditorMap, spawn: MapVec3): void {
    map.spawn = { ...spawn };
}

export function updateZoneProps(map: EditorMap, index: number, props: ZonePropsPatch): void {
    const zone = map.zones[index];
    if (!zone) return;
    Object.assign(zone, props);
    if (zone.type === 'goal') syncGoalsFromZones(map);
    if (zone.type === 'checkpoint') syncCheckpointsFromZones(map);
    if (zone.type === 'collectible' || props.collectible) recountCollectiblesTotal(map);
}

export function updateMapMeta(map: EditorMap, meta: MapMetaPatch): void {
    const target: Record<string, unknown> = map;
    for (const [key, value] of Object.entries(meta)) {
        if (value !== undefined) target[key] = value;
    }
}

export function cmdPlaceZone(map: EditorMap, zone: NormalizedZoneDefinition): MapCommand {
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

export function cmdDeleteZones(map: EditorMap, indices: number[]): MapCommand {
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

export function cmdMoveZones(map: EditorMap, indices: number[], delta: Vec3Delta): MapCommand {
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

export function cmdRotateZones(map: EditorMap, indices: number[], deltaRad: number): MapCommand {
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

export function cmdSetSpawn(map: EditorMap, spawn: MapVec3): MapCommand {
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

export function cmdUpdateZoneProps(map: EditorMap, index: number, props: ZonePropsPatch): MapCommand {
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

export function cmdUpdateMapMeta(map: EditorMap, meta: MapMetaPatch): MapCommand {
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

export function cmdReplaceMap(map: EditorMap, nextMap: EditorMap): MapCommand {
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
