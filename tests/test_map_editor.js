import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    createEmptyMap,
    serializeMap,
    syncGoalsFromZones,
    parseMapJson,
    serializeMapJson,
} from '../src/editor/map-document.js';
import { validateMap } from '../src/editor/map-validator.js';
import { createZoneFromStamp, STAMP_BY_ID } from '../src/editor/stamps.js';
import { mapDefToLevel } from '../src/editor/map-document.js';

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

testEmptyMapValidates();
testBuildSimpleMapExport();
testRotYFloorExport();
testTutorialStillValid();
console.log('Map editor tests passed');
