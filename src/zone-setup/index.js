import { defineSlice } from '../game/systems/slice-composition.ts';
import { ZoneSetupCore } from './core.js';
import { ZoneSetupAssets } from './assets.js';
import { ZoneSetupEnvironment } from './environment.js';
import { ZoneSetupGrapple } from './grapple.js';

/** Composed zone rendering/interaction setup slices; the game forwards each `methods` list to the instance at `key`. */
export const ZONE_SETUP_SLICES = [
    defineSlice('zoneSetupCoreSlice', ZoneSetupCore, ['createZone']),
    defineSlice('zoneSetupAssetsSlice', ZoneSetupAssets, ['setupAssets']),
    defineSlice('zoneSetupEnvironmentSlice', ZoneSetupEnvironment, [
        'setupPostProcessing', 'setupEnvironmentLighting', 'applyEnvironmentFog',
        'applyColorGradingForEnvironment', '_upgradeEnvironmentWithCubemap', 'applyEnvironment',
    ]),
    defineSlice('zoneSetupGrappleSlice', ZoneSetupGrapple, [
        'createGrappleLine', 'createCueStick', 'startGrapple', 'stopGrapple', 'cancelGrapple',
        'updateGrapple', 'shootMarble',
    ]),
];
