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
/** @typedef {import('../types/map.ts').MapZoneDefinition} MapZoneDefinition */
/** @typedef {import('../types/map.ts').NormalizedZoneDefinition} NormalizedZoneDefinition */
/** @typedef {import('../types/map.ts').NormalizedStampZone} NormalizedStampZone */
/** @typedef {import('../types/map.ts').PrimitiveZoneDefinition} PrimitiveZoneDefinition */
/** @typedef {import('../types/map.ts').MapGoalDefinition} MapGoalDefinition */
/** @typedef {import('../types/map.ts').MapGoalVolume} MapGoalVolume */
/** @typedef {import('../types/map.ts').MapVec3} Vec3 */
/** @typedef {import('../types/map.ts').MapVec3Input} Vec3Input */
/** @typedef {import('../types/map.ts').RuntimeLevel} RuntimeLevel */

/**
 * Kept in sync with primitives.ts PRIMITIVE_TYPES (asserted by tests/levels/).
 * @type {ReadonlySet<string>}
 */
export const PRIMITIVE_ZONE_TYPES = new Set(['box', 'ramp', 'mover', 'spinner', 'trigger']);

/**
 * A closed v2 primitive (box/ramp/mover/spinner/trigger) rather than a stamp.
 * @param {{ type: string }} zone
 * @returns {zone is PrimitiveZoneDefinition}
 */
export function isPrimitiveZone(zone) {
    return PRIMITIVE_ZONE_TYPES.has(zone.type);
}

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
 * `[x, y, z]` → {x, y, z}; an object vector is kept as-is (same reference).
 * @param {Vec3Input} v
 * @returns {Vec3}
 */
function lowerVec3(v) {
    return Array.isArray(v) ? { x: Number(v[0]), y: Number(v[1]), z: Number(v[2]) } : v;
}

/**
 * @param {MapGoalVolume} goal
 * @param {number} id
 * @returns {MapGoalDefinition}
 */
export function goalVolumeToRange(goal, id = 1) {
    const c = toVec3Object(goal.pos) ?? { x: 0, y: 0, z: 0 };
    const s = toVec3Object(goal.size) ?? { x: 4, y: 4, z: 4 };
    return {
        id,
        range: {
            x: [c.x - s.x / 2, c.x + s.x / 2],
            y: [c.y - s.y / 2, c.y + s.y / 2],
            z: [c.z - s.z / 2, c.z + s.z / 2],
        },
    };
}

/**
 * Stamp zones' array `pos` / `size` become {x, y, z}; primitives pass through.
 * @param {MapZoneDefinition} zone
 * @returns {NormalizedZoneDefinition}
 */
export function normalizeStampZone(zone) {
    if (!zone || isPrimitiveZone(zone)) return zone;
    const { size, ...rest } = zone;
    /** @type {NormalizedStampZone} */
    const out = { ...rest, pos: lowerVec3(zone.pos) };
    if (size !== undefined) out.size = lowerVec3(size);
    return out;
}

/**
 * @param {MapDefinition} mapDef
 * @param {'json' | 'editor' | 'code'} source
 * @returns {RuntimeLevel}
 */
export function mapToRuntimeLevel(mapDef, source) {
    const goals = mapDef.goal ? [goalVolumeToRange(mapDef.goal)] : mapDef.goals;
    // Every runtime field is copied, absent ones as explicit `undefined` keys
    // (which exactOptionalPropertyTypes can't express), and the input may be
    // unvalidated JSON whose `spawn` / `goals` are missing — hence the assertion.
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
        movementModel: mapDef.movementModel,
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
    /** @type {string[]} */
    const errors = [];
    if (!mapDef || typeof mapDef !== 'object') return ['map is not an object'];
    const m = /** @type {Record<string, unknown>} */ (mapDef);
    if (!Array.isArray(m.zones)) errors.push('zones must be an array');
    else if (m.zones.some((/** @type {unknown} */ z) => !hasStringType(z))) errors.push('every zone needs a string type');
    const spawn = toVec3Object(m.spawn);
    if (!spawn || ![spawn.x, spawn.y, spawn.z].every(Number.isFinite)) errors.push('spawn must be a finite vector');
    if (!m.goal && !Array.isArray(m.goals)) errors.push('goal or goals[] is required');
    return errors;
}

/**
 * @param {unknown} z
 * @returns {boolean}
 */
function hasStringType(z) {
    return typeof z === 'object' && z !== null && 'type' in z && typeof z.type === 'string';
}
