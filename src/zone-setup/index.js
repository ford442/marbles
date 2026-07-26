import { installKnownMethods } from '../game/systems/method-installer.js';
import { ZoneSetupCore } from './core.js';
import { ZoneSetupAssets } from './assets.js';
import { ZoneSetupEnvironment } from './environment.js';
import { ZoneSetupGrapple } from './grapple.js';

/** Closed compatibility list for rendering/interaction setup helpers. */
export function installZoneSetupMethods(targetClass) {
    installKnownMethods(targetClass, ZoneSetupCore, ['createZone']);
    installKnownMethods(targetClass, ZoneSetupAssets, ['setupAssets']);
    installKnownMethods(targetClass, ZoneSetupEnvironment, [
        'setupPostProcessing', 'setupEnvironmentLighting', 'applyEnvironmentFog',
        'applyColorGradingForEnvironment', '_upgradeEnvironmentWithCubemap', 'applyEnvironment',
    ]);
    installKnownMethods(targetClass, ZoneSetupGrapple, [
        'createGrappleLine', 'createCueStick', 'startGrapple', 'stopGrapple',
        'updateGrapple', 'shootMarble',
    ]);
}
