/** @typedef {{ x: number, y: number, z: number }} Vec3 */
/** @typedef {{ type: string, pos: Vec3, size?: Vec3, color?: number[], rotY?: number }} MapZone */
/** @typedef {import('../types/map.js').MapDefinition} MapDefinition */

export const PLAYTEST_LEVEL_ID = '__editor_playtest__';
export const DRAFT_STORAGE_KEY = 'marbles3d_map_editor_draft';
export const UNDO_STACK_LIMIT = 100;

/**
 * @returns {MapDefinition}
 */
export function createEmptyMap() {
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
 * @param {MapDefinition} map
 * @returns {MapDefinition}
 */
export function cloneMap(map) {
    return structuredClone(map);
}

/**
 * Build runtime level object from a map definition (mirrors AssetRegistry.convertMapToLevel).
 * @param {MapDefinition} mapDef
 */
export function mapDefToLevel(mapDef) {
    return {
        name: mapDef.name,
        description: mapDef.description || '',
        difficulty: mapDef.difficulty,
        zones: mapDef.zones,
        spawn: mapDef.spawn,
        goals: mapDef.goals,
        checkpoints: mapDef.checkpoints,
        camera: mapDef.camera || { mode: 'orbit', angle: 0, height: 10, radius: 25 },
        nightMode: mapDef.nightMode,
        backgroundColor: mapDef.backgroundColor,
        environment: mapDef.environment,
        colorGrade: mapDef.colorGrade,
        abilities: mapDef.abilities,
        medals: mapDef.medals,
        collectiblesTotal: mapDef.collectiblesTotal,
        chapter: mapDef.chapter,
        behaviors: mapDef.behaviors,
        source: 'editor',
    };
}

/**
 * Derive goal volumes from placed goal zones (4-unit cube around each goal center).
 * @param {MapDefinition} map
 */
export function syncGoalsFromZones(map) {
    const goalZones = map.zones.filter((z) => z.type === 'goal');
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
 * @param {MapDefinition} map
 */
export function syncCheckpointsFromZones(map) {
    const cpZones = map.zones.filter((z) => z.type === 'checkpoint');
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
 * @param {MapDefinition} map
 */
export function recountCollectiblesTotal(map) {
    const count = map.zones.filter(
        (z) => z.type === 'collectible' || z.collectible
    ).length;
    map.collectiblesTotal = count;
}

/**
 * Serialize a single zone for export.
 * @param {import('../types/map.js').MapZoneDefinition} z
 */
export function serializeZone(z) {
    const zone = { type: z.type, pos: { ...z.pos } };
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

/**
 * Strip editor-only fields and produce downloadable JSON.
 * @param {MapDefinition} map
 */
export function serializeMap(map) {
    const out = {
        id: map.id,
        name: map.name,
        description: map.description,
        version: map.version,
        author: map.author,
        difficulty: map.difficulty,
        zones: map.zones.map(serializeZone),
        spawn: { ...map.spawn },
        goals: map.goals.map((g) => ({
            id: g.id,
            range: {
                x: [...g.range.x],
                y: [...g.range.y],
                z: [...g.range.z],
            },
        })),
        camera: { ...map.camera },
    };
    if (map.abilities) out.abilities = structuredClone(map.abilities);
    if (map.medals) out.medals = { ...map.medals };
    if (map.collectiblesTotal !== undefined) out.collectiblesTotal = map.collectiblesTotal;
    if (map.checkpoints?.length) {
        out.checkpoints = map.checkpoints.map((cp) => ({
            id: cp.id,
            ...(cp.pos ? { pos: { ...cp.pos } } : {}),
            ...(cp.range ? {
                range: {
                    x: [...cp.range.x],
                    y: [...cp.range.y],
                    z: [...cp.range.z],
                },
            } : {}),
        }));
    }
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

/**
 * @param {MapDefinition} map
 * @returns {string}
 */
export function serializeMapJson(map) {
    return JSON.stringify(serializeMap(map), null, 2);
}

/**
 * @param {string} json
 * @returns {MapDefinition}
 */
export function parseMapJson(json) {
    const data = JSON.parse(json);
    if (!data.zones || !data.spawn || !data.goals) {
        throw new Error('Invalid map: missing zones, spawn, or goals');
    }
    return data;
}

/**
 * @param {MapDefinition} map
 * @param {string} [filename]
 */
export function downloadMapJson(map, filename) {
    const blob = new Blob([serializeMapJson(map)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || `${map.id || 'map'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
}

/**
 * @param {MapDefinition} map
 */
export function saveDraft(map) {
    localStorage.setItem(DRAFT_STORAGE_KEY, serializeMapJson(map));
}

/**
 * @returns {MapDefinition | null}
 */
export function loadDraft() {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return parseMapJson(raw);
}

/** @typedef {import('./map-commands.js').MapCommand} MapCommand */

export class MapDocument {
    /** @param {MapDefinition} [initialMap] */
    constructor(initialMap = createEmptyMap()) {
        /** @type {MapDefinition} */
        this._map = cloneMap(initialMap);
        /** @type {MapCommand[]} */
        this._undoStack = [];
        /** @type {MapCommand[]} */
        this._redoStack = [];
    }

    /** @returns {MapDefinition} */
    get map() {
        return this._map;
    }

    /**
     * @param {MapCommand} command
     */
    execute(command) {
        command.apply();
        this._undoStack.push(command);
        if (this._undoStack.length > UNDO_STACK_LIMIT) {
            this._undoStack.shift();
        }
        this._redoStack = [];
    }

    undo() {
        const command = this._undoStack.pop();
        if (!command) return false;
        command.revert();
        this._redoStack.push(command);
        return true;
    }

    redo() {
        const command = this._redoStack.pop();
        if (!command) return false;
        command.apply();
        this._undoStack.push(command);
        return true;
    }

    canUndo() {
        return this._undoStack.length > 0;
    }

    canRedo() {
        return this._redoStack.length > 0;
    }

    /**
     * Replace map without affecting undo history (playtest restore).
     * @param {MapDefinition} map
     */
    loadFromMap(map) {
        this._map = cloneMap(map);
        syncGoalsFromZones(this._map);
        syncCheckpointsFromZones(this._map);
        recountCollectiblesTotal(this._map);
    }
}
