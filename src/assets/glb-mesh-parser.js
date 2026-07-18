/**
 * Minimal GLB 2.0 parser for collision mesh extraction.
 * Used alongside Filament gltfio for rendering (same buffer, dual purpose).
 */

const GLB_MAGIC = 0x46546c67;

/**
 * @typedef {{ positions: Float32Array, indices: Uint32Array, name?: string }} ParsedMesh
 */

/**
 * @param {ArrayBuffer} buffer
 * @returns {ParsedMesh[]}
 */
export function parseGlbMeshes(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < 12) throw new Error('GLB too small');
    if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('Not a GLB file');

    let offset = 12;
    let json = null;
    let bin = null;

    while (offset + 8 <= view.byteLength) {
        const chunkLength = view.getUint32(offset, true);
        const chunkType = view.getUint32(offset + 4, true);
        offset += 8;
        const chunkData = new Uint8Array(buffer, offset, chunkLength);
        offset += chunkLength;

        if (chunkType === 0x4e4f534a) {
            json = JSON.parse(new TextDecoder().decode(chunkData));
        } else if (chunkType === 0x004e4942) {
            bin = chunkData;
        }
    }

    if (!json || !bin) throw new Error('GLB missing JSON or BIN chunk');

    const meshes = [];
    const gltfMeshes = json.meshes || [];
    for (let meshIndex = 0; meshIndex < gltfMeshes.length; meshIndex++) {
        const mesh = gltfMeshes[meshIndex];
        for (const primitive of mesh.primitives || []) {
            if (primitive.mode !== undefined && primitive.mode !== 4) continue;
            const positions = readAccessor(json, bin, primitive.attributes?.POSITION, Float32Array);
            const indices = primitive.indices !== undefined
                ? readAccessor(json, bin, primitive.indices, Uint32Array)
                : generateSequentialIndices(positions.length / 3);
            if (!positions || positions.length < 9) continue;
            meshes.push({
                name: mesh.name || `mesh_${meshIndex}`,
                positions,
                indices,
            });
        }
    }

    if (meshes.length === 0) throw new Error('GLB contains no triangle meshes');
    return meshes;
}

/**
 * @param {object} json
 * @param {Uint8Array} bin
 * @param {number | undefined} accessorIndex
 * @param {typeof Float32Array | typeof Uint32Array} ArrayType
 */
function readAccessor(json, bin, accessorIndex, ArrayType) {
    if (accessorIndex === undefined) return null;
    const accessor = json.accessors?.[accessorIndex];
    if (!accessor) throw new Error(`Missing accessor ${accessorIndex}`);

    const bufferView = json.bufferViews?.[accessor.bufferView];
    if (!bufferView) throw new Error(`Missing bufferView for accessor ${accessorIndex}`);

    const byteOffset = (accessor.byteOffset || 0) + (bufferView.byteOffset || 0);
    const componentSize = componentBytes(accessor.componentType);
    const numComponents = numComponentsForType(accessor.type);
    const stride = bufferView.byteStride || componentSize * numComponents;
    const count = accessor.count;

    if (stride === componentSize * numComponents) {
        const totalBytes = count * stride;
        const slice = bin.subarray(byteOffset, byteOffset + totalBytes);
        return normalizeAccessorArray(ArrayType, accessor, slice);
    }

    const out = new ArrayType(count * numComponents);
    for (let i = 0; i < count; i++) {
        const base = byteOffset + i * stride;
        for (let c = 0; c < numComponents; c++) {
            out[i * numComponents + c] = readComponent(bin, base + c * componentSize, accessor.componentType);
        }
    }
    return out;
}

function normalizeAccessorArray(ArrayType, accessor, slice) {
    if (ArrayType === Float32Array && accessor.componentType === 5126) {
        return new Float32Array(slice.buffer, slice.byteOffset, slice.byteLength / 4);
    }
    if (ArrayType === Uint32Array && accessor.componentType === 5125) {
        return new Uint32Array(slice.buffer, slice.byteOffset, slice.byteLength / 4);
    }
    if (ArrayType === Uint32Array && accessor.componentType === 5123) {
        const src = new Uint16Array(slice.buffer, slice.byteOffset, slice.byteLength / 2);
        const out = new Uint32Array(src.length);
        for (let i = 0; i < src.length; i++) out[i] = src[i];
        return out;
    }
    if (ArrayType === Float32Array && accessor.componentType === 5123) {
        const src = new Uint16Array(slice.buffer, slice.byteOffset, slice.byteLength / 2);
        const out = new Float32Array(src.length);
        for (let i = 0; i < src.length; i++) out[i] = src[i];
        return out;
    }
    throw new Error(`Unsupported accessor combo: ${accessor.componentType} -> ${ArrayType.name}`);
}

function readComponent(bin, offset, componentType) {
    const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    switch (componentType) {
        case 5126: return view.getFloat32(offset, true);
        case 5125: return view.getUint32(offset, true);
        case 5123: return view.getUint16(offset, true);
        case 5121: return view.getUint8(offset);
        default: throw new Error(`Unsupported component type ${componentType}`);
    }
}

function componentBytes(componentType) {
    switch (componentType) {
        case 5126: return 4;
        case 5125: return 4;
        case 5123: return 2;
        case 5121: return 1;
        default: throw new Error(`Unsupported component type ${componentType}`);
    }
}

function numComponentsForType(type) {
    switch (type) {
        case 'SCALAR': return 1;
        case 'VEC2': return 2;
        case 'VEC3': return 3;
        case 'VEC4': return 4;
        default: throw new Error(`Unsupported accessor type ${type}`);
    }
}

function generateSequentialIndices(vertexCount) {
    const indices = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) indices[i] = i;
    return indices;
}

/**
 * Merge multiple meshes into one for a single Rapier trimesh collider.
 * @param {ParsedMesh[]} meshes
 */
export function mergeMeshes(meshes) {
    let totalVerts = 0;
    let totalIndices = 0;
    for (const mesh of meshes) {
        totalVerts += mesh.positions.length;
        totalIndices += mesh.indices.length;
    }

    const positions = new Float32Array(totalVerts);
    const indices = new Uint32Array(totalIndices);
    let vOffset = 0;
    let iOffset = 0;
    let vertexBase = 0;

    for (const mesh of meshes) {
        positions.set(mesh.positions, vOffset);
        vOffset += mesh.positions.length;
        for (let i = 0; i < mesh.indices.length; i++) {
            indices[iOffset + i] = mesh.indices[i] + vertexBase;
        }
        iOffset += mesh.indices.length;
        vertexBase += mesh.positions.length / 3;
    }

    return { positions, indices };
}

/**
 * Apply uniform scale and Y-axis rotation to mesh vertices (for collider alignment).
 * @param {Float32Array} positions
 * @param {number} scale
 * @param {number} rotY
 */
export function transformPositions(positions, scale = 1, rotY = 0) {
    if (scale === 1 && rotY === 0) return positions;
    const out = new Float32Array(positions.length);
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i] * scale;
        const y = positions[i + 1] * scale;
        const z = positions[i + 2] * scale;
        out[i] = x * cosY + z * sinY;
        out[i + 1] = y;
        out[i + 2] = -x * sinY + z * cosY;
    }
    return out;
}

/**
 * @param {Float32Array} positions
 */
export function computeMeshBounds(positions) {
    let minX = Infinity; let minY = Infinity; let minZ = Infinity;
    let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
    }
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const hx = (maxX - minX) * 0.5;
    const hy = (maxY - minY) * 0.5;
    const hz = (maxZ - minZ) * 0.5;
    return {
        center: [cx, cy, cz],
        halfExtent: [hx, hy, hz],
        radius: Math.hypot(hx, hy, hz),
    };
}
