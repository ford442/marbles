// @ts-check
/**
 * wasm-bridge.js
 *
 * JavaScript façade for the MarblePhysics C++ WebAssembly module.
 *
 * Usage
 * ─────
 *   import { initMarblePhysicsWasm, getMarblePhysics, FORCE_BATCH_THRESHOLD } from './wasm-bridge.js';
 *
 *   // Call once during game initialisation:
 *   await initMarblePhysicsWasm();
 *
 *   // Call anywhere in the game loop:
 *   const physics = getMarblePhysics();
 *   const force = physics.computeForceField(...);
 *   physics.computeForceFieldsBatch(positions, strengths, out, count, ...);
 *
 * If the WASM binary cannot be loaded (e.g. Emscripten build hasn't run yet,
 * or a Content-Security-Policy blocks it) the module transparently falls back
 * to equivalent pure-JavaScript implementations so the game keeps running.
 *
 * Adding new functions
 * ────────────────────
 *   1. Implement in wasm/marble_physics.cpp + register in EMSCRIPTEN_BINDINGS.
 *   2. Add a matching entry under `jsFallback` below.
 *   3. Re-run `npm run build:wasm`.
 */

/** @typedef {import('./types/wasm-physics.js').MarblePhysicsApi} MarblePhysicsApi */
/** @typedef {import('./types/wasm-physics.js').MarblePhysicsWasmModule} MarblePhysicsWasmModule */
/** @typedef {import('./types/geometry.js').Vec3} Vec3 */

/** Use batched force-field evaluation when entity count exceeds this threshold. */
export const FORCE_BATCH_THRESHOLD = 8;

/**
 * Minimum entity count before WASM HEAPF32 batch copy pays off over JS batch.
 * See docs/PERFORMANCE_BASELINE.md (crossover ~200 entities in Node micro-bench).
 */
export const WASM_HEAP_BATCH_MIN = 200;

const WASM_MODULE_URL = '/wasm/marble_physics.js';
const WASM_BINARY_URL = '/wasm/marble_physics.wasm';

// ── Pure-JS fallbacks ─────────────────────────────────────────────────────────

/**
 * @param {number} fieldX
 * @param {number} fieldY
 * @param {number} fieldZ
 * @param {number} marbleX
 * @param {number} marbleY
 * @param {number} marbleZ
 * @param {number} strength
 * @param {number} falloffExp
 * @param {number} minDist
 * @param {number} maxDist
 * @param {number} [softening]
 * @returns {Vec3}
 */
function computeForceFieldScalar(
    fieldX, fieldY, fieldZ,
    marbleX, marbleY, marbleZ,
    strength, falloffExp, minDist, maxDist,
    softening = 0,
) {
    const dx = fieldX - marbleX;
    const dy = fieldY - marbleY;
    const dz = fieldZ - marbleZ;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist > maxDist || dist < 1e-6) return { x: 0, y: 0, z: 0 };

    const clampedDist = Math.max(dist, minDist);
    const falloff = Math.pow(clampedDist, falloffExp) + softening;
    const forceMag = strength / falloff;

    return {
        x: (dx / dist) * forceMag,
        y: (dy / dist) * forceMag,
        z: (dz / dist) * forceMag
    };
}

/**
 * @param {number} vx
 * @param {number} vy
 * @param {number} vz
 * @param {number} dampingFactor
 * @param {number} dt
 * @param {number} maxSpeed
 * @returns {Vec3}
 */
function applyVelocityDampingScalar(vx, vy, vz, dampingFactor, dt, maxSpeed) {
    const decay = 1.0 - Math.min(Math.max(dampingFactor * dt, 0), 1);
    let nx = vx * decay, ny = vy * decay, nz = vz * decay;
    if (maxSpeed > 0) {
        const speed = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (speed > maxSpeed) {
            const s = maxSpeed / speed;
            nx *= s; ny *= s; nz *= s;
        }
    }
    return { x: nx, y: ny, z: nz };
}

/** @type {MarblePhysicsApi} */
const jsFallback = {
    /** Euclidean distance between two 3-D points. */
    vec3Distance(ax, ay, az, bx, by, bz) {
        const dx = bx - ax, dy = by - ay, dz = bz - az;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },

    /** Squared distance (avoids a sqrt when only comparisons are needed). */
    vec3DistanceSq(ax, ay, az, bx, by, bz) {
        const dx = bx - ax, dy = by - ay, dz = bz - az;
        return dx * dx + dy * dy + dz * dz;
    },

    /** Dot product of two 3-D vectors. */
    vec3Dot(ax, ay, az, bx, by, bz) {
        return ax * bx + ay * by + az * bz;
    },

    /** Length (magnitude) of a 3-D vector. */
    vec3Length(x, y, z) {
        return Math.sqrt(x * x + y * y + z * z);
    },

    /** Normalises a 3-D vector to unit length.  Returns {x, y, z}. */
    vec3Normalize(x, y, z) {
        const len = Math.sqrt(x * x + y * y + z * z);
        if (len < 1e-8) return { x: 0, y: 0, z: 0 };
        return { x: x / len, y: y / len, z: z / len };
    },

    /**
     * Applies per-frame exponential velocity damping and an optional speed cap.
     *
     * @param {number} vx/vy/vz      Current velocity components.
     * @param {number} dampingFactor Damping coefficient (0 = none, 1 = full stop).
     * @param {number} dt            Frame delta-time in seconds.
     * @param {number} maxSpeed      Speed cap (0 = unlimited).
     * @returns {Vec3}
     */
    applyVelocityDamping(vx, vy, vz, dampingFactor, dt, maxSpeed) {
        return applyVelocityDampingScalar(vx, vy, vz, dampingFactor, dt, maxSpeed);
    },

    /**
     * Batched velocity damping over xyz triplets in TypedArrays.
     *
     * @param {Float32Array} velocities length count * 3
     * @param {Float32Array} out        length count * 3 (may alias velocities)
     * @param {number} count
     */
    applyVelocityDampingBatch(velocities, out, count, dampingFactor, dt, maxSpeed) {
        for (let i = 0; i < count; i++) {
            const base = i * 3;
            const damped = applyVelocityDampingScalar(
                velocities[base] ?? 0, velocities[base + 1] ?? 0, velocities[base + 2] ?? 0,
                dampingFactor, dt, maxSpeed
            );
            out[base] = damped.x;
            out[base + 1] = damped.y;
            out[base + 2] = damped.z;
        }
    },

    /**
     * Inverse-power-law force field impulse (attraction or repulsion).
     *
     * @param {number} fieldX/Y/Z  Origin of the force field.
     * @param {number} marbleX/Y/Z Position of the marble.
     * @param {number} strength    Positive = attract, negative = repel.
     * @param {number} falloffExp  Distance exponent (2 = inverse-square law).
     * @param {number} minDist     Minimum clamped distance to avoid singularity.
     * @param {number} maxDist     Effective radius; force = 0 beyond this.
     * @param {number} softening   Added to falloff denominator (magnet uses 1).
     * @returns {Vec3}
     */
    computeForceField(fieldX, fieldY, fieldZ,
                      marbleX, marbleY, marbleZ,
                      strength, falloffExp, minDist, maxDist, softening = 0) {
        return computeForceFieldScalar(
            fieldX, fieldY, fieldZ,
            marbleX, marbleY, marbleZ,
            strength, falloffExp, minDist, maxDist, softening
        );
    },

    /**
     * Writes force xyz into `out` (length ≥ 3) without allocating a result object.
     *
     * @param {Float32Array | number[]} out
     */
    computeForceFieldInto(out,
                          fieldX, fieldY, fieldZ,
                          marbleX, marbleY, marbleZ,
                          strength, falloffExp, minDist, maxDist, softening = 0) {
        const force = computeForceFieldScalar(
            fieldX, fieldY, fieldZ,
            marbleX, marbleY, marbleZ,
            strength, falloffExp, minDist, maxDist, softening
        );
        out[0] = force.x;
        out[1] = force.y;
        out[2] = force.z;
    },

    /**
     * Batched force-field evaluation.
     *
     * @param {Float32Array} positions length count * 3
     * @param {Float32Array} strengths length count
     * @param {Float32Array} out       length count * 3
     * @param {number} count
     */
    computeForceFieldsBatch(positions, strengths, out, count,
                            fieldX, fieldY, fieldZ,
                            falloffExp, minDist, maxDist, softening = 0) {
        for (let i = 0; i < count; i++) {
            const base = i * 3;
            const strengthAt = strengths[i] ?? 0;
            const force = computeForceFieldScalar(
                fieldX, fieldY, fieldZ,
                positions[base] ?? 0, positions[base + 1] ?? 0, positions[base + 2] ?? 0,
                strengthAt, falloffExp, minDist, maxDist, softening
            );
            out[base] = force.x;
            out[base + 1] = force.y;
            out[base + 2] = force.z;
        }
    },

    /**
     * Hooke's-law spring force with velocity damping along the spring axis.
     *
     * @param {number} marbleX/Y/Z  Marble world position.
     * @param {number} anchorX/Y/Z  Anchor (fixed) world position.
     * @param {number} restLength   Natural length of the spring.
     * @param {number} stiffness    Spring constant k (N/m).
     * @param {number} damping      Damping coefficient c (N·s/m).
     * @param {number} velX/Y/Z     Marble velocity.
     * @returns {Vec3}
     */
    computeSpringForce(marbleX, marbleY, marbleZ,
                       anchorX, anchorY, anchorZ,
                       restLength, stiffness, damping,
                       velX, velY, velZ) {
        const dx = anchorX - marbleX;
        const dy = anchorY - marbleY;
        const dz = anchorZ - marbleZ;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 1e-6) return { x: 0, y: 0, z: 0 };

        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        const extension = dist - restLength;
        const velAlongAxis = velX * nx + velY * ny + velZ * nz;
        const fMag = stiffness * extension - damping * velAlongAxis;

        return { x: nx * fMag, y: ny * fMag, z: nz * fMag };
    },

    /**
     * Batched spring forces.
     *
     * @param {Float32Array} positions   length count * 3
     * @param {Float32Array} anchors     length count * 3
     * @param {Float32Array} velocities  length count * 3
     * @param {Float32Array} restLengths length count
     * @param {Float32Array} stiffnesses length count
     * @param {Float32Array} dampings    length count
     * @param {Float32Array} out         length count * 3
     * @param {number} count
     */
    computeSpringForcesBatch(positions, anchors, velocities,
                               restLengths, stiffnesses, dampings, out, count) {
        for (let i = 0; i < count; i++) {
            const base = i * 3;
            const force = this.computeSpringForce(
                positions[base] ?? 0, positions[base + 1] ?? 0, positions[base + 2] ?? 0,
                anchors[base] ?? 0, anchors[base + 1] ?? 0, anchors[base + 2] ?? 0,
                restLengths[i] ?? 0, stiffnesses[i] ?? 0, dampings[i] ?? 0,
                velocities[base] ?? 0, velocities[base + 1] ?? 0, velocities[base + 2] ?? 0
            );
            out[base] = force.x;
            out[base + 1] = force.y;
            out[base + 2] = force.z;
        }
    },

    /**
     * Batched closest-point-on-segment.
     *
     * @param {Float32Array} p0  length count * 3
     * @param {Float32Array} p1  length count * 3
     * @param {Float32Array} q   length count * 3
     * @param {Float32Array} out length count * 3
     * @param {number} count
     */
    closestPointsOnSegmentBatch(p0, p1, q, out, count) {
        for (let i = 0; i < count; i++) {
            const base = i * 3;
            const point = this.closestPointOnSegment(
                p0[base] ?? 0, p0[base + 1] ?? 0, p0[base + 2] ?? 0,
                p1[base] ?? 0, p1[base + 1] ?? 0, p1[base + 2] ?? 0,
                q[base] ?? 0, q[base + 1] ?? 0, q[base + 2] ?? 0
            );
            out[base] = point.x;
            out[base + 1] = point.y;
            out[base + 2] = point.z;
        }
    },

    /**
     * Reflects a velocity vector off a surface normal.
     *   v' = v − (1 + restitution)(v · n) n
     *
     * @param {number} vx/vy/vz     Incoming velocity.
     * @param {number} nx/ny/nz     Unit surface normal.
     * @param {number} restitution  0 = inelastic, 1 = fully elastic.
     * @returns {Vec3}
     */
    reflectVelocity(vx, vy, vz, nx, ny, nz, restitution) {
        const dot = vx * nx + vy * ny + vz * nz;
        const scale = (1 + restitution) * dot;
        return {
            x: vx - scale * nx,
            y: vy - scale * ny,
            z: vz - scale * nz
        };
    },

    /**
     * Closest point on segment p0→p1 to query point q.
     * Useful for grapple-hook and rail-slide mechanics.
     *
     * @returns {Vec3}
     */
    closestPointOnSegment(p0x, p0y, p0z, p1x, p1y, p1z, qx, qy, qz) {
        const dx = p1x - p0x, dy = p1y - p0y, dz = p1z - p0z;
        const lenSq = dx * dx + dy * dy + dz * dz;
        if (lenSq < 1e-12) return { x: p0x, y: p0y, z: p0z };

        const t = Math.min(1, Math.max(0,
            ((qx - p0x) * dx + (qy - p0y) * dy + (qz - p0z) * dz) / lenSq));
        return { x: p0x + t * dx, y: p0y + t * dy, z: p0z + t * dz };
    }
};

// ── WASM batch runner (HEAPF32 views) ─────────────────────────────────────────

class WasmBatchRunner {
    /**
     * @param {MarblePhysicsWasmModule} wasmModule
     */
    constructor(wasmModule) {
        this._mod = wasmModule;
        this._malloc = wasmModule._malloc;
        this._free = wasmModule._free;
        this._heap = wasmModule.HEAPF32;
        this._positionsPtr = 0;
        this._strengthsPtr = 0;
        this._forcesPtr = 0;
        this._velocitiesPtr = 0;
        this._anchorsPtr = 0;
        this._restLengthsPtr = 0;
        this._stiffnessesPtr = 0;
        this._dampingsPtr = 0;
        this._p0Ptr = 0;
        this._p1Ptr = 0;
        this._qPtr = 0;
        this._capacity = 0;
        this._scalarOutPtr = this._malloc(12);
        this._scalarOutView = new Float32Array(
            wasmModule.HEAPF32.buffer, this._scalarOutPtr, 3
        );
    }

    /**
     * @param {number} count
     */
    _ensureCapacity(count) {
        if (count <= this._capacity) return;

        this._freeBuffers();
        const posBytes = count * 3 * 4;
        const strBytes = count * 4;
        const forceBytes = count * 3 * 4;

        this._positionsPtr = this._malloc(posBytes);
        this._strengthsPtr = this._malloc(strBytes);
        this._forcesPtr = this._malloc(forceBytes);
        this._velocitiesPtr = this._malloc(forceBytes);
        this._anchorsPtr = this._malloc(posBytes);
        this._restLengthsPtr = this._malloc(strBytes);
        this._stiffnessesPtr = this._malloc(strBytes);
        this._dampingsPtr = this._malloc(strBytes);
        this._p0Ptr = this._malloc(posBytes);
        this._p1Ptr = this._malloc(posBytes);
        this._qPtr = this._malloc(posBytes);
        this._capacity = count;
    }

    _freeBuffers() {
        if (!this._mod) return;
        if (this._positionsPtr) this._free(this._positionsPtr);
        if (this._strengthsPtr) this._free(this._strengthsPtr);
        if (this._forcesPtr) this._free(this._forcesPtr);
        if (this._velocitiesPtr) this._free(this._velocitiesPtr);
        if (this._anchorsPtr) this._free(this._anchorsPtr);
        if (this._restLengthsPtr) this._free(this._restLengthsPtr);
        if (this._stiffnessesPtr) this._free(this._stiffnessesPtr);
        if (this._dampingsPtr) this._free(this._dampingsPtr);
        if (this._p0Ptr) this._free(this._p0Ptr);
        if (this._p1Ptr) this._free(this._p1Ptr);
        if (this._qPtr) this._free(this._qPtr);
        this._positionsPtr = 0;
        this._strengthsPtr = 0;
        this._forcesPtr = 0;
        this._velocitiesPtr = 0;
        this._anchorsPtr = 0;
        this._restLengthsPtr = 0;
        this._stiffnessesPtr = 0;
        this._dampingsPtr = 0;
        this._p0Ptr = 0;
        this._p1Ptr = 0;
        this._qPtr = 0;
        this._capacity = 0;
    }

    /**
     * @param {number} fieldX
     * @param {number} fieldY
     * @param {number} fieldZ
     * @param {number} marbleX
     * @param {number} marbleY
     * @param {number} marbleZ
     * @param {number} strength
     * @param {number} falloffExp
     * @param {number} minDist
     * @param {number} maxDist
     * @param {number} [softening]
     * @returns {Float32Array} reusable 3-float view (valid until next scalar Out call)
     */
    computeForceFieldOut(fieldX, fieldY, fieldZ,
                         marbleX, marbleY, marbleZ,
                         strength, falloffExp, minDist, maxDist, softening = 0) {
        this._mod.computeForceFieldOut(
            this._scalarOutPtr,
            fieldX, fieldY, fieldZ,
            marbleX, marbleY, marbleZ,
            strength, falloffExp, minDist, maxDist, softening
        );
        return this._scalarOutView;
    }

    /**
     * @param {Float32Array | number[]} out length ≥ 3
     */
    computeForceFieldInto(out, fieldX, fieldY, fieldZ,
                          marbleX, marbleY, marbleZ,
                          strength, falloffExp, minDist, maxDist, softening = 0) {
        const view = this.computeForceFieldOut(
            fieldX, fieldY, fieldZ,
            marbleX, marbleY, marbleZ,
            strength, falloffExp, minDist, maxDist, softening
        );
        out[0] = view[0];
        out[1] = view[1];
        out[2] = view[2];
    }

    /**
     * @param {Float32Array} positions
     * @param {Float32Array} strengths
     * @param {Float32Array} out
     * @param {number} count
     * @param {number} fieldX
     * @param {number} fieldY
     * @param {number} fieldZ
     * @param {number} falloffExp
     * @param {number} minDist
     * @param {number} maxDist
     * @param {number} [softening]
     */
    computeForceFieldsBatch(positions, strengths, out, count,
                            fieldX, fieldY, fieldZ,
                            falloffExp, minDist, maxDist, softening = 0) {
        this._ensureCapacity(count);

        const heap = this._heap;
        const posOffset = this._positionsPtr >> 2;
        const strOffset = this._strengthsPtr >> 2;
        const outOffset = this._forcesPtr >> 2;

        heap.set(positions.subarray(0, count * 3), posOffset);
        heap.set(strengths.subarray(0, count), strOffset);

        this._mod.computeForceFieldsBatch(
            this._positionsPtr, this._strengthsPtr, this._forcesPtr, count,
            fieldX, fieldY, fieldZ, falloffExp, minDist, maxDist, softening
        );

        out.set(heap.subarray(outOffset, outOffset + count * 3));
    }

    /**
     * @param {Float32Array} positions
     * @param {Float32Array} anchors
     * @param {Float32Array} velocities
     * @param {Float32Array} restLengths
     * @param {Float32Array} stiffnesses
     * @param {Float32Array} dampings
     * @param {Float32Array} out
     * @param {number} count
     */
    computeSpringForcesBatch(positions, anchors, velocities,
                               restLengths, stiffnesses, dampings, out, count) {
        this._ensureCapacity(count);

        const heap = this._heap;
        const posOffset = this._positionsPtr >> 2;
        const anchorOffset = this._anchorsPtr >> 2;
        const velOffset = this._velocitiesPtr >> 2;
        const restOffset = this._restLengthsPtr >> 2;
        const stiffOffset = this._stiffnessesPtr >> 2;
        const dampOffset = this._dampingsPtr >> 2;
        const outOffset = this._forcesPtr >> 2;

        heap.set(positions.subarray(0, count * 3), posOffset);
        heap.set(anchors.subarray(0, count * 3), anchorOffset);
        heap.set(velocities.subarray(0, count * 3), velOffset);
        heap.set(restLengths.subarray(0, count), restOffset);
        heap.set(stiffnesses.subarray(0, count), stiffOffset);
        heap.set(dampings.subarray(0, count), dampOffset);

        this._mod.computeSpringForcesBatch(
            this._positionsPtr, this._anchorsPtr, this._velocitiesPtr,
            this._restLengthsPtr, this._stiffnessesPtr, this._dampingsPtr,
            this._forcesPtr, count
        );

        out.set(heap.subarray(outOffset, outOffset + count * 3));
    }

    /**
     * @param {Float32Array} p0
     * @param {Float32Array} p1
     * @param {Float32Array} q
     * @param {Float32Array} out
     * @param {number} count
     */
    closestPointsOnSegmentBatch(p0, p1, q, out, count) {
        this._ensureCapacity(count);

        const heap = this._heap;
        const p0Offset = this._p0Ptr >> 2;
        const p1Offset = this._p1Ptr >> 2;
        const qOffset = this._qPtr >> 2;
        const outOffset = this._forcesPtr >> 2;

        heap.set(p0.subarray(0, count * 3), p0Offset);
        heap.set(p1.subarray(0, count * 3), p1Offset);
        heap.set(q.subarray(0, count * 3), qOffset);

        this._mod.closestPointsOnSegmentBatch(
            this._p0Ptr, this._p1Ptr, this._qPtr, this._forcesPtr, count
        );

        out.set(heap.subarray(outOffset, outOffset + count * 3));
    }

    /**
     * @param {Float32Array} velocities
     * @param {Float32Array} out
     * @param {number} count
     * @param {number} dampingFactor
     * @param {number} dt
     * @param {number} maxSpeed
     */
    applyVelocityDampingBatch(velocities, out, count, dampingFactor, dt, maxSpeed) {
        this._ensureCapacity(count);

        const heap = this._heap;
        const velOffset = this._velocitiesPtr >> 2;
        const outOffset = this._forcesPtr >> 2;

        heap.set(velocities.subarray(0, count * 3), velOffset);

        this._mod.applyVelocityDampingBatch(
            this._velocitiesPtr, this._forcesPtr, count, dampingFactor, dt, maxSpeed
        );

        out.set(heap.subarray(outOffset, outOffset + count * 3));
    }
}

// ── Module state ──────────────────────────────────────────────────────────────

/** @type {MarblePhysicsWasmModule | null} */
let _wasmApi = null;
/** @type {WasmBatchRunner | null} */
let _wasmBatch = null;
/** @type {MarblePhysicsApi | null} */
let _physicsApi = null;
/** @type {Promise<boolean> | null} */
let _initPromise = null;
let _usingWasm = false;
/** @type {'pending' | 'wasm' | 'js-fallback'} */
let _physicsBackend = 'pending';

/**
 * @param {number} count
 * @returns {boolean}
 */
function shouldUseWasmHeapBatch(count) {
    return count >= WASM_HEAP_BATCH_MIN;
}

/** @returns {MarblePhysicsApi} */
function buildPhysicsApi() {
    if (_usingWasm && _wasmApi && _wasmBatch) {
        const wasmApi = _wasmApi;
        const wasmBatch = _wasmBatch;
        return {
            vec3Distance: wasmApi.vec3Distance.bind(wasmApi),
            vec3DistanceSq: wasmApi.vec3DistanceSq.bind(wasmApi),
            vec3Dot: wasmApi.vec3Dot.bind(wasmApi),
            vec3Length: wasmApi.vec3Length.bind(wasmApi),
            vec3Normalize: wasmApi.vec3Normalize.bind(wasmApi),
            applyVelocityDamping: (...args) => {
                wasmApi.applyVelocityDampingOut(wasmBatch._scalarOutPtr, ...args);
                const v = wasmBatch._scalarOutView;
                return { x: v[0], y: v[1], z: v[2] };
            },
            computeForceField: (...args) => {
                const v = wasmBatch.computeForceFieldOut(...args);
                return { x: v[0], y: v[1], z: v[2] };
            },
            computeForceFieldInto: (out, ...args) =>
                wasmBatch.computeForceFieldInto(out, ...args),
            computeSpringForce: (...args) => {
                wasmApi.computeSpringForceOut(wasmBatch._scalarOutPtr, ...args);
                const v = wasmBatch._scalarOutView;
                return { x: v[0], y: v[1], z: v[2] };
            },
            reflectVelocity: (...args) => {
                wasmApi.reflectVelocityOut(wasmBatch._scalarOutPtr, ...args);
                const v = wasmBatch._scalarOutView;
                return { x: v[0], y: v[1], z: v[2] };
            },
            closestPointOnSegment: (...args) => {
                wasmApi.closestPointOnSegmentOut(wasmBatch._scalarOutPtr, ...args);
                const v = wasmBatch._scalarOutView;
                return { x: v[0], y: v[1], z: v[2] };
            },
            applyVelocityDampingBatch: (velocities, out, count, dampingFactor, dt, maxSpeed) => {
                if (shouldUseWasmHeapBatch(count)) {
                    wasmBatch.applyVelocityDampingBatch(
                        velocities, out, count, dampingFactor, dt, maxSpeed
                    );
                } else {
                    jsFallback.applyVelocityDampingBatch(
                        velocities, out, count, dampingFactor, dt, maxSpeed
                    );
                }
            },
            computeForceFieldsBatch: (positions, strengths, out, count, fieldX, fieldY, fieldZ,
                                      falloffExp, minDist, maxDist, softening = 0) => {
                if (shouldUseWasmHeapBatch(count)) {
                    wasmBatch.computeForceFieldsBatch(
                        positions, strengths, out, count,
                        fieldX, fieldY, fieldZ, falloffExp, minDist, maxDist, softening
                    );
                } else {
                    jsFallback.computeForceFieldsBatch(
                        positions, strengths, out, count,
                        fieldX, fieldY, fieldZ, falloffExp, minDist, maxDist, softening
                    );
                }
            },
            computeSpringForcesBatch: (positions, anchors, velocities,
                                         restLengths, stiffnesses, dampings, out, count) => {
                if (shouldUseWasmHeapBatch(count)) {
                    wasmBatch.computeSpringForcesBatch(
                        positions, anchors, velocities,
                        restLengths, stiffnesses, dampings, out, count
                    );
                } else {
                    jsFallback.computeSpringForcesBatch(
                        positions, anchors, velocities,
                        restLengths, stiffnesses, dampings, out, count
                    );
                }
            },
            closestPointsOnSegmentBatch: (p0, p1, q, out, count) => {
                if (shouldUseWasmHeapBatch(count)) {
                    wasmBatch.closestPointsOnSegmentBatch(p0, p1, q, out, count);
                } else {
                    jsFallback.closestPointsOnSegmentBatch(p0, p1, q, out, count);
                }
            },
        };
    }

    return jsFallback;
}

/**
 * Reusable TypedArray buffers for batched force-field work in JS or WASM paths.
 * Grow automatically when `ensure(count)` is called with a larger count.
 */
export class PhysicsBatchBuffers {
    constructor(initialCapacity = 64) {
        this.capacity = 0;
        this.positions = new Float32Array(0);
        this.strengths = new Float32Array(0);
        this.forces = new Float32Array(0);
        this.velocities = new Float32Array(0);
        this.anchors = new Float32Array(0);
        this.restLengths = new Float32Array(0);
        this.stiffnesses = new Float32Array(0);
        this.dampings = new Float32Array(0);
        this.p0 = new Float32Array(0);
        this.p1 = new Float32Array(0);
        this.queries = new Float32Array(0);
        this.ensure(initialCapacity);
    }

    /**
     * @param {number} count
     */
    ensure(count) {
        if (count <= this.capacity) return;
        this.capacity = count;
        this.positions = new Float32Array(count * 3);
        this.strengths = new Float32Array(count);
        this.forces = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);
        this.anchors = new Float32Array(count * 3);
        this.restLengths = new Float32Array(count);
        this.stiffnesses = new Float32Array(count);
        this.dampings = new Float32Array(count);
        this.p0 = new Float32Array(count * 3);
        this.p1 = new Float32Array(count * 3);
        this.queries = new Float32Array(count * 3);
    }
}

function getRuntimeGlobal() {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof self !== 'undefined') return self;
    if (typeof window !== 'undefined') return window;
    return {};
}

/**
 * @returns {boolean}
 */
function isWasmLoadForcedOff() {
    const runtime = getRuntimeGlobal();
    if (typeof window === 'undefined' && typeof self === 'undefined') return true;
    if (runtime.MARBLES_DISABLE_WASM_PHYSICS === true) return true;
    const search = runtime.location?.search ?? '';
    const params = new URLSearchParams(search);
    return params.get('wasmPhysics') === '0';
}

/**
 * @returns {Promise<boolean>}
 */
async function wasmArtifactsPresent() {
    if (typeof fetch === 'undefined') return false;
    try {
        const res = await fetch(WASM_BINARY_URL, { method: 'HEAD' });
        return res.ok;
    } catch {
        return false;
    }
}

function settleJsFallback(silent = false) {
    _wasmApi = null;
    _wasmBatch = null;
    _usingWasm = false;
    _physicsApi = jsFallback;
    _physicsBackend = 'js-fallback';
    if (!silent) {
        console.info('[WASM] MarblePhysics using JS fallbacks.');
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Asynchronously loads and initialises the MarblePhysics WASM module.
 *
 * Safe to call multiple times — subsequent calls return the same promise.
 * Resolves to `true` if WASM loaded successfully, `false` if falling back
 * to JS.
 *
 * @returns {Promise<boolean>}
 */
export async function initMarblePhysicsWasm() {
    if (_initPromise) return _initPromise;

    _physicsBackend = 'pending';
    _initPromise = (async () => {
        try {
            if (isWasmLoadForcedOff()) {
                settleJsFallback(true);
                return false;
            }

            const artifactsPresent = await wasmArtifactsPresent();
            if (!artifactsPresent) {
                settleJsFallback(true);
                return false;
            }

            const moduleImport = await import(/* @vite-ignore */ WASM_MODULE_URL);
            /** @type {{ default: () => Promise<MarblePhysicsWasmModule> }} */
            const MarblePhysicsModule = moduleImport;
            const instance = await MarblePhysicsModule.default();
            _wasmApi = instance;
            _wasmBatch = new WasmBatchRunner(instance);
            _usingWasm = true;
            _physicsApi = buildPhysicsApi();
            _physicsBackend = 'wasm';
            console.info('[WASM] MarblePhysics active (native C++)');
            const runtime = getRuntimeGlobal();
            runtime.dispatchEvent?.(new CustomEvent('marbles:physics-backend', {
                detail: { backend: 'wasm' },
            }));
            return true;
        } catch (err) {
            console.warn(
                '[WASM] MarblePhysics load failed — using JS fallbacks.',
                err instanceof Error ? err.message : err
            );
            settleJsFallback(true);
            const runtime = getRuntimeGlobal();
            runtime.dispatchEvent?.(new CustomEvent('marbles:physics-backend', {
                detail: { backend: 'js-fallback' },
            }));
            return false;
        }
    })();

    return _initPromise;
}

/**
 * Returns the active physics API object.
 *
 * Scalar and batch helpers share identical signatures whether WASM or JS is
 * active, so call-sites need no conditional logic.
 *
 * @returns {MarblePhysicsApi}
 */
export function getMarblePhysics() {
    if (!_physicsApi) _physicsApi = jsFallback;
    return _physicsApi;
}

/**
 * Returns `true` once `initMarblePhysicsWasm()` has resolved to a successfully
 * loaded WASM module, `false` otherwise.
 *
 * @returns {boolean}
 */
export function isWasmActive() {
    return _usingWasm;
}

/**
 * Returns the active MarblePhysics backend for telemetry and A/B overlays.
 *
 * @returns {'pending' | 'wasm' | 'js-fallback'}
 */
export function getPhysicsBackend() {
    return _physicsBackend;
}

/** @internal Exported for unit tests and benchmarks. */
export const _testExports = {
    jsFallback,
    computeForceFieldScalar,
    applyVelocityDampingScalar,
    WasmBatchRunner,
    isWasmLoadForcedOff,
    wasmArtifactsPresent,
    shouldUseWasmHeapBatch,
    settleJsFallback,
};
