import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAssetModelPath, modelBasePath } from '../src/assets/model-paths.js';
import {
    parseGlbMeshes,
    mergeMeshes,
    transformPositions,
    computeMeshBounds,
} from '../src/assets/glb-mesh-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const showcaseGlb = path.join(root, 'assets/tracks/neon_showcase.glb');

function testResolveAssetModelPath() {
    assert.equal(resolveAssetModelPath('tracks/foo.glb'), 'assets/tracks/foo.glb');
    assert.equal(resolveAssetModelPath('assets/tracks/foo.glb'), 'assets/tracks/foo.glb');
    assert.equal(resolveAssetModelPath('/abs/model.glb'), '/abs/model.glb');
    assert.equal(resolveAssetModelPath(null), null);
}

function testModelBasePath() {
    globalThis.document = { location: 'http://localhost:5173/' };
    assert.equal(modelBasePath('assets/tracks/foo.glb'), 'assets/tracks/');
}

function testParseShowcaseGlb() {
    assert.ok(fs.existsSync(showcaseGlb), 'run node scripts/generate-showcase-track.cjs first');
    const data = fs.readFileSync(showcaseGlb);
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const meshes = parseGlbMeshes(buffer);
    assert.ok(meshes.length >= 1);
    assert.ok(meshes[0].positions.length >= 9);
    assert.ok(meshes[0].indices.length >= 3);

    const merged = mergeMeshes(meshes);
    assert.equal(merged.positions.length % 3, 0);
    assert.equal(merged.indices.length % 3, 0);

    const scaled = transformPositions(merged.positions, 2, Math.PI / 4);
    assert.equal(scaled.length, merged.positions.length);

    const bounds = computeMeshBounds(merged.positions);
    assert.ok(bounds.radius > 0);
    assert.ok(bounds.halfExtent[0] > 0);
}

testResolveAssetModelPath();
testModelBasePath();
testParseShowcaseGlb();
console.log('GLB track pipeline tests passed');
