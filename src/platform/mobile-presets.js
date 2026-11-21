// @ts-check
import { detectPlatformProfile } from '../rendering-defaults.js';

/** @typedef {import('../types/settings.ts').GameSettings} GameSettings */

/**
 * `navigator.deviceMemory` (GB; Chromium only) and core count, defaulting to 4.
 * @returns {{ memory: number, cores: number }}
 */
function deviceBudget() {
    if (typeof navigator === 'undefined') return { memory: 4, cores: 4 };
    // deviceMemory is not in the DOM lib typings (Chromium-only API).
    const nav = /** @type {Navigator & { deviceMemory?: number }} */ (navigator);
    return { memory: nav.deviceMemory || 4, cores: nav.hardwareConcurrency || 4 };
}

/**
 * Apply first-run mobile graphics defaults (does not override explicit user saves).
 * @param {GameSettings} settings — merged settings object (mutated in place)
 * @param {{ isMobile?: boolean }} [platformOverride]
 * @returns {boolean} whether mobile defaults were applied
 */
export function applyMobileGraphicsDefaults(settings, platformOverride) {
    const { isMobile } = platformOverride || detectPlatformProfile();
    if (!isMobile) return false;

    const { memory, cores } = deviceBudget();
    const lowTier = memory <= 3 || cores <= 4;

    settings.graphics.quality = lowTier ? 'low' : 'medium';
    settings.graphics.targetFps = 30;
    settings.graphics.performanceMode = 'auto';
    settings.graphics.dynamicResolution = true;
    settings.graphics.renderScale = lowTier ? 0.85 : 1.0;
    settings.graphics.shadows = true;
    settings.graphics.ssao = false;
    settings.graphics.bloom = lowTier ? 20 : 35;

    if (!settings.controls.touch) {
        settings.controls.touch = {};
    }
    settings.controls.touch.enabled = 'on';
    settings.controls.touch.showControls = true;

    return true;
}

/**
 * Quality tier used before settings load on mobile cold start.
 * @returns {string}
 */
export function resolveMobileInitQuality() {
    const { isMobile } = detectPlatformProfile();
    if (!isMobile) return 'medium';
    const { memory, cores } = deviceBudget();
    return (memory <= 3 || cores <= 4) ? 'low' : 'medium';
}

export const MOBILE_DEFAULTS_FLAG = 'marbles3d_mobile_defaults_applied';
