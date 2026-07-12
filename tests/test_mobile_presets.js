import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../src/init/filament-loader.js';
import {
    applyMobileGraphicsDefaults,
    resolveMobileInitQuality,
} from '../src/platform/mobile-presets.js';

function testMobileDefaultsMutateSettings() {
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const applied = applyMobileGraphicsDefaults(settings, { isMobile: true });
    assert.equal(applied, true);
    assert.ok(['low', 'medium'].includes(settings.graphics.quality));
    assert.equal(settings.graphics.targetFps, 30);
    assert.equal(settings.graphics.ssao, false);
    assert.equal(settings.controls.touch.enabled, 'on');
}

function testResolveMobileInitQuality() {
    const q = resolveMobileInitQuality();
    assert.ok(['low', 'medium'].includes(q));
}

testMobileDefaultsMutateSettings();
testResolveMobileInitQuality();

console.log('All mobile preset tests passed.');
