/** @deprecated Use InputSystem from './game/systems/input-system.js' */
export { InputSystem } from './game/systems/input-system.js';

/** @deprecated Mixin removed — methods delegate via main.js inputSystem */
export function applyInputMethods() {
    throw new Error('applyInputMethods is deprecated; use InputSystem + delegation in main.js');
}
