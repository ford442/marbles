// @ts-check
/**
 * Shared helpers for the pinned Filament release (scripts/filament.json):
 * download + checksum the release archives, find a matching `matc`, and read
 * the version stamped into a compiled material.
 *
 * Used by scripts/vendor-filament.mjs, scripts/build-materials.mjs and
 * tests/test_filament_pipeline.js.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PIN_PATH = path.join(ROOT, 'scripts', 'filament.json');
export const LOCK_PATH = path.join(ROOT, 'scripts', 'materials.lock.json');

/**
 * @typedef {{ source: string, output?: string, note?: string }} MaterialEntry
 * @typedef {{
 *   version: string, materialVersion: number, archiveUrl: string,
 *   archives: Record<string, { sha256: string }>,
 *   runtime: Record<string, { sha256: string }>,
 *   matcFlags: string[], materials: MaterialEntry[], notMaterials: Record<string, string>,
 * }} FilamentPin
 */

/** @returns {FilamentPin} */
export function readPin() {
    return JSON.parse(fs.readFileSync(PIN_PATH, 'utf8'));
}

/** @param {string | Uint8Array} data */
export function sha256(data) {
    return createHash('sha256').update(data).digest('hex');
}

/** @param {string} file */
export function sha256File(file) {
    return sha256(fs.readFileSync(file));
}

/** Where downloaded archives and the extracted matc live (ignored by git). */
export function toolsDir(pin = readPin()) {
    return process.env.FILAMENT_TOOLS_DIR
        ? path.resolve(process.env.FILAMENT_TOOLS_DIR)
        : path.join(ROOT, 'node_modules', '.cache', 'filament', pin.version);
}

/** The release archive that carries `matc` for this machine. */
export function hostPlatform() {
    if (process.platform === 'linux' && process.arch === 'x64') return 'linux';
    if (process.platform === 'darwin') return 'mac';
    throw new Error(
        `Filament publishes matc for Linux x64 and macOS only (this is ${process.platform}/${process.arch}). `
        + 'Build it from source for the pinned version and point MATC at the binary.',
    );
}

/**
 * Download `url` to `dest`. Node's fetch first; `curl` as a fallback, since
 * it honours proxy settings that fetch does not.
 * @param {string} url
 * @param {string} dest
 */
async function download(url, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const tmp = `${dest}.part`;
    try {
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fs.writeFileSync(tmp, new Uint8Array(await res.arrayBuffer()));
    } catch (err) {
        const curl = spawnSync('curl', ['-fsSL', '--retry', '3', '-o', tmp, url], { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
        if (curl.status !== 0) {
            const reason = err instanceof Error ? err.message : String(err);
            throw new Error(`could not download ${url}: fetch failed (${reason}); curl ${curl.error ? curl.error.message : `exited ${curl.status}: ${curl.stderr.trim()}`}`);
        }
    }
    fs.renameSync(tmp, dest);
}

/**
 * Path of the pinned release archive for `platform`, downloading it if
 * needed. Throws when the bytes do not match the pinned checksum.
 * @param {string} platform `web`, `linux` or `mac`
 * @param {FilamentPin} [pin]
 */
export async function fetchArchive(platform, pin = readPin()) {
    const expected = pin.archives[platform]?.sha256;
    if (!expected) throw new Error(`scripts/filament.json pins no "${platform}" archive`);
    const name = `filament-v${pin.version}-${platform}.tgz`;
    const dest = path.join(toolsDir(pin), name);
    if (!fs.existsSync(dest) || sha256File(dest) !== expected) {
        const url = pin.archiveUrl.replaceAll('{version}', pin.version).replaceAll('{platform}', platform);
        console.log(`  downloading ${url}`);
        await download(url, dest);
    }
    const actual = sha256File(dest);
    if (actual !== expected) {
        fs.rmSync(dest, { force: true });
        throw new Error(`${name}: sha256 ${actual} does not match the pinned ${expected}`);
    }
    return dest;
}

/**
 * Extract `members` of a .tgz into `dir` (system tar).
 * @param {string} archive
 * @param {string} dir
 * @param {string[]} members
 */
export function extract(archive, dir, members) {
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('tar', ['-xzf', archive, '-C', dir, ...members], { stdio: ['ignore', 'ignore', 'inherit'] });
}

/** `matc --version` prints the material version it emits. @param {string} matc */
export function matcMaterialVersion(matc) {
    const out = spawnSync(matc, ['--version'], { encoding: 'utf8' });
    if (out.error) throw new Error(`cannot run ${matc}: ${out.error.message}`);
    return Number(String(out.stdout).trim());
}

/**
 * A `matc` that emits the pinned material version: `$MATC` when set,
 * otherwise the one from the pinned release (downloaded on first use).
 * @param {FilamentPin} [pin]
 */
export async function resolveMatc(pin = readPin()) {
    let matc = process.env.MATC;
    if (!matc) {
        const dir = path.join(toolsDir(pin), hostPlatform());
        matc = path.join(dir, 'filament', 'bin', 'matc');
        if (!fs.existsSync(matc)) extract(await fetchArchive(hostPlatform(), pin), dir, ['filament/bin/matc']);
    }
    const version = matcMaterialVersion(matc);
    if (version !== pin.materialVersion) {
        throw new Error(
            `${matc} emits material version ${version}, but the pinned runtime (Filament ${pin.version}) loads only version ${pin.materialVersion}. `
            + 'Unset MATC to use the pinned release, or update scripts/filament.json and re-vendor the runtime.',
        );
    }
    return matc;
}

/**
 * Header fields of a compiled material package: chunks are
 * [8-byte tag][u32 size][payload]; `MAT_VERS` and `MAT_NAME` come first.
 * @param {Uint8Array} bytes
 * @returns {{ version: number | null, name: string | null }}
 */
export function readMaterialHeader(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const info = { version: /** @type {number | null} */ (null), name: /** @type {string | null} */ (null) };
    let offset = 0;
    for (let i = 0; i < 64 && offset + 12 <= bytes.byteLength; i++) {
        // Tags are stored little-endian, so "MAT_VERS" reads "SREV_TAM".
        const tag = Buffer.from(bytes.subarray(offset, offset + 8)).reverse().toString('latin1');
        const size = view.getUint32(offset + 8, true);
        const body = offset + 12;
        if (body + size > bytes.byteLength) break;
        if (tag === 'MAT_VERS') info.version = view.getUint32(body, true);
        if (tag === 'MAT_NAME') info.name = Buffer.from(bytes.subarray(body, body + size)).toString('utf8').replace(/\0.*$/s, '');
        if (info.version != null && info.name != null) break;
        offset = body + size;
    }
    return info;
}

/** Scratch directory removed on exit. @param {string} prefix */
export function tempDir(prefix) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}
