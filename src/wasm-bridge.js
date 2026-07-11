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

/** Use batched force-field evaluation when entity count exceeds this threshold. */
export const FORCE_BATCH_THRESHOLD = 8;

// ── Pure-JS fallbacks ─────────────────────────────────────────────────────────
// These mirror the C++ implementations exactly and are used whenever the WASM
// module is unavailable.

function computeForceFieldScalar(fieldX, fieldY, fieldZ,
                                 marbleX, marbleY, marbleZ,
                                 strength, falloffExp, minDist, maxDist,
                                 softening = 0) {
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
     * @returns {{x, y, z}}
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
                velocities[base], velocities[base + 1], velocities[base + 2],
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
     * @returns {{x, y, z}}
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
            const force = computeForceFieldScalar(
                fieldX, fieldY, fieldZ,
                positions[base], positions[base + 1], positions[base + 2],
                strengths[i], falloffExp, minDist, maxDist, softening
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
     * @returns {{x, y, z}}
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
     * Reflects a velocity vector off a surface normal.
     *   v' = v − (1 + restitution)(v · n) n
     *
     * @param {number} vx/vy/vz     Incoming velocity.
     * @param {number} nx/ny/nz     Unit surface normal.
     * @param {number} restitution  0 = inelastic, 1 = fully elastic.
     * @returns {{x, y, z}}
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
     * @returns {{x, y, z}}
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
    constructor(wasmModule) {
        this._mod = wasmModule;
        this._malloc = wasmModule._malloc;
        this._free = wasmModule._free;
        this._heap = wasmModule.HEAPF32;
        this._positionsPtr = 0;
        this._strengthsPtr = 0;
        this._forcesPtr = 0;
        this._velocitiesPtr = 0;
        this._capacity = 0;
    }

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
        this._capacity = count;
    }

    _freeBuffers() {
        if (!this._mod) return;
        if (this._positionsPtr) this._free(this._positionsPtr);
        if (this._strengthsPtr) this._free(this._strengthsPtr);
        if (this._forcesPtr) this._free(this._forcesPtr);
        if (this._velocitiesPtr) this._free(this._velocitiesPtr);
        this._positionsPtr = 0;
        this._strengthsPtr = 0;
        this._forcesPtr = 0;
        this._velocitiesPtr = 0;
        this._capacity = 0;
    }

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

let _wasmApi = null;
let _wasmBatch = null;
let _physicsApi = null;
let _initPromise = null;
let _usingWasm = false;

function buildPhysicsApi() {
    if (_usingWasm && _wasmApi && _wasmBatch) {
        return {
            vec3Distance: _wasmApi.vec3Distance.bind(_wasmApi),
            vec3DistanceSq: _wasmApi.vec3DistanceSq.bind(_wasmApi),
            vec3Dot: _wasmApi.vec3Dot.bind(_wasmApi),
            vec3Length: _wasmApi.vec3Length.bind(_wasmApi),
            vec3Normalize: _wasmApi.vec3Normalize.bind(_wasmApi),
            applyVelocityDamping: _wasmApi.applyVelocityDamping.bind(_wasmApi),
            computeForceField: _wasmApi.computeForceField.bind(_wasmApi),
            computeSpringForce: _wasmApi.computeSpringForce.bind(_wasmApi),
            reflectVelocity: _wasmApi.reflectVelocity.bind(_wasmApi),
            closestPointOnSegment: _wasmApi.closestPointOnSegment.bind(_wasmApi),
            applyVelocityDampingBatch: (velocities, out, count, dampingFactor, dt, maxSpeed) =>
                _wasmBatch.applyVelocityDampingBatch(velocities, out, count, dampingFactor, dt, maxSpeed),
            computeForceFieldsBatch: (positions, strengths, out, count, fieldX, fieldY, fieldZ,
                                      falloffExp, minDist, maxDist, softening = 0) =>
                _wasmBatch.computeForceFieldsBatch(
                    positions, strengths, out, count,
                    fieldX, fieldY, fieldZ, falloffExp, minDist, maxDist, softening
                ),
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
        this.ensure(initialCapacity);
    }

    ensure(count) {
        if (count <= this.capacity) return;
        this.capacity = count;
        this.positions = new Float32Array(count * 3);
        this.strengths = new Float32Array(count);
        this.forces = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);
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

    _initPromise = (async () => {
        try {
            const wasmEnabled = typeof window !== 'undefined' && (
                window.MARBLES_ENABLE_WASM_PHYSICS === true ||
                new URLSearchParams(window.location.search).get('wasmPhysics') === '1'
            );
            if (!wasmEnabled) {
                console.info('[WASM] MarblePhysics disabled; using JS fallbacks. Add ?wasmPhysics=1 to opt in.');
                _physicsApi = jsFallback;
                return false;
            }

            const wasmModuleUrl = '/wasm/marble_physics.js';
            const { default: MarblePhysicsModule } = await import(/* @vite-ignore */ wasmModuleUrl);
            const instance = await MarblePhysicsModule();
            _wasmApi = instance;
            _wasmBatch = new WasmBatchRunner(instance);
            _usingWasm = true;
            _physicsApi = buildPhysicsApi();
            console.log('[WASM] MarblePhysics module loaded ✓ (native C++ active)');
            return true;
        } catch (err) {
            console.warn(
                '[WASM] MarblePhysics module unavailable — using JS fallbacks.',
                err instanceof Error ? err.message : err
            );
            _wasmApi = null;
            _wasmBatch = null;
            _usingWasm = false;
            _physicsApi = jsFallback;
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
 * @returns {typeof jsFallback}
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

/** @internal Exported for unit tests and benchmarks. */
export const _testExports = {
    jsFallback,
    computeForceFieldScalar,
    applyVelocityDampingScalar,
    WasmBatchRunner,
};
