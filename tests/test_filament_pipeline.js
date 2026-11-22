/**
 * The Filament runtime, the compiled materials and their sources must agree
 * (scripts/filament.json). No network and no matc needed: this checks what is
 * committed, so a half-done upgrade or an edited .mat without a rebuild fails
 * here. `npm run check:materials` does the full recompile-and-compare.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LOCK_PATH, ROOT, readMaterialHeader, readPin, sha256File } from '../scripts/filament-tools.mjs';

const pin = readPin();
const rel = (p) => path.join(ROOT, p);

// ── Runtime: public/filament.{js,wasm} are the pinned release ────────────────
for (const [file, { sha256 }] of Object.entries(pin.runtime)) {
    assert.equal(sha256File(rel(file)), sha256, `${file} is not the vendored Filament ${pin.version} runtime — run: npm run vendor:filament`);
}
assert.equal(pin.materialVersion, Number(pin.version.split('.')[1]), 'Filament 1.N.x emits material version N');

// ── Every shipped material was compiled for that runtime, from its current source ──
const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
assert.equal(lock.filament, pin.version, 'materials.lock.json was built for another Filament version — run: npm run build:materials');
assert.deepEqual(lock.matcFlags, pin.matcFlags, 'matc flags changed since the materials were built — run: npm run build:materials');
const shipped = pin.materials.filter((m) => m.output);
assert.ok(shipped.length >= 2, 'the game loads at least baked_color and baked_procedural');
assert.deepEqual(Object.keys(lock.outputs).sort(), shipped.map((m) => m.output).sort(), 'materials.lock.json lists exactly the shipped materials');
for (const { source, output } of shipped) {
    const header = readMaterialHeader(fs.readFileSync(rel(output)));
    assert.equal(header.version, pin.materialVersion, `${output} is material version ${header.version}; the Filament ${pin.version} runtime only loads version ${pin.materialVersion} — run: npm run build:materials`);
    const entry = lock.outputs[output];
    assert.equal(entry.source, source);
    assert.equal(sha256File(rel(source)), entry.sourceSha256, `${source} changed since ${output} was compiled — run: npm run build:materials`);
    assert.equal(sha256File(rel(output)), entry.sha256, `${output} is not the binary recorded in materials.lock.json — run: npm run build:materials`);
}

// ── Every .mat in public/ is accounted for ───────────────────────────────────
const listed = new Set([...pin.materials.map((m) => m.source), ...Object.keys(pin.notMaterials)]);
for (const file of fs.readdirSync(rel('public')).filter((f) => f.endsWith('.mat'))) {
    assert.ok(listed.has(`public/${file}`), `public/${file} is not listed in scripts/filament.json (materials or notMaterials)`);
}
for (const source of listed) assert.ok(fs.existsSync(rel(source)), `${source} is listed in scripts/filament.json but missing`);

// ── The game loads the files the pipeline produces ───────────────────────────
const assetsSrc = fs.readFileSync(rel('src/zone-setup/assets.ts'), 'utf8');
for (const { output } of shipped) {
    assert.ok(assetsSrc.includes(path.basename(output)), `src/zone-setup/assets.ts no longer loads ${path.basename(output)}`);
}

// ── Uniform names: Filament aborts (it does not throw) on an unknown one ─────
// Every literal parameter name set anywhere in src/ must exist in the
// procedural material, and the two every material instance gets must exist
// in the simple one.
const paramsOf = (source) => {
    const block = fs.readFileSync(rel(source), 'utf8').match(/parameters\s*:\s*\[([\s\S]*?)\]/);
    return new Set([...(block?.[1] ?? '').matchAll(/name\s*:\s*(\w+)/g)].map((m) => m[1]));
};
const procedural = paramsOf('public/custom_material_procedural.mat');
const simple = paramsOf('public/custom_material.mat');
assert.deepEqual([...simple].sort(), ['baseColor', 'roughness']);
for (const name of simple) assert.ok(procedural.has(name), `the procedural material lacks "${name}", which every instance sets`);
const SETTER = /\.set(?:Float\d?|Color[34]|Bool|Int|Texture)Parameter\(\s*['"](\w+)['"]/g;
/** @param {string} dir */
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|js)$/.test(e.name) ? [path.join(dir, e.name)] : []
));
let checked = 0;
for (const file of walk(rel('src'))) {
    for (const [, name] of fs.readFileSync(file, 'utf8').matchAll(SETTER)) {
        checked++;
        assert.ok(procedural.has(name), `${path.relative(ROOT, file)} sets material parameter "${name}", which custom_material_procedural.mat does not declare`);
    }
}
assert.ok(checked > 50, `expected to find the material parameter setters in src/ (found ${checked})`);

console.log(`Filament pipeline: runtime ${pin.version}, ${shipped.length} shipped materials at version ${pin.materialVersion}, ${checked} parameter setters checked`);
