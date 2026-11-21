import Ajv from 'ajv';
import mapSchema from '../../assets/schemas/map-schema.json' with { type: 'json' };
import { ZONE_TYPES } from '../zone-setup/registry.js';
import { compileMapSchema, semanticChecks } from '../levels/map-rules.js';

export interface MapValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Editor + workshop-import validation: the same compiled map-schema.json and
 * semantic rules CI runs (scripts/validate-assets.cjs). ajv only ships in the
 * editor chunk; the game loader uses map-normalize.js structuralErrors.
 */
const validateSchema = compileMapSchema(Ajv, mapSchema);

/**
 * Non-blocking semantic checks beyond schema shape: things that will load
 * but likely won't play as intended (unknown zone type, model zone with no
 * model reference, etc).
 */
export function collectWarnings(mapDef: unknown): string[] {
    return semanticChecks(mapDef, ZONE_TYPES).warnings;
}

export function validateMap(mapDef: unknown): MapValidationResult {
    const { errors: semanticErrors, warnings } = semanticChecks(mapDef, ZONE_TYPES);
    const errors = [...validateSchema(mapDef), ...semanticErrors];
    return { valid: errors.length === 0, errors, warnings };
}

export { mapSchema };
