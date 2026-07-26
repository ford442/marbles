/**
 * @fileoverview Zone methods module
 * 
 * This module exports a closed zone-method installer. Method names come from
 * explicit object maps rather than prototype enumeration:
 * - creation: Zone creation methods (checkpoints, zones, levels)
 * - physics: Physics body creation and management
 * - visuals: Visual effects, lighting, and particles
 * - utilities: Helper methods
 */

import { creationMethods } from './creation.js';
import { physicsMethods } from './physics.js';
import { visualMethods } from './visuals.js';
import { utilityMethods } from './utilities.js';

/**
 * Applies all zone methods to a target class
 * @param {Function} targetClass - The class to mix methods into
 */
export function installZoneMethods(targetClass) {
    const allMethods = {
        ...creationMethods,
        ...physicsMethods,
        ...visualMethods,
        ...utilityMethods
    };

    for (const [name, method] of Object.entries(allMethods)) {
        targetClass.prototype[name] = method;
    }
}

// Re-export individual method groups for selective application
export { creationMethods } from './creation.js';
export { physicsMethods } from './physics.js';
export { visualMethods } from './visuals.js';
export { utilityMethods } from './utilities.js';

// Re-export types (for JSDoc/documentation purposes)
export * from './types.js';
