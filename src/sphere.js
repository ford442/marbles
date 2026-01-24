
function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function tbnToQuaternion(t, b, n) {
    // Matrix is [t, b, n] columns
    const m00 = t[0], m01 = b[0], m02 = n[0];
    const m10 = t[1], m11 = b[1], m12 = n[1];
    const m20 = t[2], m21 = b[2], m22 = n[2];

    const trace = m00 + m11 + m22;
    let qx, qy, qz, qw;

    if (trace > 0) {
        const s = 0.5 / Math.sqrt(trace + 1.0);
        qw = 0.25 / s;
        qx = (m21 - m12) * s;
        qy = (m02 - m20) * s;
        qz = (m10 - m01) * s;
    } else {
        if (m00 > m11 && m00 > m22) {
            const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
            qw = (m21 - m12) / s;
            qx = 0.25 * s;
            qy = (m01 + m10) / s;
            qz = (m02 + m20) / s;
        } else if (m11 > m22) {
            const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
            qw = (m02 - m20) / s;
            qx = (m01 + m10) / s;
            qy = 0.25 * s;
            qz = (m12 + m21) / s;
        } else {
            const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
            qw = (m10 - m01) / s;
            qx = (m02 + m20) / s;
            qy = (m12 + m21) / s;
            qz = 0.25 * s;
        }
    }
    return [qx, qy, qz, qw];
}

export function createSphere(radius, widthSegments = 32, heightSegments = 16) {
    const vertices = []; // x, y, z, qx, qy, qz, qw
    const indices = [];

    for (let iy = 0; iy <= heightSegments; iy++) {
        const v = iy / heightSegments;
        const theta = v * Math.PI;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let ix = 0; ix <= widthSegments; ix++) {
            const u = ix / widthSegments;
            const phi = u * 2 * Math.PI;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            // Position (Filament Y-up)
            const x = radius * cosPhi * sinTheta;
            const y = radius * cosTheta;
            const z = radius * sinPhi * sinTheta;

            // Normal (Normalized Position)
            const nx = x / radius;
            const ny = y / radius;
            const nz = z / radius;

            // Tangent (derivative with respect to u/phi)
            // Normalized: (-sinPhi, 0, cosPhi)
            let tx = -sinPhi;
            let ty = 0;
            let tz = cosPhi;

            // Handle poles
            if (sinTheta < 0.0001) {
                tx = 1; ty = 0; tz = 0;
            }

            // Bitangent
            const nVec = [nx, ny, nz];
            const tVec = [tx, ty, tz];
            const bVec = cross(nVec, tVec);

            const q = tbnToQuaternion(tVec, bVec, nVec);

            vertices.push(x, y, z);
            vertices.push(...q);
        }
    }

    for (let iy = 0; iy < heightSegments; iy++) {
        for (let ix = 0; ix < widthSegments; ix++) {
            const a = iy * (widthSegments + 1) + ix;
            const b = iy * (widthSegments + 1) + (ix + 1);
            const c = (iy + 1) * (widthSegments + 1) + ix;
            const d = (iy + 1) * (widthSegments + 1) + (ix + 1);

            indices.push(a, c, b);
            indices.push(b, c, d);
        }
    }

    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
    };
}
