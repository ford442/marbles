/**
 * Math utilities for Marbles.
 * Implementation is kept in JS for Node test compatibility.
 * Types are provided in math.ts.
 */

export function quatFromEuler(yaw, pitch, roll) {
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

const _mat4Pool = new Float32Array(16);

export function quaternionToMat4(position, quaternion, out = undefined) {
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