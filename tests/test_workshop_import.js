import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
};

const {
    buildZip,
    parseWorkshopZip,
    importWorkshopPackage,
    publishWorkshopLevel,
    collectMapAssetPaths,
} = await import('../src/editor/workshop-export.js');
const { createEmptyMap, serializeMap, syncGoalsFromZones } = await import('../src/editor/map-document.js');
const { createZoneFromStamp, STAMP_BY_ID } = await import('../src/editor/stamps.js');
const {
    listWorkshopLevels,
    saveWorkshopLevel,
    getWorkshopLevel,
    deleteWorkshopLevel,
    WORKSHOP_STORAGE_KEY,
} = await import('../src/levels/workshop-store.js');
const { CLOUD_OPT_IN_KEY, DEVICE_ID_KEY, setCloudOptIn } = await import('../src/game/network/cloud-client.ts');

function resetStorage() {
    storage.clear();
}

function testZipRoundTrip() {
    resetStorage();
    const files = [
        { name: 'map.json', data: new TextEncoder().encode(JSON.stringify({ hello: 'world' })) },
        { name: 'assets/tracks/foo.glb', data: new Uint8Array([1, 2, 3, 4, 5]) },
    ];
    const zip = buildZip(files);
    const entries = parseWorkshopZip(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength));

    assert.equal(entries.length, 2);
    const mapEntry = entries.find((e) => e.name === 'map.json');
    assert.equal(new TextDecoder().decode(mapEntry.data), JSON.stringify({ hello: 'world' }));
    const glbEntry = entries.find((e) => e.name === 'assets/tracks/foo.glb');
    assert.deepEqual([...glbEntry.data], [1, 2, 3, 4, 5]);
}

async function testImportPlainJson() {
    resetStorage();
    const map = createEmptyMap();
    map.id = 'plain_import_test';
    syncGoalsFromZones(map);
    const json = JSON.stringify(serializeMap(map));

    const { mapDef, assetCount } = await importWorkshopPackage(json);
    assert.equal(mapDef.id, 'plain_import_test');
    assert.equal(assetCount, 0);
}

async function testImportZipInlinesAssets() {
    resetStorage();
    const map = createEmptyMap();
    map.id = 'zip_import_test';
    map.zones.push(createZoneFromStamp(STAMP_BY_ID.model_neon_showcase, { x: 0, y: 0, z: 0 }));
    syncGoalsFromZones(map);
    const payload = serializeMap(map);

    const glbBytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 1, 2, 3, 4]);
    const zip = buildZip([
        { name: `${map.id}.json`, data: new TextEncoder().encode(JSON.stringify(payload)) },
        { name: 'README.txt', data: new TextEncoder().encode('readme') },
        { name: 'assets/tracks/neon_showcase.glb', data: glbBytes },
    ]);

    const { mapDef, assetCount } = await importWorkshopPackage(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength));
    assert.equal(mapDef.id, 'zip_import_test');
    assert.equal(assetCount, 1);

    const modelZone = mapDef.zones.find((z) => z.type === 'model');
    assert.ok(modelZone.model.startsWith('data:model/gltf-binary;base64,'));

    // Round-trips: collectMapAssetPaths should still see the (now data:) model ref as a path-like string.
    assert.ok(collectMapAssetPaths(mapDef)[0].startsWith('data:'));
}

function testWorkshopStoreCrud() {
    resetStorage();
    const map = createEmptyMap();
    map.id = 'community_test_map';
    map.name = 'Community Test Map';

    assert.deepEqual(listWorkshopLevels(), []);
    saveWorkshopLevel(map);
    assert.equal(listWorkshopLevels().length, 1);
    assert.equal(getWorkshopLevel('community_test_map').name, 'Community Test Map');

    // Re-saving the same id replaces rather than duplicates.
    map.name = 'Renamed';
    saveWorkshopLevel(map);
    assert.equal(listWorkshopLevels().length, 1);
    assert.equal(getWorkshopLevel('community_test_map').name, 'Renamed');

    deleteWorkshopLevel('community_test_map');
    assert.equal(listWorkshopLevels().length, 0);
    assert.equal(storage.has(WORKSHOP_STORAGE_KEY), true);
}

async function testPublishRequiresCloudOptIn() {
    resetStorage();
    globalThis.__MARbles_TEST_API_URL__ = '';
    const map = createEmptyMap();
    await assert.rejects(() => publishWorkshopLevel(serializeMap(map)), /opt-in/);
}

async function testPublishPostsToConfiguredApi() {
    resetStorage();
    globalThis.__MARbles_TEST_API_URL__ = 'http://localhost:7860';
    storage.set(DEVICE_ID_KEY, '11111111-2222-4333-8444-555555555555');
    setCloudOptIn(true);
    assert.equal(storage.get(CLOUD_OPT_IN_KEY), '1');

    let capturedBody = null;
    globalThis.fetch = async (url, options) => {
        capturedBody = JSON.parse(options.body);
        assert.equal(url, 'http://localhost:7860/v1/marbles/workshop');
        assert.equal(options.headers.Authorization, 'Bearer 11111111-2222-4333-8444-555555555555');
        return { ok: true, json: async () => ({ id: 'abc123', shareUrl: 'http://localhost:7860/w/abc123' }) };
    };

    const map = createEmptyMap();
    const result = await publishWorkshopLevel(serializeMap(map));
    assert.equal(result.id, 'abc123');
    assert.equal(result.shareUrl, 'http://localhost:7860/w/abc123');
    assert.ok(capturedBody.mapJson.includes('"zones"'));
}

testZipRoundTrip();
await testImportPlainJson();
await testImportZipInlinesAssets();
testWorkshopStoreCrud();
await testPublishRequiresCloudOptIn();
await testPublishPostsToConfiguredApi();
console.log('Workshop import/publish tests passed');
