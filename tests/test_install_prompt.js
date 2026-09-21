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

class FakeClassList {
    constructor() { this.set = new Set(); }
    add(c) { this.set.add(c); }
    remove(c) { this.set.delete(c); }
    contains(c) { return this.set.has(c); }
}

class FakeElement {
    constructor() {
        this.classList = new FakeClassList();
        this._listeners = {};
    }
    addEventListener(type, cb) {
        (this._listeners[type] ||= []).push(cb);
    }
    click() {
        (this._listeners.click || []).forEach((cb) => cb());
    }
}

const elements = {
    'install-banner': new FakeElement(),
    'btn-install-app': new FakeElement(),
    'btn-dismiss-install': new FakeElement(),
};
globalThis.document = { getElementById: (id) => elements[id] || null };

const windowListeners = {};
globalThis.window = {
    addEventListener(type, cb) {
        (windowListeners[type] ||= []).push(cb);
    },
};
function fireWindowEvent(type, evt) {
    (windowListeners[type] || []).forEach((cb) => cb(evt));
}

const { initInstallPrompt, recheckInstallBannerEligibility } = await import('../src/pwa/install-prompt.js');
const { recordLevelPlayed } = await import('../src/pwa/pwa-state.js');

function makeBeforeInstallPromptEvent() {
    return {
        preventDefault() {},
        prompt() { this.prompted = true; },
        userChoice: Promise.resolve({ outcome: 'accepted' }),
    };
}

async function testBannerHiddenUntilLevelPlayed() {
    storage.clear();
    elements['install-banner'].classList.remove('visible');

    initInstallPrompt();
    fireWindowEvent('beforeinstallprompt', makeBeforeInstallPromptEvent());

    assert.equal(elements['install-banner'].classList.contains('visible'), false);

    recordLevelPlayed('tutorial_ramp');
    recheckInstallBannerEligibility();

    assert.equal(elements['install-banner'].classList.contains('visible'), true);
}

async function testDismissHidesBannerAndStaysHidden() {
    storage.clear();
    elements['install-banner'].classList.remove('visible');
    recordLevelPlayed('tutorial_ramp');

    fireWindowEvent('beforeinstallprompt', makeBeforeInstallPromptEvent());
    assert.equal(elements['install-banner'].classList.contains('visible'), true);

    elements['btn-dismiss-install'].click();
    assert.equal(elements['install-banner'].classList.contains('visible'), false);

    recheckInstallBannerEligibility();
    assert.equal(elements['install-banner'].classList.contains('visible'), false);
}

await testBannerHiddenUntilLevelPlayed();
await testDismissHidesBannerAndStaysHidden();

console.log('All install prompt tests passed.');
