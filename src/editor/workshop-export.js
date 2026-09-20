import { serializeMapJson, parseMapJson } from './map-document.js';
import { resolveAssetModelPath } from '../assets/model-paths.js';
import { getApiUrl, isCloudEnabled, getDeviceId } from '../game/network/cloud-client.ts';

/**
 * Collect unique asset paths referenced by a map (models + LOD).
 * @param {import('../types/map.ts').MapDefinition} map
 * @returns {string[]}
 */
export function collectMapAssetPaths(map) {
    const paths = new Set();
    for (const zone of map.zones) {
        if (zone.model) paths.add(zone.model.replace(/^assets\//, ''));
        if (zone.lod) {
            for (const level of zone.lod) {
                if (level.model) paths.add(level.model.replace(/^assets\//, ''));
            }
        }
    }
    return [...paths];
}

/**
 * CRC32 for ZIP entries (browser-safe).
 * @param {Uint8Array} data
 */
function crc32(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Build a minimal ZIP archive (store method, no compression).
 * Exported for tests that round-trip through parseWorkshopZip().
 * @param {{ name: string, data: Uint8Array }[]} files
 */
export function buildZip(files) {
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const file of files) {
        const nameBytes = new TextEncoder().encode(file.name);
        const crc = crc32(file.data);
        const local = new Uint8Array(30 + nameBytes.length + file.data.length);
        const view = new DataView(local.buffer);
        view.setUint32(0, 0x04034b50, true);
        view.setUint16(8, 0, true);
        view.setUint32(14, crc, true);
        view.setUint32(18, file.data.length, true);
        view.setUint32(22, file.data.length, true);
        view.setUint16(26, nameBytes.length, true);
        local.set(nameBytes, 30);
        local.set(file.data, 30 + nameBytes.length);
        chunks.push(local);

        const cd = new Uint8Array(46 + nameBytes.length);
        const cdView = new DataView(cd.buffer);
        cdView.setUint32(0, 0x02014b50, true);
        cdView.setUint16(8, 0, true);
        cdView.setUint32(16, crc, true);
        cdView.setUint32(20, file.data.length, true);
        cdView.setUint32(24, file.data.length, true);
        cdView.setUint16(28, nameBytes.length, true);
        cdView.setUint32(42, offset, true);
        cd.set(nameBytes, 46);
        central.push(cd);
        offset += local.length;
    }

    const centralSize = central.reduce((s, c) => s + c.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);

    const total = new Uint8Array(offset + centralSize + 22);
    let pos = 0;
    for (const c of chunks) { total.set(c, pos); pos += c.length; }
    for (const c of central) { total.set(c, pos); pos += c.length; }
    total.set(end, pos);
    return total;
}

const README = `Marbles 3D Workshop Map Package
================================

1. Copy the JSON file to assets/maps/
2. Copy assets/ folder contents into your project assets/ directory
3. Register the map id in assets/manifest.json
4. Run: npm run validate:assets

`;

/**
 * Export map JSON + referenced GLB assets as a ZIP download.
 * @param {import('../types/map.ts').MapDefinition} map
 */
export async function downloadWorkshopZip(map) {
    const mapJson = serializeMapJson(map);
    const files = [
        {
            name: `${map.id || 'map'}.json`,
            data: new TextEncoder().encode(mapJson),
        },
        {
            name: 'README.txt',
            data: new TextEncoder().encode(README),
        },
    ];

    const assetPaths = collectMapAssetPaths(map);
    for (const assetPath of assetPaths) {
        const url = resolveAssetModelPath(assetPath);
        if (!url) continue;
        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const buffer = await response.arrayBuffer();
            files.push({
                name: `assets/${assetPath}`,
                data: new Uint8Array(buffer),
            });
        } catch {
            // Skip missing assets (playtest fallback tracks)
        }
    }

    const zip = buildZip(files);
    const blob = new Blob([zip], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${map.id || 'map'}_workshop.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
}

/**
 * Locate the end-of-central-directory record in a ZIP buffer.
 * @param {DataView} view
 * @param {number} length
 */
function findEndOfCentralDirectory(view, length) {
    for (let i = length - 22; i >= 0; i--) {
        if (view.getUint32(i, true) === 0x06054b50) return i;
    }
    throw new Error('Not a valid ZIP file (missing end-of-central-directory record)');
}

/**
 * Parse a ZIP archive built with the STORE (no compression) method — the
 * only method downloadWorkshopZip() ever produces. Deflate-compressed
 * entries are rejected rather than silently corrupted, since no inflate
 * implementation is bundled.
 * @param {ArrayBuffer | Uint8Array} buffer
 * @returns {{ name: string, data: Uint8Array }[]}
 */
export function parseWorkshopZip(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocd = findEndOfCentralDirectory(view, bytes.length);
    const entryCount = view.getUint16(eocd + 10, true);
    let pos = view.getUint32(eocd + 16, true);

    const entries = [];
    const decoder = new TextDecoder();
    for (let i = 0; i < entryCount; i++) {
        if (view.getUint32(pos, true) !== 0x02014b50) {
            throw new Error('Corrupt ZIP central directory record');
        }
        const method = view.getUint16(pos + 10, true);
        const compSize = view.getUint32(pos + 20, true);
        const uncompSize = view.getUint32(pos + 24, true);
        const nameLen = view.getUint16(pos + 28, true);
        const extraLen = view.getUint16(pos + 30, true);
        const commentLen = view.getUint16(pos + 32, true);
        const localOffset = view.getUint32(pos + 42, true);
        const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));

        if (method !== 0) {
            throw new Error(`Unsupported compression for "${name}" — only uncompressed workshop ZIPs are supported`);
        }

        const localNameLen = view.getUint16(localOffset + 26, true);
        const localExtraLen = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLen + localExtraLen;
        const size = compSize || uncompSize;
        entries.push({ name, data: bytes.slice(dataStart, dataStart + size) });

        pos += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
}

/**
 * @param {Uint8Array} bytes
 * @param {string} mimeType
 * @returns {string}
 */
function bytesToDataUrl(bytes, mimeType) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return `data:${mimeType};base64,${btoa(binary)}`;
}

/**
 * Import a map from a workshop package: either a plain level `.json` file
 * (no bundled assets) or a `.zip` produced by downloadWorkshopZip(). Bundled
 * GLB assets are inlined as data: URLs and zone.model/lod[].model refs are
 * rewritten to point at them, so the imported map is fully self-contained
 * and playable without copying any files into assets/.
 * @param {File | ArrayBuffer | string} input
 * @returns {Promise<{ mapDef: import('../types/map.ts').MapDefinition, assetCount: number }>}
 */
export async function importWorkshopPackage(input) {
    if (typeof input === 'string') {
        return { mapDef: parseMapJson(input), assetCount: 0 };
    }

    let buffer;
    let isZip;
    if (typeof File !== 'undefined' && input instanceof File) {
        isZip = input.name.toLowerCase().endsWith('.zip');
        buffer = isZip ? await input.arrayBuffer() : await input.text();
    } else {
        isZip = true;
        buffer = input;
    }

    if (!isZip) {
        return { mapDef: parseMapJson(/** @type {string} */ (buffer)), assetCount: 0 };
    }

    const entries = parseWorkshopZip(buffer);
    const jsonEntry = entries.find((e) => e.name.endsWith('.json') && !e.name.includes('/'));
    if (!jsonEntry) throw new Error('Workshop package is missing its level JSON');
    const mapDef = parseMapJson(new TextDecoder().decode(jsonEntry.data));

    const assetEntries = entries.filter((e) => e.name.startsWith('assets/'));
    const assetDataUrls = new Map();
    for (const entry of assetEntries) {
        const relPath = entry.name.replace(/^assets\//, '');
        const mime = relPath.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream';
        assetDataUrls.set(relPath, bytesToDataUrl(entry.data, mime));
    }

    const rewriteModelRef = (ref) => {
        if (!ref) return ref;
        const dataUrl = assetDataUrls.get(ref.replace(/^assets\//, ''));
        return dataUrl || ref;
    };
    for (const zone of mapDef.zones || []) {
        if (zone.model) zone.model = rewriteModelRef(zone.model);
        if (Array.isArray(zone.lod)) {
            for (const level of zone.lod) {
                if (level.model) level.model = rewriteModelRef(level.model);
            }
        }
    }

    return { mapDef, assetCount: assetEntries.length };
}

/**
 * Optionally publish a map to the cloud backend (when VITE_MARBLES_API_URL
 * is configured and the player has opted into cloud sync) and get back a
 * shareable id/URL that others can import with.
 * @param {import('../types/map.ts').MapDefinition} map
 * @returns {Promise<{ id: string, shareUrl: string }>}
 */
export async function publishWorkshopLevel(map) {
    if (!isCloudEnabled()) {
        throw new Error('Cloud publish requires cloud sync opt-in and VITE_MARBLES_API_URL to be configured');
    }
    const apiUrl = getApiUrl();
    const deviceId = getDeviceId();
    if (!deviceId) {
        throw new Error('No device id available for cloud publish');
    }

    const response = await fetch(`${apiUrl}/v1/marbles/workshop`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${deviceId}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mapJson: serializeMapJson(map) }),
    });
    if (!response.ok) {
        throw new Error(`Publish failed: HTTP ${response.status}`);
    }
    const data = await response.json();
    return { id: data.id, shareUrl: data.shareUrl };
}
