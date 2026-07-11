import type { Mat4, Quat, Vec3 } from './types/geometry.js';

export type { Mat4, Quat, Vec3 } from './types/geometry.js';

export function quatFromEuler(yaw: number, pitch: number, roll: number): Quat {
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);
    return {
        x: sr * cp * cy - cr * sp * sy,
        y: cr * sp * cy + sr * cp * sy,
        z: cr * cp * sy - sr * sp * cy,
        w: cr * cp * cy + sr * sp * sy,
    };
}

// Shared buffer reused by every quaternionToMat4 call.
// Safe for synchronous callers that consume the result (via tcm.setTransform) before
// making another call. Pass an explicit `out` buffer when two matrices must stay alive.
const _mat4Pool = new Float32Array(16);

export function quaternionToMat4(position: Vec3, quaternion: Quat, out?: Mat4): Mat4 {
    const buf = out ?? _mat4Pool;
    const x = quaternion.x;
    const y = quaternion.y;
    const z = quaternion.z;
    const w = quaternion.w;
    const x2 = x + x;
    const y2 = y + y;
    const z2 = z + z;
    const xx = x * x2;
    const xy = x * y2;
    const xz = x * z2;
    const yy = y * y2;
    const yz = y * z2;
    const zz = z * z2;
    const wx = w * x2;
    const wy = w * y2;
    const wz = w * z2;

    buf[0] = 1 - (yy + zz);
    buf[1] = xy + wz;
    buf[2] = xz - wy;
    buf[3] = 0;
    buf[4] = xy - wz;
    buf[5] = 1 - (xx + zz);
    buf[6] = yz + wx;
    buf[7] = 0;
    buf[8] = xz + wy;
    buf[9] = yz - wx;
    buf[10] = 1 - (xx + yy);
    buf[11] = 0;
    buf[12] = position.x;
    buf[13] = position.y;
    buf[14] = position.z;
    buf[15] = 1;
    return buf;
}
