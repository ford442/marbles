/** Minimal mat4 helpers for WebGPU particle overlay (view-projection from game camera state). */

/**
 * @param {number[]} eye
 * @param {number[]} target
 * @param {number[]} [up]
 * @returns {Float32Array}
 */
export function lookAt(eye, target, up = [0, 1, 0]) {
    const zx = eye[0] - target[0];
    const zy = eye[1] - target[1];
    const zz = eye[2] - target[2];
    let len = Math.hypot(zx, zy, zz) || 1;
    const z0 = zx / len;
    const z1 = zy / len;
    const z2 = zz / len;

    let x0 = up[1] * z2 - up[2] * z1;
    let x1 = up[2] * z0 - up[0] * z2;
    let x2 = up[0] * z1 - up[1] * z0;
    len = Math.hypot(x0, x1, x2) || 1;
    x0 /= len; x1 /= len; x2 /= len;

    const y0 = z1 * x2 - z2 * x1;
    const y1 = z2 * x0 - z0 * x2;
    const y2 = z0 * x1 - z1 * x0;

    const out = new Float32Array(16);
    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    out[15] = 1;
    return out;
}

/**
 * @param {number} fovDeg vertical FOV in degrees
 * @param {number} aspect width / height
 * @param {number} near
 * @param {number} far
 * @returns {Float32Array}
 */
export function perspective(fovDeg, aspect, near = 0.1, far = 1000) {
    const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
    const nf = 1 / (near - far);
    const out = new Float32Array(16);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
}

/**
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {Float32Array}
 */
export function multiplyMat4(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            out[c * 4 + r] =
                a[0 * 4 + r] * b[c * 4 + 0] +
                a[1 * 4 + r] * b[c * 4 + 1] +
                a[2 * 4 + r] * b[c * 4 + 2] +
                a[3 * 4 + r] * b[c * 4 + 3];
        }
    }
    return out;
}

/**
 * @param {{ eye: number[], target: number[] }} cameraState
 * @param {number} fovDeg
 * @param {number} aspect
 */
export function buildViewProjection(cameraState, fovDeg, aspect) {
    const eye = cameraState?.eye || [0, 10, 20];
    const target = cameraState?.target || [0, 0, 0];
    const view = lookAt(eye, target);
    const proj = perspective(fovDeg, aspect);
    return multiplyMat4(proj, view);
}
