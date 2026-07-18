import assert from 'node:assert/strict';
import {
    DECORATIVE_PRIMITIVES,
    DECORATIVE_VERTEX_STRIDE,
    DECORATIVE_PRIMITIVE_NAMES,
} from '../src/decorative-primitives.js';
import {
    batchGeometry,
    batchBoxGeometry,
    computeMeshBatchBounds,
    computeBatchBounds,
} from '../src/gpu-instancing.js';
import { CUBE_VERTICES, CUBE_INDICES } from '../src/cube-geometry.js';

function testPrimitiveMeshesExist() {
    for (const name of DECORATIVE_PRIMITIVE_NAMES) {
        const mesh = DECORATIVE_PRIMITIVES[name];
        assert.ok(mesh.vertices.length > 0, `${name} should have vertices`);
        assert.ok(mesh.indices.length > 0, `${name} should have indices`);
        assert.equal(mesh.vertices.length % DECORATIVE_VERTEX_STRIDE, 0, `${name} stride alignment`);
        const maxIndex = Math.max(...mesh.indices);
        assert.ok(maxIndex < mesh.vertices.length / DECORATIVE_VERTEX_STRIDE, `${name} index range`);
    }
}

function testBatchGeometryInstances() {
    const mesh = DECORATIVE_PRIMITIVES.crystal;
    const instances = [
        { position: [0, 0, 0], scale: [1, 1, 1] },
        { position: [2, 1, -1], rotation: [0, 0.382683, 0, 0.92388], scale: [0.5, 1.5, 0.5] },
    ];
    const batch = batchGeometry(mesh.vertices, mesh.indices, instances, DECORATIVE_VERTEX_STRIDE);
    const expectedVerts = (mesh.vertices.length / DECORATIVE_VERTEX_STRIDE) * instances.length
    assert.equal(batch.vertices.length / DECORATIVE_VERTEX_STRIDE, expectedVerts);
    assert.equal(batch.indices.length, mesh.indices.length * instances.length);
    assert.equal(batch.count, 2);
}

function testBatchBoxGeometryStillWorks() {
    const instances = [
        { position: [0, 0, 0], scale: [2, 2, 2] },
        { position: [5, 0, 0], scale: [1, 1, 1] },
    ];
    const batch = batchBoxGeometry(CUBE_VERTICES, CUBE_INDICES, instances);
    assert.equal(batch.count, 2);
    assert.equal(batch.indices.length, CUBE_INDICES.length * 2);
}

function testMeshBatchBounds() {
    const mesh = DECORATIVE_PRIMITIVES.bumper;
    const instances = [{ position: [10, 0, 0], scale: [2, 2, 2] }];
    const bounds = computeMeshBatchBounds(mesh.vertices, mesh.indices, instances, DECORATIVE_VERTEX_STRIDE);
    assert.ok(bounds.center[0] > 9, 'bounds should follow instance position');
    assert.ok(bounds.halfExtent[0] >= 0.5);
}

function testUnitCubeBoundsFallback() {
    const bounds = computeBatchBounds([{ position: [0, 0, 0], scale: [4, 2, 6] }]);
    assert.ok(bounds.halfExtent[0] >= 1.9);
    assert.ok(bounds.halfExtent[1] >= 0.9);
    assert.ok(bounds.halfExtent[2] >= 2.9);
}

testPrimitiveMeshesExist();
testBatchGeometryInstances();
testBatchBoxGeometryStillWorks();
testMeshBatchBounds();
testUnitCubeBoundsFallback();
console.log('decorative primitive tests passed');
