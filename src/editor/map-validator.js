import mapSchema from '../../assets/schemas/map-schema.json' with { type: 'json' };
import { ZONE_HANDLERS } from '../zone-setup/registry.js';

/**
 * @param {unknown} data
 * @param {object} schema
 * @param {string} [path]
 * @returns {string[]}
 */
export function validateAgainstSchema(data, schema, path = 'map') {
    const errors = [];

    if (schema.required) {
        for (const field of schema.required) {
            if (!(field in /** @type {object} */ (data))) {
                errors.push(`${path}: missing required field "${field}"`);
            }
        }
    }

    if (!schema.properties || typeof data !== 'object' || data === null) {
        return errors;
    }

    const record = /** @type {Record<string, unknown>} */ (data);

    for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (!(key in record)) continue;
        const value = record[key];
        const prop = /** @type {Record<string, unknown>} */ (propSchema);

        if (prop.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (prop.type === 'integer') {
                if (actualType !== 'number' || !Number.isInteger(value)) {
                    errors.push(`${path}.${key}: expected integer, got ${value}`);
                }
            } else if (actualType !== prop.type) {
                errors.push(`${path}.${key}: expected ${prop.type}, got ${actualType}`);
            }
        }

        if (prop.enum && !/** @type {unknown[]} */ (prop.enum).includes(value)) {
            errors.push(`${path}.${key}: must be one of ${/** @type {unknown[]} */ (prop.enum).join(', ')}`);
        }

        if (prop.pattern && typeof value === 'string') {
            if (!new RegExp(/** @type {string} */ (prop.pattern)).test(value)) {
                errors.push(`${path}.${key}: does not match pattern ${prop.pattern}`);
            }
        }

        if (typeof value === 'number') {
            if (prop.minimum !== undefined && value < /** @type {number} */ (prop.minimum)) {
                errors.push(`${path}.${key}: must be >= ${prop.minimum}`);
            }
            if (prop.maximum !== undefined && value > /** @type {number} */ (prop.maximum)) {
                errors.push(`${path}.${key}: must be <= ${prop.maximum}`);
            }
        }

        if (prop.type === 'array' && prop.items && Array.isArray(value)) {
            if (prop.minItems && value.length < /** @type {number} */ (prop.minItems)) {
                errors.push(`${path}.${key}: needs at least ${prop.minItems} items`);
            }
            const itemSchema = /** @type {object} */ (prop.items);
            value.forEach((item, index) => {
                errors.push(...validateAgainstSchema(item, itemSchema, `${path}.${key}[${index}]`));
            });
        }

        if (prop.type === 'object' && prop.properties && typeof value === 'object' && value !== null) {
            errors.push(...validateAgainstSchema(value, prop, `${path}.${key}`));
        }
    }

    return errors;
}

/**
 * Non-blocking semantic checks beyond schema shape: things that will load
 * but likely won't play as intended (unknown zone type, model zone with no
 * model reference, etc).
 * @param {unknown} mapDef
 * @returns {string[]}
 */
export function collectWarnings(mapDef) {
    const warnings = [];
    const zones = /** @type {{ zones?: unknown[] }} */ (mapDef)?.zones;
    if (!Array.isArray(zones)) return warnings;

    zones.forEach((zone, index) => {
        const z = /** @type {Record<string, unknown>} */ (zone);
        const type = /** @type {string} */ (z?.type);
        if (!type) return;
        if (!(type in ZONE_HANDLERS)) {
            warnings.push(`zones[${index}]: unknown type "${type}" — no zone handler registered`);
        }
        if (type === 'model' && !z.model) {
            warnings.push(`zones[${index}]: model zone has no "model" reference — will render a fallback box`);
        }
    });

    return warnings;
}

/**
 * @param {unknown} mapDef
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateMap(mapDef) {
    const errors = validateAgainstSchema(mapDef, mapSchema);
    const warnings = collectWarnings(mapDef);
    return { valid: errors.length === 0, errors, warnings };
}

export { mapSchema };
