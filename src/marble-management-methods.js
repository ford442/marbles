/** @deprecated Use MarbleRegistry from './game/systems/marble-registry.js' */
export { MarbleRegistry } from './game/systems/marble-registry.js';

/** @deprecated Mixin removed — methods delegate via main.js marbleRegistry */
export function applyMarbleManagementMethods() {
    throw new Error('applyMarbleManagementMethods is deprecated; use MarbleRegistry + delegation in main.js');
}
