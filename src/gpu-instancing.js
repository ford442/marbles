// @ts-check
/**
 * GPU Instancing / Geometry Batching Utilities
 *
 * Filament's JS bindings do not expose native GPU instancing.
 * This module provides geometry batching by merging repeated primitives
 * into a single VertexBuffer/IndexBuffer pair, dramatically reducing
 * draw calls for static zone decorations (trees, crystals, pegs, etc.).
 */

/** @typedef {import('./types/filament.ts').FilamentHandle} FilamentHandle */
/** @typedef {import('./types/filament.ts').FilamentModule} FilamentModule */

/**
 * One placed copy of the base mesh. `position` / `scale` are `[x, y, z]` and
 * `rotation` is an `[x, y, z, w]` quaternion; missing fields take identity.
 * @typedef {{ position?: readonly number[], rotation?: readonly number[], scale?: readonly number[] }} BatchInstanceInput
 */

/** @typedef {{ vertices: Float32Array, indices: Uint16Array, count: number }} BatchedGeometry */
/** @typedef {{ center: [number, number, number], halfExtent: [number, number, number] }} BatchBounds */

/**
 * Column-major 4×4 transform as a 16-tuple, so element reads are `number`.
 * @typedef {[number, number, number, number, number, number, number, number,
 *            number, number, number, number, number, number, number, number]} Mat4Tuple
 */

/** Unit cube corners, used when no base mesh is given to `computeMeshBatchBounds`. */
/** @type {ReadonlyArray<readonly [number, number, number]>} */
const UNIT_CUBE_CORNERS = [
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5],
]

/**
 * Merge multiple box transforms into a single batched mesh.
 *
 * @param {Float32Array} baseVertices  The base cube vertices (CUBE_VERTICES format)
 * @param {Uint16Array}  baseIndices   The base cube indices (CUBE_INDICES format)
 * @param {readonly BatchInstanceInput[]} instances
 * @returns {BatchedGeometry}
 */
export function batchBoxGeometry(baseVertices, baseIndices, instances) {
    return batchGeometry(baseVertices, baseIndices, instances, 9)
}

/**
 * Merge multiple transformed copies of a mesh into one batched buffer.
 *
 * @param {Float32Array} baseVertices
 * @param {Uint16Array} baseIndices
 * @param {readonly BatchInstanceInput[]} instances
 * @param {number} [vertexStride]  Floats per vertex (9 for cube / decorative meshes)
 * @returns {BatchedGeometry}
 */
export function batchGeometry(baseVertices, baseIndices, instances, vertexStride = 9) {
    if (!instances || instances.length === 0) {
        return { vertices: baseVertices, indices: baseIndices, count: 1 }
    }

    const vertsPerMesh = baseVertices.length / vertexStride
    const indicesPerMesh = baseIndices.length

    const totalVertices = new Float32Array(baseVertices.length * instances.length)
    const totalIndices = new Uint16Array(baseIndices.length * instances.length)

    // Vertex reads below stay inside `baseVertices` (v < vertsPerMesh, k < vertexStride)
    // and index reads inside `baseIndices`, so their `?? 0` fallbacks never fire.
    let i = 0
    for (const inst of instances) {
        const pos = inst.position || [0, 0, 0]
        const rot = inst.rotation || [0, 0, 0, 1]
        const scl = inst.scale || [1, 1, 1]
        const m = quatToMat4(rot, pos, scl)

        const vertexOffset = i * vertsPerMesh * vertexStride
        const indexOffset = i * indicesPerMesh

        for (let v = 0; v < vertsPerMesh; v++) {
            const srcIdx = v * vertexStride
            const dstIdx = vertexOffset + v * vertexStride

            const px = baseVertices[srcIdx] ?? 0
            const py = baseVertices[srcIdx + 1] ?? 0
            const pz = baseVertices[srcIdx + 2] ?? 0

            totalVertices[dstIdx]     = m[0] * px + m[4] * py + m[8]  * pz + m[12]
            totalVertices[dstIdx + 1] = m[1] * px + m[5] * py + m[9]  * pz + m[13]
            totalVertices[dstIdx + 2] = m[2] * px + m[6] * py + m[10] * pz + m[14]

            for (let k = 3; k < vertexStride; k++) {
                totalVertices[dstIdx + k] = baseVertices[srcIdx + k] ?? 0
            }
        }

        for (let idx = 0; idx < indicesPerMesh; idx++) {
            totalIndices[indexOffset + idx] = (baseIndices[idx] ?? 0) + i * vertsPerMesh
        }
        i++
    }

    return {
        vertices: totalVertices,
        indices: totalIndices,
        count: instances.length
    }
}

/**
 * Batch sphere geometry for collectibles, power-ups, etc.
 *
 * @param {Float32Array} baseVertices  Sphere vertex buffer from createSphere()
 * @param {Uint16Array}  baseIndices   Sphere index buffer
 * @param {ReadonlyArray<{ position?: readonly number[], scale?: readonly number[], color?: readonly number[] }>} instances
 * @returns {BatchedGeometry}
 */
export function batchSphereGeometry(baseVertices, baseIndices, instances) {
    if (!instances || instances.length === 0) {
        return { vertices: baseVertices, indices: baseIndices, count: 1 }
    }

    // Sphere vertex layout from createSphere(): position(3) + normal(3) + uv(2) + tangent(4) = 12 floats
    // Actually let me check... sphere.js uses POSITION, TANGENTS, UV0
    // The CUBE_VERTICES uses position(3) + tangent(4) + uv(2) = 9 floats, but the code shows 11
    // Let's be safe and detect stride from vertex count vs buffer length
    const vertexStride = baseVertices.length > 0 && baseIndices.length > 0
        ? Math.floor(baseVertices.length / (Math.max(...baseIndices) + 1))
        : 12

    const vertsPerSphere = baseVertices.length / vertexStride
    const indicesPerSphere = baseIndices.length

    const totalVertices = new Float32Array(baseVertices.length * instances.length)
    const totalIndices = new Uint16Array(baseIndices.length * instances.length)

    // Same bounds argument as batchGeometry: the `?? 0` fallbacks never fire.
    let i = 0
    for (const inst of instances) {
        const pos = inst.position || [0, 0, 0]
        const scl = inst.scale || [1, 1, 1]

        const m = quatToMat4([0, 0, 0, 1], pos, scl)

        const vertexOffset = i * vertsPerSphere * vertexStride
        const indexOffset = i * indicesPerSphere

        for (let v = 0; v < vertsPerSphere; v++) {
            const srcIdx = v * vertexStride
            const dstIdx = vertexOffset + v * vertexStride

            const px = baseVertices[srcIdx] ?? 0
            const py = baseVertices[srcIdx + 1] ?? 0
            const pz = baseVertices[srcIdx + 2] ?? 0

            totalVertices[dstIdx]     = m[0] * px + m[4] * py + m[8]  * pz + m[12]
            totalVertices[dstIdx + 1] = m[1] * px + m[5] * py + m[9]  * pz + m[13]
            totalVertices[dstIdx + 2] = m[2] * px + m[6] * py + m[10] * pz + m[14]

            for (let k = 3; k < vertexStride; k++) {
                totalVertices[dstIdx + k] = baseVertices[srcIdx + k] ?? 0
            }
        }

        for (let idx = 0; idx < indicesPerSphere; idx++) {
            totalIndices[indexOffset + idx] = (baseIndices[idx] ?? 0) + i * vertsPerSphere
        }
        i++
    }

    return {
        vertices: totalVertices,
        indices: totalIndices,
        count: instances.length
    }
}

/**
 * Convert quaternion + position + scale to a 4x4 matrix (column-major for Filament/WebGL).
 * Inputs are full `[x, y, z, w]` / `[x, y, z]` arrays (see `BatchInstanceInput`).
 *
 * @param {readonly number[]} q
 * @param {readonly number[]} p
 * @param {readonly number[]} s
 * @returns {Mat4Tuple}
 */
function quatToMat4(q, p, s) {
    const x = q[0] ?? 0, y = q[1] ?? 0, z = q[2] ?? 0, w = q[3] ?? 0
    const sx = s[0] ?? 0, sy = s[1] ?? 0, sz = s[2] ?? 0
    const x2 = x + x, y2 = y + y, z2 = z + z
    const xx = x * x2, xy = x * y2, xz = x * z2
    const yy = y * y2, yz = y * z2, zz = z * z2
    const wx = w * x2, wy = w * y2, wz = w * z2

    return [
        (1.0 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0.0,
        (xy - wz) * sy, (1.0 - (xx + zz)) * sy, (yz + wx) * sy, 0.0,
        (xz + wy) * sz, (yz - wx) * sz, (1.0 - (xx + yy)) * sz, 0.0,
        p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, 1.0
    ]
}

/**
 * Build a batched Filament VertexBuffer and IndexBuffer from batched geometry data.
 *
 * @param {FilamentModule} Filament      The Filament namespace object
 * @param {FilamentHandle} engine        Filament engine instance
 * @param {{vertices: Float32Array, indices: Uint16Array}} batch
 * @param {number} vertexStride  Floats per vertex (e.g. 9 for cube)
 * @returns {{vb: FilamentHandle, ib: FilamentHandle}}
 */
export function buildBatchedBuffers(Filament, engine, batch, vertexStride) {
    const vb = Filament.VertexBuffer.Builder()
        .vertexCount(batch.vertices.length / vertexStride)
        .bufferCount(1)
        .attribute(Filament.VertexAttribute.POSITION, 0, Filament.VertexBuffer$AttributeType.FLOAT3, 0, vertexStride * 4)
        .attribute(Filament.VertexAttribute.TANGENTS, 0, Filament.VertexBuffer$AttributeType.FLOAT4, 12, vertexStride * 4)
        .attribute(Filament.VertexAttribute.UV0, 0, Filament.VertexBuffer$AttributeType.FLOAT2, 28, vertexStride * 4)
        .build(engine)

    vb.setBufferAt(engine, 0, batch.vertices)

    const ib = Filament.IndexBuffer.Builder()
        .indexCount(batch.indices.length)
        .bufferType(Filament.IndexBuffer$IndexType.USHORT)
        .build(engine)

    ib.setBuffer(engine, batch.indices)

    return { vb, ib }
}

/**
 * Create a single renderable entity from batched buffers.
 * This replaces `N` separate box entities with `1` entity.
 *
 * @param {FilamentHandle} engine
 * @param {FilamentHandle} scene
 * @param {FilamentModule} Filament
 * @param {FilamentHandle} vb
 * @param {FilamentHandle} ib
 * @param {FilamentHandle} materialInstance
 * @param {{ center?: readonly number[], halfExtent?: readonly number[] } | null} [boundingBox]
 * @returns {FilamentHandle} The new entity (already added to `scene`).
 */
export function createBatchedRenderable(engine, scene, Filament, vb, ib, materialInstance, boundingBox = null) {
    const entity = Filament.EntityManager.get().create()
    const bounds = boundingBox || { center: [0, 0, 0], halfExtent: [50, 50, 50] }

    Filament.RenderableManager.Builder(1)
        .boundingBox({
            center: bounds.center || [0, 0, 0],
            halfExtent: bounds.halfExtent || [50, 50, 50]
        })
        .material(0, materialInstance)
        .geometry(0, Filament['RenderableManager$PrimitiveType'].TRIANGLES, vb, ib)
        .receiveShadows(true)
        .castShadows(true)
        .build(engine, entity)

    scene.addEntity(entity)
    return entity
}

/**
 * @param {readonly BatchInstanceInput[]} instances
 * @returns {BatchBounds}
 */
export function computeBatchBounds(instances) {
    return computeMeshBatchBounds(null, null, instances, null, true)
}

/**
 * Compute an axis-aligned bounding box for batched mesh instances.
 * When base mesh data is provided, uses all transformed vertices; otherwise
 * falls back to a unit cube corner approximation (legacy box batching).
 *
 * @param {Float32Array | null} baseVertices
 * @param {Uint16Array | null} baseIndices
 * @param {readonly BatchInstanceInput[]} instances
 * @param {number | null} [vertexStride] Ignored by the unit-cube fallback.
 * @param {boolean} [unitCubeFallback]
 * @returns {BatchBounds}
 */
export function computeMeshBatchBounds(baseVertices, baseIndices, instances, vertexStride = 9, unitCubeFallback = false) {
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    // Without mesh data there is nothing to transform but the unit cube. (This
    // used to iterate a null corner list and throw when mesh data was missing
    // but the fallback flag was off.)
    const meshVertices = baseVertices && baseIndices && !unitCubeFallback ? baseVertices : null

    for (const inst of instances) {
        const pos = inst.position || [0, 0, 0]
        const rot = inst.rotation || [0, 0, 0, 1]
        const scl = inst.scale || [1, 1, 1]
        const m = quatToMat4(rot, pos, scl)

        if (meshVertices) {
            // A null stride with mesh data divided by zero (an endless loop); use the default.
            const stride = vertexStride ?? 9
            const vertsPerMesh = meshVertices.length / stride
            for (let v = 0; v < vertsPerMesh; v++) {
                const srcIdx = v * stride
                // srcIdx + 2 < meshVertices.length: the fallbacks never fire.
                const px = meshVertices[srcIdx] ?? 0
                const py = meshVertices[srcIdx + 1] ?? 0
                const pz = meshVertices[srcIdx + 2] ?? 0
                const wx = m[0] * px + m[4] * py + m[8] * pz + m[12]
                const wy = m[1] * px + m[5] * py + m[9] * pz + m[13]
                const wz = m[2] * px + m[6] * py + m[10] * pz + m[14]
                minX = Math.min(minX, wx)
                minY = Math.min(minY, wy)
                minZ = Math.min(minZ, wz)
                maxX = Math.max(maxX, wx)
                maxY = Math.max(maxY, wy)
                maxZ = Math.max(maxZ, wz)
            }
        } else {
            for (const corner of UNIT_CUBE_CORNERS) {
                const x = corner[0]
                const y = corner[1]
                const z = corner[2]
                const wx = m[0] * x + m[4] * y + m[8] * z + m[12]
                const wy = m[1] * x + m[5] * y + m[9] * z + m[13]
                const wz = m[2] * x + m[6] * y + m[10] * z + m[14]
                minX = Math.min(minX, wx)
                minY = Math.min(minY, wy)
                minZ = Math.min(minZ, wz)
                maxX = Math.max(maxX, wx)
                maxY = Math.max(maxY, wy)
                maxZ = Math.max(maxZ, wz)
            }
        }
    }

    if (!Number.isFinite(minX)) {
        return { center: [0, 0, 0], halfExtent: [1, 1, 1] }
    }

    return {
        center: [
            (minX + maxX) / 2,
            (minY + maxY) / 2,
            (minZ + maxZ) / 2,
        ],
        halfExtent: [
            Math.max(0.5, (maxX - minX) / 2),
            Math.max(0.5, (maxY - minY) / 2),
            Math.max(0.5, (maxZ - minZ) / 2),
        ]
    }
}
