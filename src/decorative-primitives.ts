/**
 * Repeated decorative primitive meshes for batched zone greebles.
 * Visual-only — collision stays on Rapier box/primitive colliders elsewhere.
 *
 * Vertex layout matches CUBE_VERTICES: position(3) + tangent-quat(4) + uv(2) = 9 floats.
 */

export const DECORATIVE_VERTEX_STRIDE = 9

/** Interleaved decorative mesh (see layout above) plus its triangle indices. */
export interface DecorativeMesh {
    vertices: Float32Array
    indices: Uint16Array
}

type Vec3Tuple = [number, number, number]
type Vec2Tuple = [number, number]
type QuatTuple = [number, number, number, number]
/** The eight corners of an axis-aligned box, min-Z face first. */
type BoxCorners = [Vec3Tuple, Vec3Tuple, Vec3Tuple, Vec3Tuple, Vec3Tuple, Vec3Tuple, Vec3Tuple, Vec3Tuple]

const _verts: number[] = []
const _indices: number[] = []

function resetMesh(): void {
    _verts.length = 0
    _indices.length = 0
}

function normalize(v: Vec3Tuple): Vec3Tuple {
    const len = Math.hypot(v[0], v[1], v[2]) || 1
    return [v[0] / len, v[1] / len, v[2] / len]
}

function cross(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

function normalToQuat(nx: number, ny: number, nz: number): QuatTuple {
    let tx = 1
    let ty = 0
    let tz = 0
    if (Math.abs(nx) > 0.9) {
        tx = 0
        ty = 1
        tz = 0
    }
    const dot = tx * nx + ty * ny + tz * nz
    tx -= dot * nx
    ty -= dot * ny
    tz -= dot * nz
    const tLen = Math.hypot(tx, ty, tz) || 1
    tx /= tLen
    ty /= tLen
    tz /= tLen
    const bx = ny * tz - nz * ty
    const by = nz * tx - nx * tz
    const bz = nx * ty - ny * tx

    const m00 = tx
    const m01 = bx
    const m02 = nx
    const m10 = ty
    const m11 = by
    const m12 = ny
    const m20 = tz
    const m21 = bz
    const m22 = nz
    const trace = m00 + m11 + m22

    if (trace > 0) {
        const s = 0.5 / Math.sqrt(trace + 1)
        return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s]
    }
    if (m00 > m11 && m00 > m22) {
        const s = 2 * Math.sqrt(1 + m00 - m11 - m22)
        return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]
    }
    if (m11 > m22) {
        const s = 2 * Math.sqrt(1 + m11 - m00 - m22)
        return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]
    }
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
    return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]
}

function pushVertex(pos: Vec3Tuple, normal: Vec3Tuple, uv: Vec2Tuple): void {
    const n = normalize(normal)
    const q = normalToQuat(n[0], n[1], n[2])
    _verts.push(pos[0], pos[1], pos[2], q[0], q[1], q[2], q[3], uv[0], uv[1])
}

function pushTriangle(
    a: Vec3Tuple,
    b: Vec3Tuple,
    c: Vec3Tuple,
    uvA: Vec2Tuple = [0, 0],
    uvB: Vec2Tuple = [1, 0],
    uvC: Vec2Tuple = [0.5, 1],
): void {
    const base = _verts.length / DECORATIVE_VERTEX_STRIDE
    const ab: Vec3Tuple = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const ac: Vec3Tuple = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const n = cross(ab, ac)
    pushVertex(a, n, uvA)
    pushVertex(b, n, uvB)
    pushVertex(c, n, uvC)
    _indices.push(base, base + 1, base + 2)
}

function pushQuad(a: Vec3Tuple, b: Vec3Tuple, c: Vec3Tuple, d: Vec3Tuple): void {
    pushTriangle(a, b, c)
    pushTriangle(a, c, d)
}

function finalizeMesh(): DecorativeMesh {
    return {
        vertices: new Float32Array(_verts),
        indices: new Uint16Array(_indices),
    }
}

/** Elongated octahedron crystal (unit height ~1.0, centered at origin). */
function buildCrystalMesh(): DecorativeMesh {
    resetMesh()
    const top: Vec3Tuple = [0, 0.55, 0]
    const bottom: Vec3Tuple = [0, -0.55, 0]
    const px: Vec3Tuple = [0.22, 0, 0]
    const nx: Vec3Tuple = [-0.22, 0, 0]
    const pz: Vec3Tuple = [0, 0, 0.22]
    const nz: Vec3Tuple = [0, 0, -0.22]

    pushTriangle(top, px, pz)
    pushTriangle(top, pz, nx)
    pushTriangle(top, nx, nz)
    pushTriangle(top, nz, px)
    pushTriangle(bottom, pz, px)
    pushTriangle(bottom, nx, pz)
    pushTriangle(bottom, nz, nx)
    pushTriangle(bottom, px, nz)
    return finalizeMesh()
}

/** Short hollow pipe segment along +Z (outer r=0.5, inner r=0.32, length 1). */
function buildPipeMesh(segments = 8): DecorativeMesh {
    resetMesh()
    const outer = 0.5
    const inner = 0.32
    const halfLen = 0.5

    for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2
        const a1 = ((i + 1) / segments) * Math.PI * 2
        const cos0 = Math.cos(a0)
        const sin0 = Math.sin(a0)
        const cos1 = Math.cos(a1)
        const sin1 = Math.sin(a1)

        const o0n: Vec3Tuple = [cos0 * outer, sin0 * outer, -halfLen]
        const o1n: Vec3Tuple = [cos1 * outer, sin1 * outer, -halfLen]
        const o0f: Vec3Tuple = [cos0 * outer, sin0 * outer, halfLen]
        const o1f: Vec3Tuple = [cos1 * outer, sin1 * outer, halfLen]
        pushQuad(o0n, o1n, o1f, o0f)

        const i0n: Vec3Tuple = [cos0 * inner, sin0 * inner, -halfLen]
        const i1n: Vec3Tuple = [cos1 * inner, sin1 * inner, -halfLen]
        const i0f: Vec3Tuple = [cos0 * inner, sin0 * inner, halfLen]
        const i1f: Vec3Tuple = [cos1 * inner, sin1 * inner, halfLen]
        pushQuad(i0f, i1f, i1n, i0n)

        const ring0o: Vec3Tuple = [cos0 * outer, sin0 * outer, -halfLen]
        const ring0i: Vec3Tuple = [cos0 * inner, sin0 * inner, -halfLen]
        const ring1o: Vec3Tuple = [cos1 * outer, sin1 * outer, -halfLen]
        const ring1i: Vec3Tuple = [cos1 * inner, sin1 * inner, -halfLen]
        pushQuad(ring0o, ring1o, ring1i, ring0i)

        const fring0o: Vec3Tuple = [cos0 * outer, sin0 * outer, halfLen]
        const fring0i: Vec3Tuple = [cos0 * inner, sin0 * inner, halfLen]
        const fring1o: Vec3Tuple = [cos1 * outer, sin1 * outer, halfLen]
        const fring1i: Vec3Tuple = [cos1 * inner, sin1 * inner, halfLen]
        pushQuad(fring1o, fring0o, fring0i, fring1i)
    }
    return finalizeMesh()
}

/** Rounded bumper puck (short cylinder, 8 sides). */
function buildBumperMesh(segments = 8): DecorativeMesh {
    resetMesh()
    const radius = 0.5
    const halfH = 0.18
    const top: Vec3Tuple = [0, halfH, 0]
    const bottom: Vec3Tuple = [0, -halfH, 0]

    for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2
        const a1 = ((i + 1) / segments) * Math.PI * 2
        const x0 = Math.cos(a0) * radius
        const z0 = Math.sin(a0) * radius
        const x1 = Math.cos(a1) * radius
        const z1 = Math.sin(a1) * radius

        pushQuad([x0, halfH, z0], [x1, halfH, z1], [x1, -halfH, z1], [x0, -halfH, z0])
        pushTriangle(top, [x1, halfH, z1], [x0, halfH, z0])
        pushTriangle(bottom, [x0, -halfH, z0], [x1, -halfH, z1])
    }
    return finalizeMesh()
}

/** I-beam profile extruded along Z (structural girder). */
function buildGirderMesh(): DecorativeMesh {
    resetMesh()
    const hw = 0.45
    const hh = 0.5
    const tf = 0.08
    const ww = 0.12
    const hl = 0.5

    function box(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): void {
        const v: BoxCorners = [
            [minX, minY, minZ], [maxX, minY, minZ], [maxX, maxY, minZ], [minX, maxY, minZ],
            [minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ],
        ]
        pushQuad(v[0], v[1], v[2], v[3])
        pushQuad(v[5], v[4], v[7], v[6])
        pushQuad(v[4], v[0], v[3], v[7])
        pushQuad(v[1], v[5], v[6], v[2])
        pushQuad(v[3], v[2], v[6], v[7])
        pushQuad(v[4], v[5], v[1], v[0])
    }

    box(-hw, hw, hh - tf, hh, -hl, hl)
    box(-hw, hw, -hh, -hh + tf, -hl, hl)
    box(-ww, ww, -hh + tf, hh - tf, -hl, hl)
    return finalizeMesh()
}

/** Thin diagonal hazard panel (flat quad extruded to a shallow box). */
function buildHazardStripeMesh(): DecorativeMesh {
    resetMesh()
    const w = 0.5
    const h = 0.08
    const d = 0.02

    function box(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): void {
        const v: BoxCorners = [
            [minX, minY, minZ], [maxX, minY, minZ], [maxX, maxY, minZ], [minX, maxY, minZ],
            [minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ],
        ]
        pushQuad(v[0], v[1], v[2], v[3])
        pushQuad(v[5], v[4], v[7], v[6])
        pushQuad(v[4], v[0], v[3], v[7])
        pushQuad(v[1], v[5], v[6], v[2])
        pushQuad(v[3], v[2], v[6], v[7])
        pushQuad(v[4], v[5], v[1], v[0])
    }

    box(-w, w, -h, h, -d, d)
    return finalizeMesh()
}

export const DECORATIVE_PRIMITIVES = {
    crystal: buildCrystalMesh(),
    pipe: buildPipeMesh(),
    bumper: buildBumperMesh(),
    girder: buildGirderMesh(),
    hazardStripe: buildHazardStripeMesh(),
}

export const DECORATIVE_PRIMITIVE_NAMES = Object.keys(DECORATIVE_PRIMITIVES)
