#!/usr/bin/env node
/**
 * Generate TypeScript types from the asset JSON schemas — the one source of
 * truth that ajv validation (scripts/validate-assets.cjs, the editor's
 * map-validator, backend map_validation.py) already enforces.
 *
 *   assets/schemas/map-schema.json    -> src/types/generated/map-schema.ts
 *   assets/schemas/marble-schema.json -> src/types/generated/marble-schema.ts
 *   assets/schemas/sound-schema.json  -> src/types/generated/sound-schema.ts
 *
 * `src/types/map.ts` (runtime level shapes), `zone-setup/primitives.ts`, the
 * level lab and the editor import from these files instead of re-declaring
 * the map format.
 *
 * Usage:
 *   node scripts/gen-schema-types.mjs           # (re)write the generated files
 *   node scripts/gen-schema-types.mjs --check   # CI: fail if they are stale
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'src', 'types', 'generated');
const CHECK = process.argv.includes('--check');

const JOBS = [
    { schema: 'map-schema.json', out: 'map-schema.ts', name: 'MapSchema', prepare: prepareMapSchema },
    { schema: 'marble-schema.json', out: 'marble-schema.ts', name: 'MarbleSchema' },
    { schema: 'sound-schema.json', out: 'sound-schema.ts', name: 'SoundSchema' },
];

/**
 * The map schema dispatches `definitions.zone` on `type` with `allOf` +
 * `if`/`then`/`else` (primitive defs for box/ramp/mover/spinner/trigger,
 * `stampZone` otherwise). json-schema-to-typescript ignores conditionals, so
 * for typing restate the same rule as the union it means.
 */
function prepareMapSchema(schema) {
    const zone = schema.definitions?.zone;
    if (!zone?.allOf) throw new Error('map-schema: expected definitions.zone.allOf (if/then dispatch)');
    const refs = [];
    for (const branch of zone.allOf) {
        const target = branch.then ?? branch.else;
        if (!target?.$ref) throw new Error('map-schema: zone dispatch branch without a $ref');
        refs.push({ $ref: target.$ref });
    }
    schema.definitions.zone = {
        description: zone.description ?? 'A map zone: a v2 primitive (by `type`) or a registered stamp zone.',
        anyOf: refs,
    };
    return schema;
}

/** Give every `definitions` entry a title so it is emitted as a named, exported type. */
function titleDefinitions(schema) {
    for (const [key, def] of Object.entries(schema.definitions ?? {})) {
        if (!def.title) def.title = key[0].toUpperCase() + key.slice(1);
    }
    return schema;
}

async function generate({ schema: file, name, prepare }) {
    const schemaPath = path.join(ROOT, 'assets', 'schemas', file);
    let schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    if (prepare) schema = prepare(schema);
    schema = titleDefinitions(schema);
    schema.title = name;
    const banner = [
        '/* eslint-disable */',
        '/**',
        ` * GENERATED from assets/schemas/${file} by scripts/gen-schema-types.mjs.`,
        ' * Do not edit: change the schema and run `npm run gen:schema-types`.',
        ' */',
    ].join('\n');
    const ts = await compile(schema, name, {
        bannerComment: banner,
        // JSON Schema semantics: an object without `additionalProperties: false`
        // accepts extra fields, so it gets an `unknown` index signature (map root,
        // stamp zones). The v2 primitives are closed and stay exact.
        additionalProperties: true,
        // Keep short fixed-size arrays (colors, ranges, vectors) as tuples;
        // longer bounded lists (`rivals`, ≤ 6) become plain arrays.
        maxItems: 4,
        unreachableDefinitions: true,
        strictIndexSignatures: true,
        format: true,
        style: { singleQuote: true, tabWidth: 4, printWidth: 110 },
        cwd: path.join(ROOT, 'assets', 'schemas'),
    });
    // The schemas have no `$id`; name the source file instead of "undefined".
    return ts.replaceAll("referenced by `undefined`'s JSON-Schema", `referenced by ${file}`);
}

let stale = 0;
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const job of JOBS) {
    const ts = await generate(job);
    const outPath = path.join(OUT_DIR, job.out);
    const rel = path.relative(ROOT, outPath);
    const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;
    if (CHECK) {
        if (current !== ts) {
            console.error(`gen-schema-types: ${rel} is stale; run \`npm run gen:schema-types\``);
            stale++;
        }
    } else if (current !== ts) {
        fs.writeFileSync(outPath, ts);
        console.log(`gen-schema-types: wrote ${rel}`);
    } else {
        console.log(`gen-schema-types: ${rel} up to date`);
    }
}
if (stale) process.exit(1);
