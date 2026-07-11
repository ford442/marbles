/** @typedef {{ x: number, y: number, z: number }} Vec3 */
/** @typedef {{ type: string, pos: Vec3, size?: Vec3, color?: number[], rotY?: number }} MapZone */
/** @typedef {import('../types/map.js').MapDefinition} MapDefinition */

export const PLAYTEST_LEVEL_ID = '__editor_playtest__';
export const DRAFT_STORAGE_KEY = 'marbles3d_map_editor_draft';

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
        zones: map.zones.map((z) => {
            const zone = { type: z.type, pos: { ...z.pos } };
            if (z.size) zone.size = { ...z.size };
            if (z.color) zone.color = [...z.color];
            if (z.rotY) zone.rotY = z.rotY;
            return zone;
        }),
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
    if (map.abilities) out.abilities = { ...map.abilities };
    if (map.medals) out.medals = { ...map.medals };
    if (map.collectiblesTotal !== undefined) out.collectiblesTotal = map.collectiblesTotal;
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
