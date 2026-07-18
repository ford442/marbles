import { applyZoneSetupCore } from './core.js';
import { applyZoneSetupAssets } from './assets.js';
import { applyZoneSetupEnvironment } from './environment.js';
import { applyZoneSetupGrapple } from './grapple.js';

export function applyZoneSetupMethods(targetClass) {
    applyZoneSetupCore(targetClass);
    applyZoneSetupAssets(targetClass);
    applyZoneSetupEnvironment(targetClass);
    applyZoneSetupGrapple(targetClass);
}
