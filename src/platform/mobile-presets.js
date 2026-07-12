import { detectPlatformProfile } from '../rendering-defaults.js';

/**
 * Apply first-run mobile graphics defaults (does not override explicit user saves).
 * @param {object} settings — merged settings object (mutated in place)
 * @param {{ isMobile?: boolean }} [platformOverride]
 * @returns {boolean} whether mobile defaults were applied
 */
export function applyMobileGraphicsDefaults(settings, platformOverride) {
    const { isMobile } = platformOverride || detectPlatformProfile();
    if (!isMobile) return false;

    const memory = typeof navigator !== 'undefined' ? (navigator.deviceMemory || 4) : 4;
    const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
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
    const memory = typeof navigator !== 'undefined' ? (navigator.deviceMemory || 4) : 4;
    const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
    return (memory <= 3 || cores <= 4) ? 'low' : 'medium';
}

export const MOBILE_DEFAULTS_FLAG = 'marbles3d_mobile_defaults_applied';
