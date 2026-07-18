/** @deprecated Use PhysicsWorld from './game/systems/physics-world.js' */
export { PhysicsWorld } from './game/systems/physics-world.js';

/** @deprecated Mixin removed — methods delegate via main.js physicsWorld */
export function applyPhysicsFactoryMethods() {
    throw new Error('applyPhysicsFactoryMethods is deprecated; use PhysicsWorld + delegation in main.js');
}
