// @ts-check
/**
 * Map definition (v1 or v2 JSON) → runtime level. The single conversion used
 * by AssetRegistry (shipped maps), the editor playtest and the headless level
 * harness, so all three see the same zones/spawn/goals.
 *
 * v2 conveniences are lowered here: [x, y, z] vectors on stamps/spawn become
 * {x, y, z}, and a `goal` volume becomes `goals[]`. Primitive zones are passed
 * through untouched; primitives.ts reads both vector forms.
 */

/** @typedef {import('../types/map.ts').MapDefinition} MapDefinition */
/** @typedef {import('../types/map.ts').RuntimeLevel} RuntimeLevel */
/** @typedef {{ x: number, y: number, z: number }} Vec3 */

/** Kept in sync with primitives.ts PRIMITIVE_TYPES (asserted by tests/levels/). */
export const PRIMITIVE_ZONE_TYPES = new Set(['box', 'ramp', 'mover', 'spinner', 'trigger']);

/**
 * @param {unknown} v
 * @returns {Vec3 | undefined}
 */
export function toVec3Object(v) {
    if (Array.isArray(v)) return { x: Number(v[0]), y: Number(v[1]), z: Number(v[2]) };
    if (v && typeof v === 'object') {
        const o = /** @type {Record<string, unknown>} */ (v);
        return { x: Number(o.x), y: Number(o.y), z: Number(o.z) };
    }
    return undefined;
}

/**
 * @param {{ pos: unknown, size: unknown }} goal
 * @param {number} id
 */
export function goalVolumeToRange(goal, id = 1) {
    const c = toVec3Object(goal.pos) ?? { x: 0, y: 0, z: 0 };
    const s = toVec3Object(goal.size) ?? { x: 4, y: 4, z: 4 };
    return {
        id,
        range: {
            x: /** @type {[number, number]} */ ([c.x - s.x / 2, c.x + s.x / 2]),
            y: /** @type {[number, number]} */ ([c.y - s.y / 2, c.y + s.y / 2]),
            z: /** @type {[number, number]} */ ([c.z - s.z / 2, c.z + s.z / 2]),
        },
    };
}

/**
 * Stamp zones' array `pos` / `size` become {x, y, z}; primitives pass through.
 * @param {Record<string, any>} zone
 * @returns {Record<string, any>}
 */
export function normalizeStampZone(zone) {
    if (!zone || PRIMITIVE_ZONE_TYPES.has(zone.type)) return zone;
    const out = { ...zone };
    if (Array.isArray(zone.pos)) out.pos = toVec3Object(zone.pos);
    if (Array.isArray(zone.size)) out.size = toVec3Object(zone.size);
    return out;
}

/**
 * @param {MapDefinition | Record<string, any>} mapDef
 * @param {'json' | 'editor' | 'code'} source
 * @returns {RuntimeLevel}
 */
export function mapToRuntimeLevel(mapDef, source) {
    const goals = mapDef.goal ? [goalVolumeToRange(/** @type {any} */ (mapDef.goal))] : mapDef.goals;
    return /** @type {RuntimeLevel} */ ({
        name: mapDef.name,
        description: mapDef.description || '',
        difficulty: mapDef.difficulty,
        schemaVersion: mapDef.schemaVersion ?? 1,
        zones: (mapDef.zones || []).map(normalizeStampZone),
        spawn: toVec3Object(mapDef.spawn) ?? mapDef.spawn,
        goals,
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
        rivals: mapDef.rivals,
        bounds: mapDef.bounds,
        solution: mapDef.solution,
        goalless: mapDef.goalless,
        source,
    });
}

/**
 * Cheap load-time check (no ajv): the fields the loader dereferences.
 * Full validation runs in CI and the editor via map-rules.js.
 * @param {unknown} mapDef
 * @returns {string[]}
 */
export function structuralErrors(mapDef) {
    const m = /** @type {Record<string, any>} */ (mapDef);
    /** @type {string[]} */
    const errors = [];
    if (!m || typeof m !== 'object') return ['map is not an object'];
    if (!Array.isArray(m.zones)) errors.push('zones must be an array');
    else if (m.zones.some((/** @type {any} */ z) => !z || typeof z.type !== 'string')) errors.push('every zone needs a string type');
    const spawn = toVec3Object(m.spawn);
    if (!spawn || ![spawn.x, spawn.y, spawn.z].every(Number.isFinite)) errors.push('spawn must be a finite vector');
    if (!m.goal && !Array.isArray(m.goals)) errors.push('goal or goals[] is required');
    return errors;
}
