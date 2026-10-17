// @ts-check
/**
 * Marble catalog format helpers — pure functions shared by the build-time
 * generator (`scripts/generate-marbles-data.mjs`), the runtime asset registry
 * and unit tests.
 *
 * Source of truth: `assets/marbles/<id>.json` (schema:
 * `assets/schemas/marble-schema.json`), ordered by the `marbles` section of
 * `assets/manifest.json`. `src/marbles_data.js` is GENERATED from those files.
 */

/**
 * How a marble becomes selectable in the picker (src/marbles/selection.js):
 * `default` — available from the start; `campaign` — granted by a campaign
 * milestone (CampaignProgress.unlockedMarbles); `premium` — premium marbles,
 * selectable only once their id is in unlockedMarbles (granted, never free).
 */
export const MARBLE_UNLOCK_TYPES = Object.freeze(['default', 'campaign', 'premium']);

/** Player marble when nothing (valid) is selected: the completability reference marble. */
export const DEFAULT_MARBLE_ID = 'classic_red';

/** Hard ceiling for restitution: anything above 1.0 gains energy on every bounce. */
export const MAX_RESTITUTION = 1.0;

/** Absolute ceiling for marbles listed in the bouncyCap exception file. */
export const BOUNCY_CAP_HARD_MAX = 1.5;

/**
 * `appearance.emissive.intensity` is a multiplier: the point-light intensity is
 * `intensity * EMISSIVE_LIGHT_SCALE` (so 1.0 → 10 000 lm).
 */
export const EMISSIVE_LIGHT_SCALE = 10000;

/** Upper bound for `appearance.emissive.intensity` (catches absolute-lumen values). */
export const MAX_EMISSIVE_INTENSITY = 100;

/** Per-marble procedural shader parameters (`appearance.shader.*`). */
export const SHADER_FIELDS = Object.freeze([
    'bumpScale',
    'bumpFrequency',
    'grainScale',
    'scratchesIntensity',
    'anisotropy',
    'heatIntensity',
    'crackGlow',
    'iridescenceScale',
    'sparkleDensity',
    'fresnelStrength',
    'chromaticDispersion',
]);

/** Physics keys copied verbatim from `physics.*`. */
const PHYSICS_FIELDS = Object.freeze([
    'radius',
    'density',
    'friction',
    'restitution',
    'gravityScale',
    'linearDamping',
    'angularDamping',
]);

/** Appearance keys copied verbatim from `appearance.*`. */
const APPEARANCE_FIELDS = Object.freeze([
    'roughness',
    'metallic',
    'reflectance',
    'clearCoat',
    'clearCoatRoughness',
    'thickness',
    'materialType',
    'geometry',
    'rainbow',
]);

/**
 * @typedef {object} MarbleInfo
 * Runtime (game-format) marble entry, as found in `marblesInfo`.
 * @property {string} id
 * @property {string} name
 * @property {boolean} premium
 * @property {'default' | 'campaign' | 'premium'} unlock
 * @property {string} [rarity]
 * @property {[number, number, number]} color
 * @property {number} [radius]
 * @property {number} [density]
 * @property {number} [friction]
 * @property {number} [restitution]
 * @property {number} [gravityScale]
 * @property {number} [linearDamping]
 * @property {number} [angularDamping]
 * @property {boolean} [emissive]
 * @property {[number, number, number]} [lightColor]
 * @property {number} [lightIntensity]
 * @property {string} [materialType]
 * @property {string} [geometry]
 * @property {boolean} [rainbow]
 */

/**
 * Snake-case id from a display name ("Hyper-Bouncing Prism" → "hyper_bouncing_prism").
 * @param {string} name
 */
export function slugifyMarbleName(name) {
    return String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * Convert a marble JSON definition into the runtime format consumed by
 * `MarbleRegistry`. Only fields present in the source are emitted, so engine
 * defaults (radius 0.5, restitution 0.5, Rapier density 1) still apply.
 * @param {any} def
 * @returns {MarbleInfo & Record<string, unknown>}
 */
export function marbleDefToGameInfo(def) {
    const appearance = def?.appearance || {};
    const physics = def?.physics || {};
    const color = appearance.color || { r: 0.5, g: 0.5, b: 0.5 };

    /** @type {MarbleInfo & Record<string, unknown>} */
    const info = {
        id: def.id,
        name: def.name,
        premium: def.premium === true,
        unlock: def.unlock ?? (def.premium === true ? 'premium' : 'default'),
        color: [color.r, color.g, color.b],
    };
    if (def.rarity) info.rarity = def.rarity;

    for (const key of PHYSICS_FIELDS) {
        if (physics[key] !== undefined) info[key] = physics[key];
    }
    for (const key of APPEARANCE_FIELDS) {
        if (appearance[key] !== undefined) info[key] = appearance[key];
    }
    const shader = appearance.shader || {};
    for (const key of SHADER_FIELDS) {
        if (shader[key] !== undefined) info[key] = shader[key];
    }

    const emissive = appearance.emissive;
    if (emissive && (emissive.intensity ?? 1) > 0) {
        info.emissive = true;
        info.lightColor = [emissive.r ?? color.r, emissive.g ?? color.g, emissive.b ?? color.b];
        info.lightIntensity = round((emissive.intensity ?? 1) * EMISSIVE_LIGHT_SCALE);
    }

    return info;
}

/** @param {number} v */
function round(v) {
    return Math.round(v * 1000) / 1000;
}

/**
 * `assets/marbles/_bouncy-cap.json` → { id: max restitution }.
 * @param {Record<string, any>} json
 * @returns {Record<string, number>}
 */
export function bouncyCapLimits(json) {
    /** @type {Record<string, number>} */
    const out = {};
    for (const [id, entry] of Object.entries(json || {})) {
        if (id.startsWith('$')) continue;
        out[id] = typeof entry === 'number' ? entry : Number(entry?.max);
    }
    return out;
}

/**
 * Catalog-level invariants the JSON schema can't express: unique ids/names,
 * restitution cap (with bouncyCap exceptions), file id ↔ manifest key, and the
 * emissive-intensity convention.
 *
 * @param {Array<{ key?: string, def: any }>} entries manifest key + parsed JSON
 * @param {{ bouncyCap?: Record<string, number> }} [options]
 * @returns {string[]} human-readable problems (empty = OK)
 */
export function findCatalogProblems(entries, options = {}) {
    const bouncyCap = options.bouncyCap || {};
    const problems = [];
    /** @type {Map<string, string>} */
    const ids = new Map();
    /** @type {Map<string, string>} */
    const names = new Map();

    for (const { key, def } of entries) {
        const label = key || def?.id || '<unknown>';
        if (!def || typeof def !== 'object') {
            problems.push(`${label}: not an object`);
            continue;
        }
        if (key && def.id !== key) {
            problems.push(`${label}: file id "${def.id}" differs from manifest key "${key}"`);
        }
        if (ids.has(def.id)) {
            problems.push(`id collision: "${def.id}" used by ${ids.get(def.id)} and ${label}`);
        } else {
            ids.set(def.id, label);
        }
        const nameKey = String(def.name || '').trim().toLowerCase();
        if (!nameKey) {
            problems.push(`${label}: missing name`);
        } else if (names.has(nameKey)) {
            problems.push(`name collision: "${def.name}" used by ${names.get(nameKey)} and ${label}`);
        } else {
            names.set(nameKey, label);
        }

        const restitution = def.physics?.restitution;
        if (typeof restitution === 'number') {
            const cap = bouncyCap[def.id];
            const limit = typeof cap === 'number' ? Math.min(cap, BOUNCY_CAP_HARD_MAX) : MAX_RESTITUTION;
            if (restitution > limit) {
                problems.push(
                    `${label}: restitution ${restitution} > ${limit}` +
                    (typeof cap === 'number' ? ' (bouncyCap limit)' : ' (add to bouncyCap only if gameplay depends on it)'),
                );
            }
        }

        if (def.premium === true && def.unlock && def.unlock !== 'premium') {
            problems.push(`${label}: premium marbles must use unlock "premium" (got "${def.unlock}")`);
        }

        const intensity = def.appearance?.emissive?.intensity;
        if (typeof intensity === 'number' && intensity > MAX_EMISSIVE_INTENSITY) {
            problems.push(
                `${label}: appearance.emissive.intensity ${intensity} looks like absolute lumens; ` +
                `use a multiplier (light = intensity × ${EMISSIVE_LIGHT_SCALE})`,
            );
        }
    }

    for (const [id, cap] of Object.entries(bouncyCap)) {
        if (!ids.has(id)) problems.push(`bouncyCap lists unknown marble id "${id}"`);
        if (!(cap > MAX_RESTITUTION && cap <= BOUNCY_CAP_HARD_MAX)) {
            problems.push(`bouncyCap.${id}: max ${cap} must be in (${MAX_RESTITUTION}, ${BOUNCY_CAP_HARD_MAX}]`);
        }
    }

    return problems;
}
