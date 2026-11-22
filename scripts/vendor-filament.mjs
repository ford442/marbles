#!/usr/bin/env node
// @ts-check
/**
 * Vendor the pinned Filament web runtime into public/.
 *
 *   npm run vendor:filament            # write public/filament.{js,wasm}, record their checksums
 *   npm run vendor:filament -- --check # verify the committed files against the pin (no writes)
 *
 * The npm `filament` package stopped at 1.53.4, so the runtime comes from the
 * official GitHub release named in scripts/filament.json (checksum-pinned).
 * filament.js gets one local patch: a clear error when WebGL 2 is missing.
 * After changing the version, run `npm run build:materials`: compiled
 * materials only load on the runtime version that compiled them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PIN_PATH, ROOT, extract, fetchArchive, readPin, sha256, sha256File, tempDir } from './filament-tools.mjs';

const CHECK = process.argv.includes('--check');
const pin = readPin();

/** Upstream leaves `ctx` unchecked, so a missing WebGL 2 context surfaces as an opaque TypeError. */
const PATCH_ANCHOR = '        const ctx = canvas.getContext("webgl2", options);\n';
const PATCH = `${PATCH_ANCHOR}        if (!ctx) {
            throw new Error("WebGL 2.0 is not supported or failed to initialize in this browser.");
        }

`;

/** @param {string} js */
function patchRuntime(js) {
    if (js.split(PATCH_ANCHOR).length !== 2 || !js.includes(`${PATCH_ANCHOR}\n`)) {
        throw new Error('filament.js no longer contains the WebGL 2 context line this script patches; update PATCH_ANCHOR in scripts/vendor-filament.mjs');
    }
    return js.replace(`${PATCH_ANCHOR}\n`, PATCH);
}

if (CHECK) {
    let bad = 0;
    for (const [file, { sha256: expected }] of Object.entries(pin.runtime)) {
        const actual = sha256File(path.join(ROOT, file));
        if (actual !== expected) { bad++; console.error(`✗ ${file}: sha256 ${actual}, pinned ${expected}`); }
    }
    if (bad) {
        console.error(`The committed runtime is not Filament ${pin.version} as vendored. Run: npm run vendor:filament`);
        process.exit(1);
    }
    console.log(`✓ public/filament.{js,wasm} match the pinned Filament ${pin.version} runtime`);
} else {
    console.log(`Vendoring Filament ${pin.version} web runtime`);
    const dir = tempDir('filament-web-');
    extract(await fetchArchive('web', pin), dir, ['filament.js', 'filament.wasm', 'filament.d.ts']);
    const js = patchRuntime(fs.readFileSync(path.join(dir, 'filament.js'), 'utf8'));
    fs.writeFileSync(path.join(ROOT, 'public', 'filament.js'), js);
    fs.copyFileSync(path.join(dir, 'filament.wasm'), path.join(ROOT, 'public', 'filament.wasm'));
    // Upstream typings, kept as API reference (the game types Filament through src/types/filament.ts).
    fs.mkdirSync(path.join(ROOT, 'docs', 'reference'), { recursive: true });
    fs.writeFileSync(
        path.join(ROOT, 'docs', 'reference', 'filament.d.ts'),
        `// Filament ${pin.version} web typings, copied from the release by scripts/vendor-filament.mjs. Reference only.\n${fs.readFileSync(path.join(dir, 'filament.d.ts'), 'utf8')}`,
    );
    pin.runtime['public/filament.js'].sha256 = sha256(js);
    pin.runtime['public/filament.wasm'].sha256 = sha256File(path.join(ROOT, 'public', 'filament.wasm'));
    fs.writeFileSync(PIN_PATH, `${JSON.stringify(pin, null, 2)}\n`);
    console.log('✓ wrote public/filament.js (patched), public/filament.wasm, docs/reference/filament.d.ts');
    console.log('  Next: npm run build:materials');
}
