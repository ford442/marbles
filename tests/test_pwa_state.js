import assert from 'node:assert/strict';

const storage = new Map();

globalThis.localStorage = {
    getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
        storage.set(key, String(value));
    },
    removeItem(key) {
        storage.delete(key);
    },
};

const {
    HAS_PLAYED_LEVEL_KEY,
    LAST_LEVEL_KEY,
    recordLevelPlayed,
    hasPlayedALevel,
    getLastPlayedLevel,
} = await import('../src/pwa/pwa-state.js');

function testStartsUnplayed() {
    storage.clear();
    assert.equal(hasPlayedALevel(), false);
    assert.equal(getLastPlayedLevel(), null);
}

function testRecordLevelPlayedSetsBothFlags() {
    storage.clear();
    recordLevelPlayed('tutorial_ramp');
    assert.equal(hasPlayedALevel(), true);
    assert.equal(getLastPlayedLevel(), 'tutorial_ramp');
    assert.equal(storage.get(HAS_PLAYED_LEVEL_KEY), '1');
    assert.equal(storage.get(LAST_LEVEL_KEY), 'tutorial_ramp');
}

function testRecordLevelPlayedTracksMostRecentLevel() {
    storage.clear();
    recordLevelPlayed('landing_zone');
    recordLevelPlayed('tutorial_ramp');
    assert.equal(getLastPlayedLevel(), 'tutorial_ramp');
}

function testRecordLevelPlayedWithoutIdKeepsPlayedFlagOnly() {
    storage.clear();
    recordLevelPlayed();
    assert.equal(hasPlayedALevel(), true);
    assert.equal(getLastPlayedLevel(), null);
}

testStartsUnplayed();
testRecordLevelPlayedSetsBothFlags();
testRecordLevelPlayedTracksMostRecentLevel();
testRecordLevelPlayedWithoutIdKeepsPlayedFlagOnly();

console.log('All PWA state tests passed.');
