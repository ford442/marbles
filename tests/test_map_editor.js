import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    MapDocument,
    createEmptyMap,
    serializeMap,
    syncGoalsFromZones,
    syncCheckpointsFromZones,
    parseMapJson,
    serializeMapJson,
} from '../src/editor/map-document.js';
import {
    cmdDeleteZones,
    cmdMoveZones,
    cmdPlaceZone,
    cmdRotateZones,
} from '../src/editor/map-commands.js';
import { validateMap } from '../src/editor/map-validator.js';
import { createZoneFromStamp, STAMP_BY_ID } from '../src/editor/stamps.js';
import { mapDefToLevel } from '../src/editor/map-document.js';
import { roundTripSession } from '../src/editor/editor-session.js';
import {
    snapPosition,
    snapRotation,
    snapScalar,
    rotationStepRad,
} from '../src/editor/snap.js';
import { collectMapAssetPaths } from '../src/editor/workshop-export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function testEmptyMapValidates() {
    const map = createEmptyMap();
    syncGoalsFromZones(map);
    const payload = serializeMap(map);
    const result = validateMap(payload);
    assert.equal(result.valid, true, result.errors.join('; '));
}

function testBuildSimpleMapExport() {
    const map = createEmptyMap();
    map.id = 'editor_test_ramp';
    map.name = 'Editor Test Ramp';
    map.zones.push(createZoneFromStamp(STAMP_BY_ID.track, { x: 0, y: 3, z: 5 }));
    map.zones.push(createZoneFromStamp(STAMP_BY_ID.goal, { x: 0, y: 0.25, z: 20 }));
    syncGoalsFromZones(map);

    const json = serializeMapJson(map);
    const roundTrip = parseMapJson(json);
    assert.equal(roundTrip.zones.length, 3);
    assert.equal(roundTrip.goals.length, 1);

    const validation = validateMap(roundTrip);
    assert.equal(validation.valid, true, validation.errors.join('; '));

    const level = mapDefToLevel(roundTrip);
    assert.equal(level.source, 'editor');
    assert.ok(level.zones.length >= 3);
}

function testRotYFloorExport() {
    const map = createEmptyMap();
    map.zones[0].rotY = 0.5;
    const result = validateMap(serializeMap(map));
    assert.equal(result.valid, true, result.errors.join('; '));
}

function testTutorialStillValid() {
    const tutorial = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../assets/maps/tutorial.json'), 'utf-8')
    );
    const result = validateMap(tutorial);
    assert.equal(result.valid, true, result.errors.join('; '));
}

function testUndoPlaceAndDelete() {
    const doc = new MapDocument(createEmptyMap());
    const initialCount = doc.map.zones.length;

    doc.execute(cmdPlaceZone(doc.map, createZoneFromStamp(STAMP_BY_ID.track, { x: 1, y: 2, z: 3 })));
    assert.equal(doc.map.zones.length, initialCount + 1);
    assert.ok(doc.canUndo());

    doc.undo();
    assert.equal(doc.map.zones.length, initialCount);
    assert.ok(doc.canRedo());

    doc.redo();
    assert.equal(doc.map.zones.length, initialCount + 1);

    doc.execute(cmdDeleteZones(doc.map, [doc.map.zones.length - 1]));
    assert.equal(doc.map.zones.length, initialCount);
    doc.undo();
    assert.equal(doc.map.zones.length, initialCount + 1);
}

function testUndoMoveAndRotate() {
    const doc = new MapDocument(createEmptyMap());
    doc.execute(cmdPlaceZone(doc.map, createZoneFromStamp(STAMP_BY_ID.floor, { x: 0, y: 0, z: 0 })));
    const idx = doc.map.zones.length - 1;
    const startX = doc.map.zones[idx].pos.x;

    doc.execute(cmdMoveZones(doc.map, [idx], { x: 2 }));
    assert.equal(doc.map.zones[idx].pos.x, startX + 2);

    doc.undo();
    assert.equal(doc.map.zones[idx].pos.x, startX);

    doc.execute(cmdRotateZones(doc.map, [idx], Math.PI / 4));
    assert.ok(Math.abs(doc.map.zones[idx].rotY - Math.PI / 4) < 0.001);
    doc.undo();
    assert.equal(doc.map.zones[idx].rotY || 0, 0);
}

function testCheckpointSync() {
    const map = createEmptyMap();
    map.zones.push(createZoneFromStamp(STAMP_BY_ID.checkpoint, { x: 5, y: 0, z: 10 }));
    syncCheckpointsFromZones(map);
    assert.equal(map.checkpoints.length, 1);
    assert.equal(map.checkpoints[0].id, 1);
    assert.ok(map.checkpoints[0].range);

    const payload = serializeMap(map);
    const result = validateMap(payload);
    assert.equal(result.valid, true, result.errors.join('; '));
}

function testSchemaRoundTripV2Stamps() {
    const map = createEmptyMap();
    map.id = 'editor_v2_roundtrip';
    map.medals = { goldTime: 30, silverTime: 45, bronzeTime: 60, parTime: 35 };
    map.zones.push(createZoneFromStamp(STAMP_BY_ID.checkpoint, { x: 0, y: 0, z: 5 }));
    map.zones.push(createZoneFromStamp(STAMP_BY_ID.collectible, { x: 2, y: 1, z: 8 }));
    map.zones.push(createZoneFromStamp(STAMP_BY_ID.grapple_anchor, { x: -3, y: 2, z: 12 }));
    map.zones.push(createZoneFromStamp(STAMP_BY_ID.model_neon_showcase, { x: 0, y: 3, z: 15 }));
    syncGoalsFromZones(map);
    syncCheckpointsFromZones(map);

    const json = serializeMapJson(map);
    const roundTrip = parseMapJson(json);
    const validation = validateMap(roundTrip);
    assert.equal(validation.valid, true, validation.errors.join('; '));
    assert.equal(roundTrip.zones.length, 5);
    assert.ok(roundTrip.zones.some((z) => z.type === 'collectible'));
    assert.ok(roundTrip.zones.some((z) => z.type === 'grapple_anchor'));
    assert.ok(roundTrip.zones.some((z) => z.type === 'model'));
    assert.equal(roundTrip.medals.goldTime, 30);
}

function testSnapHelpers() {
    assert.equal(snapScalar(1.3, 1, true), 1);
    assert.equal(snapScalar(1.3, 0.5, true), 1.5);
    const pos = snapPosition({ x: 1.2, y: 2.7, z: -0.4 }, 1, true);
    assert.equal(pos.x, 1);
    assert.equal(pos.y, 3);
    assert.equal(snapRotation(Math.PI / 20, 15, true), Math.PI / 12);
    assert.equal(rotationStepRad(45), Math.PI / 4);
}

function testPlaytestSessionRoundTrip() {
    const session = {
        mapJson: serializeMapJson(createEmptyMap()),
        selectedIndices: [0],
        camera: {
            mode: 'topdown',
            target: { x: 1, y: 0, z: 2 },
            zoom: 40,
            orbitYaw: 0.5,
            orbitPitch: 0.6,
            orbitRadius: 50,
        },
    };
    const restored = roundTripSession(session);
    assert.equal(restored.selectedIndices[0], 0);
    assert.equal(restored.camera.mode, 'topdown');
}

function testWorkshopAssetPaths() {
    const map = createEmptyMap();
    map.zones.push(createZoneFromStamp(STAMP_BY_ID.model_neon_showcase, { x: 0, y: 0, z: 0 }));
    const paths = collectMapAssetPaths(map);
    assert.ok(paths.includes('tracks/neon_showcase.glb'));
    assert.ok(paths.includes('tracks/neon_showcase_lod1.glb'));
}

testEmptyMapValidates();
testBuildSimpleMapExport();
testRotYFloorExport();
testTutorialStillValid();
testUndoPlaceAndDelete();
testUndoMoveAndRotate();
testCheckpointSync();
testSchemaRoundTripV2Stamps();
testSnapHelpers();
testPlaytestSessionRoundTrip();
testWorkshopAssetPaths();
console.log('Map editor tests passed');
