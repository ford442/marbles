import { dispatchZone } from './registry.js';
import { audio } from '../audio.js';

const DEFAULT_REVERB_RADIUS = 20;

export class ZoneSetupCore {
    async createZone(zone) {
        await dispatchZone(this, zone);

        if (zone.reverb) {
            audio.registerReverbZone(zone.pos, zone.reverb.radius ?? DEFAULT_REVERB_RADIUS, zone.reverb);
        }
    }
}
