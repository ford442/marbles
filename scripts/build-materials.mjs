#!/usr/bin/env node
// @ts-check
/**
 * Compile every Filament material with the `matc` of the pinned release.
 *
 *   npm run build:materials            # recompile all materials, rewrite scripts/materials.lock.json
 *   npm run build:materials -- --check # recompile to a temp dir and compare with the committed binaries
 *
 * Materials and matc flags are listed in scripts/filament.json. Entries with
 * an `output` are the binaries the game loads; entries without one are
 * compiled and thrown away, so a source that stops building is noticed.
 *
 * `matc` comes from the pinned release (downloaded and checksum-verified on
 * first use) or from `$MATC`; either way it must emit the material version
 * the vendored runtime loads.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
    LOCK_PATH, ROOT, readMaterialHeader, readPin, resolveMatc, sha256File, tempDir,
} from './filament-tools.mjs';

const CHECK = process.argv.includes('--check');
const pin = readPin();
const matc = await resolveMatc(pin);
const scratch = tempDir('materials-');
console.log(`matc ${path.relative(ROOT, matc)} (material version ${pin.materialVersion}, Filament ${pin.version}), flags: ${pin.matcFlags.join(' ')}`);

/** @type {Record<string, { source: string, sourceSha256: string, sha256: string, bytes: number }>} */
const outputs = {};
let failed = 0;
let stale = 0;

for (const entry of pin.materials) {
    const source = path.join(ROOT, entry.source);
    const target = entry.output ? path.join(ROOT, entry.output) : null;
    const built = path.join(scratch, `${path.basename(entry.source)}.filamat`);
    const run = spawnSync(matc, [...pin.matcFlags, '-o', built, source], { encoding: 'utf8' });
    if (run.status !== 0 || !fs.existsSync(built)) {
        failed++;
        console.error(`✗ ${entry.source}\n${`${run.stdout}${run.stderr}`.trim().replace(/^/gm, '    ')}`);
        continue;
    }
    const header = readMaterialHeader(fs.readFileSync(built));
    if (header.version !== pin.materialVersion) {
        failed++;
        console.error(`✗ ${entry.source}: compiled as material version ${header.version}, expected ${pin.materialVersion}`);
        continue;
    }
    const bytes = fs.statSync(built).size;
    if (!entry.output || !target) {
        console.log(`✓ ${entry.source} compiles (${bytes} bytes, not shipped: ${entry.note ?? 'no output'})`);
        continue;
    }
    outputs[entry.output] = { source: entry.source, sourceSha256: sha256File(source), sha256: sha256File(built), bytes };
    if (CHECK) {
        const same = fs.existsSync(target) && sha256File(target) === outputs[entry.output]?.sha256;
        if (!same) stale++;
        console.log(`${same ? '✓' : '✗'} ${entry.output} ${same ? 'matches' : 'differs from'} a fresh build of ${entry.source}`);
    } else {
        fs.copyFileSync(built, target);
        console.log(`✓ ${entry.source} → ${entry.output} (${bytes} bytes, "${header.name}")`);
    }
}

if (failed) {
    console.error(`${failed} material(s) failed to compile.`);
    process.exit(1);
}
const lock = `${JSON.stringify({ filament: pin.version, materialVersion: pin.materialVersion, matcFlags: pin.matcFlags, outputs }, null, 2)}\n`;
if (CHECK) {
    if (!fs.existsSync(LOCK_PATH) || fs.readFileSync(LOCK_PATH, 'utf8') !== lock) {
        stale++;
        console.error('✗ scripts/materials.lock.json is out of date');
    }
    if (stale) {
        console.error('Committed materials do not match their sources. Run: npm run build:materials');
        process.exit(1);
    }
    console.log('✓ committed materials match a fresh build');
} else {
    fs.writeFileSync(LOCK_PATH, lock);
    console.log(`✓ ${Object.keys(outputs).length} shipped material(s) rebuilt; wrote scripts/materials.lock.json`);
}
