import { dispatchZone } from './registry.js';

export class ZoneSetupCore {
    async createZone(zone) {
        await dispatchZone(this, zone);
    }
}

export function applyZoneSetupCore(targetClass) {
    for (const name of Object.getOwnPropertyNames(ZoneSetupCore.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = ZoneSetupCore.prototype[name];
        }
    }
}
