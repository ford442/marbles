import assert from 'node:assert/strict';
import { buildImportedGlbStamp } from '../src/editor/glb-import.js';
import { createZoneFromStamp } from '../src/editor/stamps.js';
import { resolveAssetModelPath } from '../src/assets/model-paths.js';
import { validateMap } from '../src/editor/map-validator.js';
import { createEmptyMap, serializeMap, syncGoalsFromZones } from '../src/editor/map-document.js';

const FAKE_DATA_URL = 'data:model/gltf-binary;base64,Z2xURgAAAAA=';

function testBuildImportedGlbStamp() {
    const stamp = buildImportedGlbStamp('My Track.glb', FAKE_DATA_URL, 1);
    assert.equal(stamp.id, 'imported_1');
    assert.equal(stamp.label, 'My Track');
    assert.equal(stamp.type, 'model');
    assert.equal(stamp.defaults.model, FAKE_DATA_URL);
    assert.equal(stamp.defaults.collider, 'trimesh');
}

function testRejectsNonGlb() {
    assert.throws(() => buildImportedGlbStamp('scene.gltf', FAKE_DATA_URL, 1), /Only \.glb files/);
}

function testImportedStampPlacesIntoMap() {
    const stamp = buildImportedGlbStamp('ramp.glb', FAKE_DATA_URL, 7);
    const zone = createZoneFromStamp(stamp, { x: 1, y: 2, z: 3 });
    assert.equal(zone.type, 'model');
    assert.equal(zone.model, FAKE_DATA_URL);
    assert.equal(zone.collider, 'trimesh');

    const map = createEmptyMap();
    map.zones.push(zone);
    syncGoalsFromZones(map);
    const result = validateMap(serializeMap(map));
    assert.equal(result.valid, true, result.errors.join('; '));
}

function testResolveAssetModelPathPassesThroughDataAndBlobUrls() {
    assert.equal(resolveAssetModelPath(FAKE_DATA_URL), FAKE_DATA_URL);
    const blobUrl = 'blob:http://localhost:5173/abc-123';
    assert.equal(resolveAssetModelPath(blobUrl), blobUrl);
}

testBuildImportedGlbStamp();
testRejectsNonGlb();
testImportedStampPlacesIntoMap();
testResolveAssetModelPathPassesThroughDataAndBlobUrls();
console.log('GLB import tests passed');
