import { dispatchZone } from './registry.js';
import type { DispatchZone, ZoneDispatchHost } from './registry.js';
import { toVec3 } from './primitives.ts';
import { audio } from '../audio.js';

const DEFAULT_REVERB_RADIUS = 20;

/** What `createZone` uses on the game: everything a zone handler may call. */
export type ZoneSetupCoreHost = ZoneDispatchHost;

export class ZoneSetupCore {
    declare game: ZoneSetupCoreHost;

    constructor(game: ZoneSetupCoreHost) {
        this.game = game;
    }

    async createZone(zone: DispatchZone): Promise<void> {
        await dispatchZone(this.game, zone);

        // Only stamp zones declare `reverb`.
        if ('reverb' in zone && zone.reverb) {
            audio.registerReverbZone(toVec3(zone.pos), zone.reverb.radius ?? DEFAULT_REVERB_RADIUS, zone.reverb);
        }
    }
}
