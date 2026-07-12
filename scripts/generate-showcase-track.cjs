#!/usr/bin/env node
/**
 * Generates assets/tracks/neon_showcase.glb — a sloped channel ramp for the art-pipeline showcase.
 * Also writes a lower-poly LOD variant (neon_showcase_lod1.glb).
 *
 * Run: node scripts/generate-showcase-track.cjs
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'tracks');

function boxTriangles(cx, cy, cz, hx, hy, hz) {
    const x0 = cx - hx; const x1 = cx + hx;
    const y0 = cy - hy; const y1 = cy + hy;
    const z0 = cz - hz; const z1 = cz + hz;
    const corners = [
        [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
        [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    const faces = [
        [0, 1, 2, 3], [4, 5, 6, 7], [0, 4, 7, 3],
        [1, 5, 6, 2], [3, 2, 6, 7], [0, 1, 5, 4],
    ];
    const positions = [];
    const indices = [];
    let base = 0;
    for (const face of faces) {
        const a = corners[face[0]];
        const b = corners[face[1]];
        const c = corners[face[2]];
        const d = corners[face[3]];
        positions.push(
            ...a, ...b, ...c,
            ...a, ...c, ...d
        );
        indices.push(base, base + 1, base + 2, base + 3, base + 4, base + 5);
        base += 6;
    }
    return { positions, indices };
}

function mergeParts(parts) {
    const positions = [];
    const indices = [];
    let vertexBase = 0;
    for (const part of parts) {
        positions.push(...part.positions);
        for (const idx of part.indices) indices.push(idx + vertexBase);
        vertexBase += part.positions.length / 3;
    }
    return {
        positions: new Float32Array(positions),
        indices: new Uint32Array(indices),
    };
}

function buildTrackMesh(lowPoly = false) {
    const pitch = 0.12;
    const length = lowPoly ? 20 : 30;
    const width = lowPoly ? 5 : 6;
    const wallH = lowPoly ? 0.8 : 1.2;
    const floorT = 0.35;
    const wallT = lowPoly ? 0.3 : 0.4;

    const parts = [];
    const cz = 0;
    const cy = Math.sin(pitch) * (length * 0.5);

    parts.push(boxTriangles(0, cy, cz, width * 0.5, floorT * 0.5, length * 0.5));
    parts.push(boxTriangles(-width * 0.5 - wallT * 0.5, cy + wallH * 0.5, cz, wallT * 0.5, wallH * 0.5, length * 0.5));
    parts.push(boxTriangles(width * 0.5 + wallT * 0.5, cy + wallH * 0.5, cz, wallT * 0.5, wallH * 0.5, length * 0.5));

    const merged = mergeParts(parts);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    for (let i = 0; i < merged.positions.length; i += 3) {
        const x = merged.positions[i];
        const y = merged.positions[i + 1];
        const z = merged.positions[i + 2];
        merged.positions[i] = x;
        merged.positions[i + 1] = y * cosP - z * sinP;
        merged.positions[i + 2] = y * sinP + z * cosP;
    }
    return merged;
}

function writeGlb(outPath, positions, indices, name = 'track') {
    const posBytes = Buffer.from(posBytesFromFloat32(positions));
    const idxBytes = Buffer.from(idxBytesFromUint32(indices));
    const bin = Buffer.concat([posBytes, idxBytes]);

    const gltf = {
        asset: { version: '2.0', generator: 'marbles-generate-showcase-track' },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [{ mesh: 0, name }],
        meshes: [{
            name,
            primitives: [{
                attributes: { POSITION: 0 },
                indices: 1,
                mode: 4,
            }],
        }],
        accessors: [
            {
                bufferView: 0,
                componentType: 5126,
                count: positions.length / 3,
                type: 'VEC3',
                min: [minAxis(positions, 0), minAxis(positions, 1), minAxis(positions, 2)],
                max: [maxAxis(positions, 0), maxAxis(positions, 1), maxAxis(positions, 2)],
            },
            {
                bufferView: 1,
                componentType: 5125,
                count: indices.length,
                type: 'SCALAR',
            },
        ],
        bufferViews: [
            { buffer: 0, byteOffset: 0, byteLength: posBytes.length },
            { buffer: 0, byteOffset: posBytes.length, byteLength: idxBytes.length },
        ],
        buffers: [{ byteLength: bin.length }],
    };

    const jsonChunk = Buffer.from(JSON.stringify(gltf));
    const jsonPad = (4 - (jsonChunk.length % 4)) % 4;
    const jsonPadded = Buffer.concat([jsonChunk, Buffer.alloc(jsonPad, 0x20)]);

    const binPad = (4 - (bin.length % 4)) % 4;
    const binPadded = Buffer.concat([bin, Buffer.alloc(binPad)]);

    const totalLength = 12 + 8 + jsonPadded.length + 8 + binPadded.length;
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(totalLength, 8);

    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(jsonPadded.length, 0);
    jsonHeader.writeUInt32LE(0x4e4f534a, 4);

    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binPadded.length, 0);
    binHeader.writeUInt32LE(0x004e4942, 4);

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binPadded]));
}

function posBytesFromFloat32(arr) {
    const buf = Buffer.alloc(arr.length * 4);
    for (let i = 0; i < arr.length; i++) buf.writeFloatLE(arr[i], i * 4);
    return buf;
}

function idxBytesFromUint32(arr) {
    const buf = Buffer.alloc(arr.length * 4);
    for (let i = 0; i < arr.length; i++) buf.writeUInt32LE(arr[i], i * 4);
    return buf;
}

function minAxis(arr, axis) {
    let m = Infinity;
    for (let i = axis; i < arr.length; i += 3) m = Math.min(m, arr[i]);
    return m;
}

function maxAxis(arr, axis) {
    let m = -Infinity;
    for (let i = axis; i < arr.length; i += 3) m = Math.max(m, arr[i]);
    return m;
}

const hi = buildTrackMesh(false);
const lo = buildTrackMesh(true);

writeGlb(path.join(OUT_DIR, 'neon_showcase.glb'), hi.positions, hi.indices, 'neon_showcase');
writeGlb(path.join(OUT_DIR, 'neon_showcase_lod1.glb'), lo.positions, lo.indices, 'neon_showcase_lod1');

console.log(`Wrote ${OUT_DIR}/neon_showcase.glb (${hi.indices.length / 3} triangles)`);
console.log(`Wrote ${OUT_DIR}/neon_showcase_lod1.glb (${lo.indices.length / 3} triangles)`);
