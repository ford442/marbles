import type { Mat4, Quat, Vec3 } from './types/geometry.ts';

export type { Mat4, Quat, Vec3 } from './types/geometry.ts';

/**
 * @deprecated Ambiguous: despite the parameter names, `yaw` rotates about Z,
 * `pitch` about Y and `roll` about X (q = Rz·Ry·Rx). Banned in src/zones/**;
 * use {@link quatFromYawPitchRoll}.
 */
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

/** Named rotations in radians for the Y-up world. Omitted axes are 0. */
export interface YawPitchRoll {
    /** About +Y (turn left/right). */
    yaw?: number;
    /** About +X (nose up/down: a ramp along +Z rises for negative pitch). */
    pitch?: number;
    /** About +Z (bank). */
    roll?: number;
}

export function quatMultiply(a: Quat, b: Quat): Quat {
    return {
        x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
        w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    };
}

/**
 * Rotation from named axes, applied intrinsically yaw → pitch → roll
 * (q = Ry(yaw)·Rx(pitch)·Rz(roll)), so a yawed ramp is pitched along its own
 * length rather than the world Z axis.
 */
export function quatFromYawPitchRoll({ yaw = 0, pitch = 0, roll = 0 }: YawPitchRoll): Quat {
    const qy: Quat = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
    const qx: Quat = { x: Math.sin(pitch / 2), y: 0, z: 0, w: Math.cos(pitch / 2) };
    const qz: Quat = { x: 0, y: 0, z: Math.sin(roll / 2), w: Math.cos(roll / 2) };
    return quatMultiply(quatMultiply(qy, qx), qz);
}

/** Rotate a vector by a unit quaternion. */
export function quatRotateVec3(q: Quat, v: Vec3): Vec3 {
    const tx = 2 * (q.y * v.z - q.z * v.y);
    const ty = 2 * (q.z * v.x - q.x * v.z);
    const tz = 2 * (q.x * v.y - q.y * v.x);
    return {
        x: v.x + q.w * tx + (q.y * tz - q.z * ty),
        y: v.y + q.w * ty + (q.z * tx - q.x * tz),
        z: v.z + q.w * tz + (q.x * ty - q.y * tx),
    };
}

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
