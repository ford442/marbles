import { serializeMapJson } from './map-document.js';
import { resolveAssetModelPath } from '../assets/model-paths.js';

/**
 * Collect unique asset paths referenced by a map (models + LOD).
 * @param {import('../types/map.js').MapDefinition} map
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
 * @param {{ name: string, data: Uint8Array }[]} files
 */
function buildZip(files) {
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
 * @param {import('../types/map.js').MapDefinition} map
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
