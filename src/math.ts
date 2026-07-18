import type { Mat4, Quat, Vec3 } from './types/geometry.js';
import * as math from './math.js';

export type { Mat4, Quat, Vec3 } from './types/geometry.js';

/**
 * Type declarations for the JavaScript implementation in math.js
 */
export const quatFromEuler: (yaw: number, pitch: number, roll: number) => Quat = math.quatFromEuler;
export const quaternionToMat4: (position: Vec3, quaternion: Quat, out?: Mat4) => Mat4 = math.quaternionToMat4;
