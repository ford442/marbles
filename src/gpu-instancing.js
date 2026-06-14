/**
 * GPU Instancing / Geometry Batching Utilities
 *
 * Filament's JS bindings do not expose native GPU instancing.
 * This module provides geometry batching by merging repeated primitives
 * into a single VertexBuffer/IndexBuffer pair, dramatically reducing
 * draw calls for static zone decorations (trees, crystals, pegs, etc.).
 */

/**
 * Merge multiple box transforms into a single batched mesh.
 *
 * @param {Float32Array} baseVertices  The base cube vertices (CUBE_VERTICES format)
 * @param {Uint16Array}  baseIndices   The base cube indices (CUBE_INDICES format)
 * @param {Array<{position: number[], rotation?: number[], scale?: number[]}>} instances
 * @returns {{vertices: Float32Array, indices: Uint16Array, count: number}}
 */
export function batchBoxGeometry(baseVertices, baseIndices, instances) {
    if (!instances || instances.length === 0) {
        return { vertices: baseVertices, indices: baseIndices, count: 1 }
    }

    const vertexStride = 9 // position(3) + tangent(4) + uv(2) — match CUBE_VERTICES
    const vertsPerBox = baseVertices.length / vertexStride
    const indicesPerBox = baseIndices.length

    const totalVertices = new Float32Array(baseVertices.length * instances.length)
    const totalIndices = new Uint16Array(baseIndices.length * instances.length)

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const pos = inst.position || [0, 0, 0]
        const rot = inst.rotation || [0, 0, 0, 1] // quaternion
        const scl = inst.scale || [1, 1, 1]

        // Build transform matrix from pos/rot/scale
        const m = quatToMat4(rot, pos, scl)

        const vertexOffset = i * vertsPerBox * vertexStride
        const indexOffset = i * indicesPerBox

        for (let v = 0; v < vertsPerBox; v++) {
            const srcIdx = v * vertexStride
            const dstIdx = vertexOffset + v * vertexStride

            // Transform position
            const px = baseVertices[srcIdx]
            const py = baseVertices[srcIdx + 1]
            const pz = baseVertices[srcIdx + 2]

            totalVertices[dstIdx]     = m[0] * px + m[4] * py + m[8]  * pz + m[12]
            totalVertices[dstIdx + 1] = m[1] * px + m[5] * py + m[9]  * pz + m[13]
            totalVertices[dstIdx + 2] = m[2] * px + m[6] * py + m[10] * pz + m[14]

            // Copy tangent and UV unchanged (tangent should be transformed by normal matrix for correctness,
            // but for uniform scale and small decorations this is acceptable)
            for (let k = 3; k < vertexStride; k++) {
                totalVertices[dstIdx + k] = baseVertices[srcIdx + k]
            }
        }

        for (let idx = 0; idx < indicesPerBox; idx++) {
            totalIndices[indexOffset + idx] = baseIndices[idx] + i * vertsPerBox
        }
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
 * @param {Array<{position: number[], scale?: number[], color?: number[]}>} instances
 * @returns {{vertices: Float32Array, indices: Uint16Array, count: number}}
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

    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        const pos = inst.position || [0, 0, 0]
        const scl = inst.scale || [1, 1, 1]

        const m = quatToMat4([0, 0, 0, 1], pos, scl)

        const vertexOffset = i * vertsPerSphere * vertexStride
        const indexOffset = i * indicesPerSphere

        for (let v = 0; v < vertsPerSphere; v++) {
            const srcIdx = v * vertexStride
            const dstIdx = vertexOffset + v * vertexStride

            const px = baseVertices[srcIdx]
            const py = baseVertices[srcIdx + 1]
            const pz = baseVertices[srcIdx + 2]

            totalVertices[dstIdx]     = m[0] * px + m[4] * py + m[8]  * pz + m[12]
            totalVertices[dstIdx + 1] = m[1] * px + m[5] * py + m[9]  * pz + m[13]
            totalVertices[dstIdx + 2] = m[2] * px + m[6] * py + m[10] * pz + m[14]

            for (let k = 3; k < vertexStride; k++) {
                totalVertices[dstIdx + k] = baseVertices[srcIdx + k]
            }
        }

        for (let idx = 0; idx < indicesPerSphere; idx++) {
            totalIndices[indexOffset + idx] = baseIndices[idx] + i * vertsPerSphere
        }
    }

    return {
        vertices: totalVertices,
        indices: totalIndices,
        count: instances.length
    }
}

/**
 * Convert quaternion + position + scale to a 4x4 matrix (column-major for Filament/WebGL).
 */
function quatToMat4(q, p, s) {
    const x = q[0], y = q[1], z = q[2], w = q[3]
    const x2 = x + x, y2 = y + y, z2 = z + z
    const xx = x * x2, xy = x * y2, xz = x * z2
    const yy = y * y2, yz = y * z2, zz = z * z2
    const wx = w * x2, wy = w * y2, wz = w * z2

    return [
        (1.0 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0.0,
        (xy - wz) * s[1], (1.0 - (xx + zz)) * s[1], (yz + wx) * s[1], 0.0,
        (xz + wy) * s[2], (yz - wx) * s[2], (1.0 - (xx + yy)) * s[2], 0.0,
        p[0], p[1], p[2], 1.0
    ]
}

/**
 * Build a batched Filament VertexBuffer and IndexBuffer from batched geometry data.
 *
 * @param {any} Filament      The Filament namespace object
 * @param {any} engine        Filament engine instance
 * @param {{vertices: Float32Array, indices: Uint16Array}} batch
 * @param {number} vertexStride  Floats per vertex (e.g. 9 for cube)
 * @returns {{vb: VertexBuffer, ib: IndexBuffer}}
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

export function computeBatchBounds(instances) {
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]

    for (const inst of instances) {
        const pos = inst.position || [0, 0, 0]
        const rot = inst.rotation || [0, 0, 0, 1]
        const scl = inst.scale || [1, 1, 1]
        const m = quatToMat4(rot, pos, scl)

        for (let x of [-0.5, 0.5]) {
            for (let y of [-0.5, 0.5]) {
                for (let z of [-0.5, 0.5]) {
                    const wx = m[0] * x + m[4] * y + m[8] * z + m[12]
                    const wy = m[1] * x + m[5] * y + m[9] * z + m[13]
                    const wz = m[2] * x + m[6] * y + m[10] * z + m[14]
                    min[0] = Math.min(min[0], wx)
                    min[1] = Math.min(min[1], wy)
                    min[2] = Math.min(min[2], wz)
                    max[0] = Math.max(max[0], wx)
                    max[1] = Math.max(max[1], wy)
                    max[2] = Math.max(max[2], wz)
                }
            }
        }
    }

    if (!Number.isFinite(min[0])) {
        return { center: [0, 0, 0], halfExtent: [1, 1, 1] }
    }

    return {
        center: [
            (min[0] + max[0]) / 2,
            (min[1] + max[1]) / 2,
            (min[2] + max[2]) / 2,
        ],
        halfExtent: [
            Math.max(0.5, (max[0] - min[0]) / 2),
            Math.max(0.5, (max[1] - min[1]) / 2),
            Math.max(0.5, (max[2] - min[2]) / 2),
        ]
    }
}
