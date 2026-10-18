// @ts-check
/**
 * The one map rule set: `assets/schemas/map-schema.json` compiled with ajv,
 * plus the semantic checks a schema can't express. Shared by
 *   - scripts/validate-assets.cjs (CI),
 *   - src/editor/map-validator.js (editor + workshop import),
 * and mirrored by backend/storage/services/map_validation.py (same schema
 * file via `jsonschema`).
 *
 * The runtime loader does NOT import this (ajv stays out of the game chunk);
 * it runs the cheap `structuralErrors` check from map-normalize.js instead.
 */

import { PRIMITIVE_ZONE_TYPES } from './map-normalize.js';

/** @typedef {{ instancePath: string, message?: string, keyword: string, params?: Record<string, unknown> }} AjvError */
/** @typedef {{ (data: unknown): boolean, errors?: AjvError[] | null }} CompiledValidator */
/** @typedef {new (opts: Record<string, unknown>) => { compile(schema: object): CompiledValidator }} AjvClass */

/**
 * @param {AjvClass} Ajv  the `ajv` default export (passed in so CJS and ESM callers share this module)
 * @param {object} schema parsed map-schema.json
 * @returns {(map: unknown) => string[]} schema error messages (empty when valid)
 */
export function compileMapSchema(Ajv, schema) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    return (map) => (validate(map) ? [] : formatAjvErrors(validate.errors ?? []));
}

/**
 * ajv reports every failed branch of the zone if/then/else and vec3 oneOf;
 * keep the most specific message per path so authors see one line per problem.
 * @param {AjvError[]} errors
 * @returns {string[]}
 */
export function formatAjvErrors(errors) {
    /** @type {Map<string, string[]>} */
    const byPath = new Map();
    for (const err of errors) {
        if (err.keyword === 'if' || err.keyword === 'allOf') continue;
        const path = `map${err.instancePath.replace(/\/(\d+)/g, '[$1]').replace(/\//g, '.')}`;
        let msg = err.message ?? err.keyword;
        if (err.keyword === 'additionalProperties' && err.params?.additionalProperty) {
            msg = `unknown property "${err.params.additionalProperty}"`;
        } else if (err.keyword === 'enum' && Array.isArray(err.params?.allowedValues)) {
            msg = `must be one of ${err.params.allowedValues.join(', ')}`;
        }
        const list = byPath.get(path) ?? [];
        if (!list.includes(msg)) list.push(msg);
        byPath.set(path, list);
    }
    /** @type {string[]} */
    const out = [];
    for (const [path, msgs] of byPath) {
        // oneOf noise ("must be array" + "must be object" + "must match exactly one") → one line.
        const filtered = msgs.filter((m) => m !== 'must match exactly one schema in oneOf');
        const shown = filtered.length > 0 && filtered.every((m) => m.startsWith('must be '))
            && msgs.includes('must match exactly one schema in oneOf')
            ? ['must be an [x, y, z] array or {x, y, z} object']
            : filtered.length > 0 ? filtered : msgs;
        for (const m of shown) out.push(`${path}: ${m}`);
    }
    return out;
}

/**
 * Checks beyond schema shape. `zoneTypes` is the registered zone.type set
 * (zone-handlers.json / registry ZONE_TYPES).
 * @param {any} map
 * @param {Iterable<string>} zoneTypes
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function semanticChecks(map, zoneTypes) {
    const known = new Set(zoneTypes);
    /** @type {string[]} */
    const errors = [];
    /** @type {string[]} */
    const warnings = [];
    const zones = Array.isArray(map?.zones) ? map.zones : [];
    const version = map?.schemaVersion ?? 1;

    zones.forEach((/** @type {any} */ zone, /** @type {number} */ i) => {
        const type = zone?.type;
        if (typeof type !== 'string') return;
        if (!known.has(type)) {
            warnings.push(`zones[${i}]: unknown type "${type}" — no zone handler registered`);
        }
        if (PRIMITIVE_ZONE_TYPES.has(type) && version < 2) {
            errors.push(`zones[${i}]: primitive "${type}" requires "schemaVersion": 2`);
        }
        if (type === 'model' && !zone.model) {
            warnings.push(`zones[${i}]: model zone has no "model" reference — will render a fallback box`);
        }
    });

    if (version < 2) {
        if (map?.goal) errors.push('map.goal requires "schemaVersion": 2 (v1 maps use goals[])');
        if (map?.rivals) errors.push('map.rivals requires "schemaVersion": 2');
    }
    if (map?.goal && Array.isArray(map?.goals) && map.goals.length > 0) {
        errors.push('map: set either goal (v2) or goals[], not both');
    }
    return { errors, warnings };
}
