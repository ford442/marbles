import assert from 'node:assert/strict';

const storage = new Map();
const DEVICE_UUID = '11111111-2222-4333-8444-555555555555';

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

globalThis.fetch = async (url, options) => {
    if (url.includes('/progress/') && options?.method === 'PUT') {
        return { ok: true, status: 200 };
    }
    return { ok: false, status: 404 };
};

globalThis.requestIdleCallback = (cb) => setTimeout(cb, 0);

const {
    CLOUD_QUEUE_KEY,
    DEVICE_ID_KEY,
    getDeviceId,
    getCloudOptIn,
    isCloudEnabled,
    scheduleProgressSync,
    scheduleQueueFlush,
    setCloudOptIn,
} = await import('../src/game/network/cloud-client.js');

function resetStorage() {
    storage.clear();
    storage.set(DEVICE_ID_KEY, DEVICE_UUID);
    globalThis.__MARbles_TEST_API_URL__ = '';
}

function testDeviceIdStable() {
    resetStorage();
    const a = getDeviceId();
    const b = getDeviceId();
    assert.equal(a, b);
    assert.ok(a.includes('-'));
}

function testOptInGate() {
    resetStorage();
    globalThis.__MARbles_TEST_API_URL__ = 'http://localhost:7860';
    assert.equal(getCloudOptIn(), false);
    assert.equal(isCloudEnabled(), false);
    setCloudOptIn(true);
    assert.equal(getCloudOptIn(), true);
    assert.equal(isCloudEnabled(), true);
}

async function testQueueFlushProgress() {
    resetStorage();
    globalThis.__MARbles_TEST_API_URL__ = 'http://localhost:7860';
    setCloudOptIn(true);
    getDeviceId();

    scheduleProgressSync({
        version: 1,
        freePlay: false,
        unlockedChapters: ['tutorial'],
        levels: {},
        unlockedMarbles: [],
    });

    const raw = storage.get(CLOUD_QUEUE_KEY);
    assert.ok(raw);
    const queue = JSON.parse(raw);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].op, 'progress');

    scheduleQueueFlush();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const after = storage.get(CLOUD_QUEUE_KEY);
    const remaining = after ? JSON.parse(after) : [];
    assert.equal(remaining.length, 0);
}

testDeviceIdStable();
testOptInGate();
await testQueueFlushProgress();
console.log('All cloud client tests passed.');
