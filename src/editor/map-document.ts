import {
    isPrimitiveZone, mapToRuntimeLevel, normalizeStampZone, toVec3Object,
} from '../levels/map-normalize.js';
import type {
    EditableMapDefinition,
    MapDefinition,
    NormalizedStampZone,
    NormalizedZoneDefinition,
    Range2,
    RuntimeLevel,
} from '../types/map.ts';
import type { MapCommand } from './map-commands.ts';

/**
 * The editor's working map: an authored map with object-form spawn / stamp
 * vectors (`parseMapJson` lowers `[x, y, z]`). Every export and validation
 * path takes it, and it is a valid `MapDefinition`.
 */
export type EditorMap = EditableMapDefinition;

export const PLAYTEST_LEVEL_ID = '__editor_playtest__';
export const DRAFT_STORAGE_KEY = 'marbles3d_map_editor_draft';
export const UNDO_STACK_LIMIT = 100;

export function createEmptyMap(): EditorMap {
    return {
        id: 'my_map',
        name: 'Untitled Map',
        description: 'Created in the Map Editor',
        version: '1.0.0',
        author: 'Designer',
        difficulty: 'easy',
        zones: [
            {
                type: 'floor',
                pos: { x: 0, y: -2, z: 0 },
                size: { x: 40, y: 0.5, z: 40 },
                color: [0.25, 0.25, 0.28],
            },
        ],
        spawn: { x: 0, y: 5, z: -10 },
        goals: [
            {
                id: 1,
                range: {
                    x: [-2, 2],
                    y: [0, 2],
                    z: [8, 12],
                },
            },
        ],
        camera: { mode: 'orbit', angle: 0, height: 10, radius: 25 },
        abilities: { enabled: ['jump'] },
    };
}

/**
 * Deep-clone a map definition for undo snapshots.
 */
export function cloneMap(map: EditorMap): EditorMap {
    return structuredClone(map);
}

/**
 * Build runtime level object from a map definition (same conversion as
 * AssetRegistry.convertMapToLevel).
 */
export function mapDefToLevel(mapDef: MapDefinition): RuntimeLevel {
    return mapToRuntimeLevel(mapDef, 'editor');
}

/** Stamp zones of one type (`goal`, `checkpoint`, ...; never a v2 primitive). */
function stampZonesOfType(map: EditorMap, type: string): NormalizedStampZone[] {
    return map.zones.filter((z): z is NormalizedStampZone => z.type === type && !isPrimitiveZone(z));
}

/**
 * Derive goal volumes from placed goal zones (4-unit cube around each goal center).
 */
export function syncGoalsFromZones(map: EditorMap): void {
    // A v2 `goal` volume is authored explicitly; goal stamps are then visual only.
    if (map.goal) return;
    const goalZones = stampZonesOfType(map, 'goal');
    if (goalZones.length === 0) {
        if (!map.goals?.length) {
            map.goals = [{
                id: 1,
                range: { x: [-2, 2], y: [0, 2], z: [-2, 2] },
            }];
        }
        return;
    }

    map.goals = goalZones.map((z, i) => ({
        id: i + 1,
        range: {
            x: [z.pos.x - 2, z.pos.x + 2],
            y: [z.pos.y - 0.25, z.pos.y + 2],
            z: [z.pos.z - 2, z.pos.z + 2],
        },
    }));
}

/**
 * Derive checkpoint definitions from placed checkpoint zones.
 */
export function syncCheckpointsFromZones(map: EditorMap): void {
    const cpZones = stampZonesOfType(map, 'checkpoint');
    if (cpZones.length === 0) {
        map.checkpoints = map.checkpoints || [];
        return;
    }

    map.checkpoints = cpZones.map((z, i) => {
        const sz = z.size || { x: 6, y: 0.2, z: 2 };
        const id = z.checkpoint ?? i + 1;
        return {
            id,
            pos: { ...z.pos },
            range: {
                x: [z.pos.x - sz.x / 2, z.pos.x + sz.x / 2],
                y: [z.pos.y - sz.y / 2, z.pos.y + sz.y / 2],
                z: [z.pos.z - sz.z / 2, z.pos.z + sz.z / 2],
            },
        };
    });
}

/**
 * Set collectiblesTotal from collectible zones.
 */
export function recountCollectiblesTotal(map: EditorMap): void {
    const count = map.zones.filter(
        (z) => z.type === 'collectible' || ('collectible' in z && z.collectible)
    ).length;
    map.collectiblesTotal = count;
}

/**
 * Serialize a single zone for export.
 */
export function serializeZone(z: NormalizedZoneDefinition): NormalizedZoneDefinition {
    // v2 primitives are closed schemas (additionalProperties: false) holding
    // only plain data: export them as authored.
    if (isPrimitiveZone(z)) return structuredClone(z);
    const zone: NormalizedStampZone = { type: z.type, pos: { ...z.pos } };
    if (z.size) zone.size = { ...z.size };
    if (z.color) zone.color = [...z.color];
    if (z.rotY !== undefined) zone.rotY = z.rotY;
    if (z.model) zone.model = z.model;
    if (z.collider) zone.collider = z.collider;
    if (z.scale !== undefined) zone.scale = z.scale;
    if (z.materialPreset) zone.materialPreset = z.materialPreset;
    if (z.lod) zone.lod = z.lod.map((l) => ({ model: l.model, distance: l.distance }));
    if (z.friction !== undefined) zone.friction = z.friction;
    if (z.restitution !== undefined) zone.restitution = z.restitution;
    if (z.slope !== undefined) zone.slope = z.slope;
    if (z.boostForce !== undefined) zone.boostForce = z.boostForce;
    if (z.kinematic) zone.kinematic = { ...z.kinematic };
    if (z.collectible) zone.collectible = { ...z.collectible };
    if (z.grappleAnchor) zone.grappleAnchor = { ...z.grappleAnchor };
    if (z.checkpoint !== undefined) zone.checkpoint = z.checkpoint;
    return zone;
}

/** Copy of a [min, max] range (structuredClone keeps the tuple type). */
const copyRange = (r: Range2): Range2 => structuredClone(r);

/**
 * Strip editor-only fields and produce downloadable JSON.
 */
export function serializeMap(map: EditorMap): EditorMap {
    // Optional header fields are omitted when absent (JSON.stringify and ajv
    // already treated an `undefined` value as absent).
    const out: EditorMap = {
        id: map.id,
        name: map.name,
        ...(map.description !== undefined ? { description: map.description } : {}),
        version: map.version,
        ...(map.author !== undefined ? { author: map.author } : {}),
        ...(map.difficulty !== undefined ? { difficulty: map.difficulty } : {}),
        zones: map.zones.map(serializeZone),
        spawn: { ...map.spawn },
        // v2 maps may use a single `goal` volume instead (never both).
        ...(map.goal ? {} : { goals: (map.goals || []).map((g) => ({
            id: g.id,
            range: {
                x: copyRange(g.range.x),
                y: copyRange(g.range.y),
                z: copyRange(g.range.z),
            },
        })) }),
        camera: { ...map.camera },
    };
    if (map.abilities) out.abilities = structuredClone(map.abilities);
    if (map.medals) out.medals = { ...map.medals };
    if (map.collectiblesTotal !== undefined) out.collectiblesTotal = map.collectiblesTotal;
    if (map.checkpoints?.length) {
        out.checkpoints = map.checkpoints.map((cp) => ({
            ...(cp.id !== undefined ? { id: cp.id } : {}),
            ...(cp.pos ? { pos: { ...cp.pos } } : {}),
            ...(cp.range ? {
                // Each axis is optional in the schema; copy the ones present.
                range: {
                    ...(cp.range.x ? { x: copyRange(cp.range.x) } : {}),
                    ...(cp.range.y ? { y: copyRange(cp.range.y) } : {}),
                    ...(cp.range.z ? { z: copyRange(cp.range.z) } : {}),
                },
            } : {}),
        }));
    }
    if (map.schemaVersion !== undefined) out.schemaVersion = map.schemaVersion;
    if (map.goal) out.goal = structuredClone(map.goal);
    if (map.rivals?.length) out.rivals = [...map.rivals];
    if (map.bounds) out.bounds = structuredClone(map.bounds);
    if (map.solution) out.solution = structuredClone(map.solution);
    if (map.goalless) out.goalless = true;
    if (map.chapter) out.chapter = map.chapter;
    if (map.nightMode !== undefined) out.nightMode = map.nightMode;
    if (map.backgroundColor) out.backgroundColor = [...map.backgroundColor];
    if (map.environment) out.environment = map.environment;
    if (map.colorGrade) out.colorGrade = map.colorGrade;
    if (map.behaviors?.length) out.behaviors = [...map.behaviors];
    if (map.music) out.music = map.music;
    if (map.ambientSounds) out.ambientSounds = [...map.ambientSounds];
    return out;
}

export function serializeMapJson(map: EditorMap): string {
    return JSON.stringify(serializeMap(map), null, 2);
}

/**
 * Parse map JSON into an editable map. Only the shape checked here is
 * guaranteed; full schema validation is `validateMap()` (map-validator.ts).
 */
export function parseMapJson(json: string): EditorMap {
    // Property reads on `null` throw a TypeError, as before.
    const data: Record<string, unknown> = JSON.parse(json);
    if (!data.zones || !data.spawn || !(data.goals || data.goal)) {
        throw new Error('Invalid map: missing zones, spawn, or goals');
    }
    // Boundary: an imported/drafted map file, shape-checked above.
    const mapDef = data as MapDefinition;
    // The editor works on {x, y, z} objects; v2 files may use [x, y, z] arrays.
    return Object.assign(mapDef, {
        zones: mapDef.zones.map(normalizeStampZone),
        spawn: toVec3Object(mapDef.spawn),
    });
}

export function downloadMapJson(map: EditorMap, filename?: string): void {
    const blob = new Blob([serializeMapJson(map)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || `${map.id || 'map'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
}

export function saveDraft(map: EditorMap): void {
    localStorage.setItem(DRAFT_STORAGE_KEY, serializeMapJson(map));
}

export function loadDraft(): EditorMap | null {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return parseMapJson(raw);
}

export class MapDocument {
    declare _map: EditorMap;
    declare _undoStack: MapCommand[];
    declare _redoStack: MapCommand[];

    constructor(initialMap: EditorMap = createEmptyMap()) {
        this._map = cloneMap(initialMap);
        this._undoStack = [];
        this._redoStack = [];
    }

    get map(): EditorMap {
        return this._map;
    }

    execute(command: MapCommand): void {
        command.apply();
        this._undoStack.push(command);
        if (this._undoStack.length > UNDO_STACK_LIMIT) {
            this._undoStack.shift();
        }
        this._redoStack = [];
    }

    undo(): boolean {
        const command = this._undoStack.pop();
        if (!command) return false;
        command.revert();
        this._redoStack.push(command);
        return true;
    }

    redo(): boolean {
        const command = this._redoStack.pop();
        if (!command) return false;
        command.apply();
        this._undoStack.push(command);
        return true;
    }

    canUndo(): boolean {
        return this._undoStack.length > 0;
    }

    canRedo(): boolean {
        return this._redoStack.length > 0;
    }

    /**
     * Replace map without affecting undo history (playtest restore).
     */
    loadFromMap(map: EditorMap): void {
        this._map = cloneMap(map);
        syncGoalsFromZones(this._map);
        syncCheckpointsFromZones(this._map);
        recountCollectiblesTotal(this._map);
    }
}
