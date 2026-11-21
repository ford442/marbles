import { defineSlice, type SliceSpec } from '../game/systems/slice-composition.ts';
import { ZoneSetupCore, type ZoneSetupCoreHost } from './core.ts';
import { ZoneSetupAssets, type ZoneSetupAssetsHost } from './assets.ts';
import { ZoneSetupEnvironment, type ZoneSetupEnvironmentHost } from './environment.ts';
import { ZoneSetupGrapple, type ZoneSetupGrappleHost } from './grapple.ts';

/** Everything the zone-setup slices use on the game. */
export type ZoneSetupSlicesHost =
    & ZoneSetupCoreHost
    & ZoneSetupAssetsHost
    & ZoneSetupEnvironmentHost
    & ZoneSetupGrappleHost;

/** Composed zone rendering/interaction setup slices; the game forwards each `methods` list to the instance at `key`. */
export const ZONE_SETUP_SLICES: SliceSpec<ZoneSetupSlicesHost>[] = [
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
