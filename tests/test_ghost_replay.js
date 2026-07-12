import assert from 'node:assert/strict';
import { GhostReplay } from '../src/game/systems/ghost-replay.js';

function testSaveBestOnFasterTime() {
    const storage = {};
    globalThis.localStorage = {
        getItem: (k) => storage[k] ?? null,
        setItem: (k, v) => { storage[k] = v; },
    };

    const ghost = new GhostReplay();
    ghost.recording = [
        { t: 0, x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
        { t: 1, x: 1, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
    ];

    assert.equal(ghost.saveBestRecording('tutorial', 40), true);
    assert.equal(ghost.getBestTime('tutorial'), 40);
    assert.ok(ghost.hasGhost('tutorial'));

    ghost.recording = [
        { t: 0, x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
    ];
    assert.equal(ghost.saveBestRecording('tutorial', 50), false);
    assert.equal(ghost.getBestTime('tutorial'), 40);

    ghost.recording = [
        { t: 0, x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
        { t: 2, x: 5, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
    ];
    assert.equal(ghost.saveBestRecording('tutorial', 30), true);
    assert.equal(ghost.getBestTime('tutorial'), 30);
}

function testImportExport() {
    const storage = {};
    globalThis.localStorage = {
        getItem: (k) => storage[k] ?? null,
        setItem: (k, v) => { storage[k] = v; },
    };

    const ghost = new GhostReplay();
    ghost.recording = [
        { t: 0, x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
        { t: 0.5, x: 2, y: 1, z: -1, qx: 0, qy: 0.1, qz: 0, qw: 0.99 },
    ];
    ghost.saveBestRecording('tutorial', 25);

    const exported = ghost.exportReplay('tutorial');
    assert.ok(exported?.startsWith('m3g1:'));

    const fresh = new GhostReplay();
    const result = fresh.importReplay(exported, 'tutorial');
    assert.equal(result.levelId, 'tutorial');
    assert.ok(fresh.hasGhost('tutorial'));
    assert.ok(fresh.loadPlayback('tutorial'));
    assert.equal(fresh.playbackFrames.length, 2);
}

testSaveBestOnFasterTime();
testImportExport();

console.log('All ghost replay tests passed.');
