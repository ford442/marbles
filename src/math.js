export function quatFromEuler(yaw, pitch, roll) {
    const cy = Math.cos(yaw * 0.5), sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5), sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5), sr = Math.sin(roll * 0.5);
    return {
        x: sr * cp * cy - cr * sp * sy,
        y: cr * sp * cy + sr * cp * sy,
        z: cr * cp * sy - sr * sp * cy,
        w: cr * cp * cy + sr * sp * sy
    };
}

// Shared buffer reused by every quaternionToMat4 call.
// Safe for synchronous callers that consume the result (via tcm.setTransform) before
// making another call.  Pass an explicit `out` buffer when you need to keep two
// matrices alive at the same time.
const _mat4Pool = new Float32Array(16);

export function quaternionToMat4(position, quaternion, out) {
    const buf = out !== undefined ? out : _mat4Pool;
    const x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    buf[0]  = 1 - (yy + zz); buf[1]  = xy + wz;        buf[2]  = xz - wy;        buf[3]  = 0;
    buf[4]  = xy - wz;        buf[5]  = 1 - (xx + zz); buf[6]  = yz + wx;        buf[7]  = 0;
    buf[8]  = xz + wy;        buf[9]  = yz - wx;        buf[10] = 1 - (xx + yy); buf[11] = 0;
    buf[12] = position.x;     buf[13] = position.y;     buf[14] = position.z;     buf[15] = 1;
    return buf;
}
