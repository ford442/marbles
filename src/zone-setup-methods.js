import { applyZoneSetupCore } from './zone-setup/core.js';
import { applyZoneSetupAssets } from './zone-setup/assets.js';
import { applyZoneSetupEnvironment } from './zone-setup/environment.js';
import { applyZoneSetupGrapple } from './zone-setup/grapple.js';

export function applyZoneSetupMethods(targetClass) {
    applyZoneSetupCore(targetClass);
    applyZoneSetupAssets(targetClass);
    applyZoneSetupEnvironment(targetClass);
    applyZoneSetupGrapple(targetClass);
}
