import { dispatchZone } from './registry.js';

export class ZoneSetupCore {
    async createZone(zone) {
        await dispatchZone(this, zone);
    }
}
