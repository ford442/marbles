/**
 * marble_physics.cpp
 *
 * Custom C++ WebAssembly module for the Marbles 3D game.
 * Provides high-performance math and physics helpers that complement
 * the Rapier3D JavaScript physics engine.
 *
 * Exposed via Embind so every function is callable from JavaScript as:
 *   const api = await MarblePhysicsModule();
 *   api.vec3Distance(ax, ay, az, bx, by, bz);
 *
 * Build with:
 *   cd wasm && ./build.sh
 * Output lands in public/wasm/ and is served statically by Vite.
 */

#include <emscripten/bind.h>
#include <cmath>
#include <algorithm>

#ifdef __wasm_simd128__
#include <wasm_simd128.h>

// ── AoS3 <-> SoA4 transpose ────────────────────────────────────────────────────
//
// The batch kernels below operate on 4 entities per iteration, but their
// input/output buffers pack xyz interleaved per entity (AoS) while the SIMD
// math wants one lane per entity (SoA). WASM SIMD128 has no strided-gather
// instruction, so the standard technique is to load/store the 4 vec3s
// (12 contiguous floats = exactly 3 v128 words) and shuffle between layouts,
// rather than gathering/scattering lane-by-lane with scalar loads/stores.

/** Deinterleaves 4 packed vec3s (12 contiguous floats at `ptr`) into SoA lanes. */
inline void loadVec3x4(const float* ptr, v128_t& outX, v128_t& outY, v128_t& outZ) {
    const v128_t in0 = wasm_v128_load(ptr);       // [x0,y0,z0,x1]
    const v128_t in1 = wasm_v128_load(ptr + 4);   // [y1,z1,x2,y2]
    const v128_t in2 = wasm_v128_load(ptr + 8);   // [z2,x3,y3,z3]

    const v128_t abX = wasm_i32x4_shuffle(in0, in1, 0, 3, 6, 6);
    outX = wasm_i32x4_shuffle(abX, in2, 0, 1, 2, 5);

    const v128_t abY = wasm_i32x4_shuffle(in0, in1, 1, 4, 7, 7);
    outY = wasm_i32x4_shuffle(abY, in2, 0, 1, 2, 6);

    const v128_t abZ = wasm_i32x4_shuffle(in0, in1, 2, 5, 5, 5);
    outZ = wasm_i32x4_shuffle(abZ, in2, 0, 1, 4, 7);
}

/** Interleaves SoA x/y/z lanes back into 4 packed vec3s (12 contiguous floats at `ptr`). */
inline void storeVec3x4(float* ptr, v128_t x, v128_t y, v128_t z) {
    const v128_t xy01 = wasm_i32x4_shuffle(x, y, 0, 4, 1, 5); // [x0,y0,x1,y1]
    const v128_t xy23 = wasm_i32x4_shuffle(x, y, 2, 6, 3, 7); // [x2,y2,x3,y3]

    const v128_t out0 = wasm_i32x4_shuffle(xy01, z, 0, 1, 4, 2); // [x0,y0,z0,x1]

    const v128_t zx   = wasm_i32x4_shuffle(z, xy23, 1, 4, 5, 1);
    const v128_t out1 = wasm_i32x4_shuffle(xy01, zx, 3, 4, 5, 6); // [y1,z1,x2,y2]

    const v128_t out2 = wasm_i32x4_shuffle(z, xy23, 2, 6, 7, 3); // [z2,x3,y3,z3]

    wasm_v128_store(ptr,     out0);
    wasm_v128_store(ptr + 4, out1);
    wasm_v128_store(ptr + 8, out2);
}
#endif // __wasm_simd128__

// ── Vector Math ───────────────────────────────────────────────────────────────

/** Euclidean distance between two 3-D points. */
float vec3Distance(float ax, float ay, float az,
                   float bx, float by, float bz) {
    const float dx = bx - ax, dy = by - ay, dz = bz - az;
    return std::sqrt(dx * dx + dy * dy + dz * dz);
}

/** Squared distance (cheaper when you only need to compare distances). */
float vec3DistanceSq(float ax, float ay, float az,
                     float bx, float by, float bz) {
    const float dx = bx - ax, dy = by - ay, dz = bz - az;
    return dx * dx + dy * dy + dz * dz;
}

/** Dot product of two 3-D vectors. */
float vec3Dot(float ax, float ay, float az,
              float bx, float by, float bz) {
    return ax * bx + ay * by + az * bz;
}

/** Returns the length (magnitude) of a 3-D vector. */
float vec3Length(float x, float y, float z) {
    return std::sqrt(x * x + y * y + z * z);
}

/**
 * Doppler playback-rate multiplier for a moving audio source (marble) heard
 * by a stationary listener (camera). Projects the source velocity onto the
 * listener->source axis and scales it by an approximate reference speed,
 * clamping to keep the pitch shift musical rather than physically literal.
 *
 * @param vx,vy,vz Source (marble) velocity.
 * @param camX,camY,camZ Listener (camera) position.
 * @param marbleX,marbleY,marbleZ Source (marble) position.
 * @param speedOfSound Reference speed used to scale the shift.
 * @param maxShift Clamp fraction, e.g. 0.3 for +/-30%.
 * @returns Playback-rate multiplier, 1.0 = no shift.
 */
float computeDopplerRate(float vx, float vy, float vz,
                          float camX, float camY, float camZ,
                          float marbleX, float marbleY, float marbleZ,
                          float speedOfSound, float maxShift) {
    const float dx = camX - marbleX, dy = camY - marbleY, dz = camZ - marbleZ;
    const float dist = std::sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1e-5f || speedOfSound < 1e-5f) return 1.0f;
    const float radial = (vx * dx + vy * dy + vz * dz) / dist;
    const float rate = 1.0f + radial / speedOfSound;
    return std::clamp(rate, 1.0f - maxShift, 1.0f + maxShift);
}

/**
 * Normalizes (x, y, z) and returns {x, y, z} as a JS object.
 * Returns zero vector if the input has near-zero length.
 */
emscripten::val vec3Normalize(float x, float y, float z) {
    emscripten::val result = emscripten::val::object();
    const float len = std::sqrt(x * x + y * y + z * z);
    if (len < 1e-6f) {
        result.set("x", 0.f);
        result.set("y", 0.f);
        result.set("z", 0.f);
    } else {
        result.set("x", x / len);
        result.set("y", y / len);
        result.set("z", z / len);
    }
    return result;
}

// ── Velocity Damping ──────────────────────────────────────────────────────────

/** Shared scalar kernel used by both Embind and batch entry points. */
inline void applyVelocityDampingVec(float vx, float vy, float vz,
                                    float dampingFactor, float dt, float maxSpeed,
                                    float& outX, float& outY, float& outZ) {
    const float decay = 1.0f - std::clamp(dampingFactor * dt, 0.0f, 1.0f);
    float nx = vx * decay;
    float ny = vy * decay;
    float nz = vz * decay;

    if (maxSpeed > 0.0f) {
        const float speed = std::sqrt(nx * nx + ny * ny + nz * nz);
        if (speed > maxSpeed) {
            const float s = maxSpeed / speed;
            nx *= s; ny *= s; nz *= s;
        }
    }

    outX = nx;
    outY = ny;
    outZ = nz;
}

/**
 * Applies exponential velocity damping and an optional speed cap per frame.
 *
 * @param vx/vy/vz     Current velocity vector.
 * @param dampingFactor Linear damping coefficient (0 = none, 1 = full stop).
 * @param dt            Frame delta-time in seconds.
 * @param maxSpeed      Clamp speed to this value (0 = unlimited).
 * @returns             Damped velocity {x, y, z}.
 */
void applyVelocityDampingOut(uintptr_t outPtr,
                             float vx, float vy, float vz,
                             float dampingFactor, float dt, float maxSpeed) {
    float* out = reinterpret_cast<float*>(outPtr);
    applyVelocityDampingVec(vx, vy, vz, dampingFactor, dt, maxSpeed,
                            out[0], out[1], out[2]);
}

emscripten::val applyVelocityDamping(float vx, float vy, float vz,
                                     float dampingFactor, float dt,
                                     float maxSpeed) {
    emscripten::val result = emscripten::val::object();
    float nx, ny, nz;
    applyVelocityDampingVec(vx, vy, vz, dampingFactor, dt, maxSpeed, nx, ny, nz);
    result.set("x", nx);
    result.set("y", ny);
    result.set("z", nz);
    return result;
}

/** Scalar fallback: processes every entity one at a time. */
inline void applyVelocityDampingBatchScalar(float* velocities, float* out, int count,
                                            float dampingFactor, float dt, float maxSpeed,
                                            int startIndex = 0) {
    for (int i = startIndex; i < count; ++i) {
        const int base = i * 3;
        float nx, ny, nz;
        applyVelocityDampingVec(velocities[base], velocities[base + 1], velocities[base + 2],
                                dampingFactor, dt, maxSpeed, nx, ny, nz);
        out[base]     = nx;
        out[base + 1] = ny;
        out[base + 2] = nz;
    }
}

#ifdef __wasm_simd128__
/**
 * SIMD kernel: processes 4 entities per iteration.
 *
 * Velocities are stored AoS (interleaved xyz per entity); 4 entities' worth
 * of x/y/z are deinterleaved into SoA lanes with `loadVec3x4` (3 vector loads
 * + shuffles, no scalar gather), the damping + speed-cap math runs fully
 * vectorized across those 4 lanes, and `storeVec3x4` re-interleaves the
 * result back to AoS. The remainder (count % 4) falls back to the scalar
 * kernel above.
 */
inline void applyVelocityDampingBatchSimd(float* velocities, float* out, int count,
                                          float dampingFactor, float dt, float maxSpeed) {
    const float decayScalar = 1.0f - std::clamp(dampingFactor * dt, 0.0f, 1.0f);
    const v128_t vDecay    = wasm_f32x4_splat(decayScalar);
    const v128_t vMaxSpeed = wasm_f32x4_splat(maxSpeed);
    const bool capSpeed    = maxSpeed > 0.0f;

    const int simdCount = count - (count % 4);
    int i = 0;
    for (; i < simdCount; i += 4) {
        const int base = i * 3;

        v128_t vx, vy, vz;
        loadVec3x4(velocities + base, vx, vy, vz);

        v128_t nx = wasm_f32x4_mul(vx, vDecay);
        v128_t ny = wasm_f32x4_mul(vy, vDecay);
        v128_t nz = wasm_f32x4_mul(vz, vDecay);

        if (capSpeed) {
            const v128_t speedSq = wasm_f32x4_add(
                wasm_f32x4_add(wasm_f32x4_mul(nx, nx), wasm_f32x4_mul(ny, ny)),
                wasm_f32x4_mul(nz, nz));
            const v128_t speed    = wasm_f32x4_sqrt(speedSq);
            const v128_t overMask = wasm_f32x4_gt(speed, vMaxSpeed);
            const v128_t scale    = wasm_f32x4_div(vMaxSpeed, speed);

            nx = wasm_v128_bitselect(wasm_f32x4_mul(nx, scale), nx, overMask);
            ny = wasm_v128_bitselect(wasm_f32x4_mul(ny, scale), ny, overMask);
            nz = wasm_v128_bitselect(wasm_f32x4_mul(nz, scale), nz, overMask);
        }

        storeVec3x4(out + base, nx, ny, nz);
    }

    applyVelocityDampingBatchScalar(velocities, out, count, dampingFactor, dt, maxSpeed, i);
}
#endif // __wasm_simd128__

/**
 * Batched velocity damping. Reads/writes xyz triplets in HEAPF32 buffers.
 * When in-place, pass the same pointer for velocitiesPtr and outPtr.
 */
void applyVelocityDampingBatch(uintptr_t velocitiesPtr, uintptr_t outPtr, int count,
                               float dampingFactor, float dt, float maxSpeed) {
    if (count <= 0) return;

    float* velocities = reinterpret_cast<float*>(velocitiesPtr);
    float* out        = reinterpret_cast<float*>(outPtr);

#ifdef __wasm_simd128__
    applyVelocityDampingBatchSimd(velocities, out, count, dampingFactor, dt, maxSpeed);
#else
    applyVelocityDampingBatchScalar(velocities, out, count, dampingFactor, dt, maxSpeed);
#endif
}

// ── Force Fields ──────────────────────────────────────────────────────────────

/** Shared scalar kernel used by both Embind and batch entry points. */
inline void computeForceFieldVec(float fieldX, float fieldY, float fieldZ,
                                 float marbleX, float marbleY, float marbleZ,
                                 float strength, float falloffExp,
                                 float minDist, float maxDist, float softening,
                                 float& outX, float& outY, float& outZ) {
    const float dx = fieldX - marbleX;
    const float dy = fieldY - marbleY;
    const float dz = fieldZ - marbleZ;
    const float dist = std::sqrt(dx * dx + dy * dy + dz * dz);

    if (dist > maxDist || dist < 1e-6f) {
        outX = outY = outZ = 0.f;
        return;
    }

    const float clampedDist = std::max(dist, minDist);
    const float falloff     = std::pow(clampedDist, falloffExp) + softening;
    const float forceMag    = strength / falloff;

    outX = (dx / dist) * forceMag;
    outY = (dy / dist) * forceMag;
    outZ = (dz / dist) * forceMag;
}

/**
 * Computes the gravitational-style impulse a point force-field exerts on a
 * marble at the given position.
 *
 * The force magnitude follows an inverse power law:
 *   F = strength / (clamp(dist, minDist)^falloffExp + softening)
 *
 * @param fieldX/Y/Z   Origin of the force field (e.g. black-hole position).
 * @param marbleX/Y/Z  Position of the marble.
 * @param strength     Positive = attract, negative = repel.
 * @param falloffExp   Exponent for distance falloff (2.0 = inverse-square).
 * @param minDist      Minimum clamped distance to avoid singularity.
 * @param maxDist      Beyond this distance the force is zero.
 * @param softening    Added to the falloff denominator (magnet uses 1.0).
 * @returns            Force vector {x, y, z} to apply as an impulse.
 */
/** Writes force xyz into a HEAPF32 buffer (3 floats) — avoids Embind object alloc. */
void computeForceFieldOut(uintptr_t outPtr,
                          float fieldX, float fieldY, float fieldZ,
                          float marbleX, float marbleY, float marbleZ,
                          float strength, float falloffExp,
                          float minDist, float maxDist, float softening) {
    float* out = reinterpret_cast<float*>(outPtr);
    computeForceFieldVec(fieldX, fieldY, fieldZ,
                         marbleX, marbleY, marbleZ,
                         strength, falloffExp, minDist, maxDist, softening,
                         out[0], out[1], out[2]);
}

emscripten::val computeForceField(float fieldX, float fieldY, float fieldZ,
                                   float marbleX, float marbleY, float marbleZ,
                                   float strength, float falloffExp,
                                   float minDist, float maxDist,
                                   float softening = 0.f) {
    emscripten::val result = emscripten::val::object();
    float fx, fy, fz;
    computeForceFieldVec(fieldX, fieldY, fieldZ,
                         marbleX, marbleY, marbleZ,
                         strength, falloffExp, minDist, maxDist, softening,
                         fx, fy, fz);
    result.set("x", fx);
    result.set("y", fy);
    result.set("z", fz);
    return result;
}

/** Scalar fallback: processes every entity one at a time. */
inline void computeForceFieldsBatchScalar(float* positions, float* strengths, float* out, int count,
                                          float fieldX, float fieldY, float fieldZ,
                                          float falloffExp, float minDist, float maxDist,
                                          float softening, int startIndex = 0) {
    for (int i = startIndex; i < count; ++i) {
        const int base = i * 3;
        float fx, fy, fz;
        computeForceFieldVec(fieldX, fieldY, fieldZ,
                             positions[base], positions[base + 1], positions[base + 2],
                             strengths[i], falloffExp, minDist, maxDist, softening,
                             fx, fy, fz);
        out[base]     = fx;
        out[base + 1] = fy;
        out[base + 2] = fz;
    }
}

#ifdef __wasm_simd128__
/**
 * SIMD kernel: processes 4 entities per iteration.
 *
 * The dx/dy/dz displacement, squared distance, sqrt and the final
 * normalize-and-scale are all done 4-wide across entities deinterleaved into
 * SoA lanes via `loadVec3x4`/`storeVec3x4`. `std::pow` has no WASM SIMD128
 * intrinsic for a runtime-variable exponent, so the falloff term is computed
 * per-lane and folded back into the vector pipeline for the remaining
 * (already-vectorized) division and scale steps.
 * The remainder (count % 4) falls back to the scalar kernel above.
 */
inline void computeForceFieldsBatchSimd(float* positions, float* strengths, float* out, int count,
                                        float fieldX, float fieldY, float fieldZ,
                                        float falloffExp, float minDist, float maxDist,
                                        float softening) {
    const v128_t vFieldX    = wasm_f32x4_splat(fieldX);
    const v128_t vFieldY    = wasm_f32x4_splat(fieldY);
    const v128_t vFieldZ    = wasm_f32x4_splat(fieldZ);
    const v128_t vMinDist   = wasm_f32x4_splat(minDist);
    const v128_t vMaxDist   = wasm_f32x4_splat(maxDist);
    const v128_t vSoftening = wasm_f32x4_splat(softening);
    const v128_t vEpsilon   = wasm_f32x4_splat(1e-6f);
    const v128_t vZero      = wasm_f32x4_splat(0.0f);
    const v128_t vOne       = wasm_f32x4_splat(1.0f);

    const int simdCount = count - (count % 4);
    int i = 0;
    for (; i < simdCount; i += 4) {
        const int base = i * 3;

        v128_t px, py, pz;
        loadVec3x4(positions + base, px, py, pz);
        const v128_t vStrength = wasm_v128_load(&strengths[i]);

        const v128_t dx = wasm_f32x4_sub(vFieldX, px);
        const v128_t dy = wasm_f32x4_sub(vFieldY, py);
        const v128_t dz = wasm_f32x4_sub(vFieldZ, pz);

        const v128_t distSq = wasm_f32x4_add(
            wasm_f32x4_add(wasm_f32x4_mul(dx, dx), wasm_f32x4_mul(dy, dy)),
            wasm_f32x4_mul(dz, dz));
        const v128_t dist = wasm_f32x4_sqrt(distSq);
        const v128_t clampedDist = wasm_f32x4_max(dist, vMinDist);

        float clampedArr[4];
        wasm_v128_store(clampedArr, clampedDist);
        float falloffArr[4];
        for (int k = 0; k < 4; ++k) falloffArr[k] = std::pow(clampedArr[k], falloffExp);
        const v128_t falloff = wasm_f32x4_add(wasm_v128_load(falloffArr), vSoftening);

        const v128_t forceMag = wasm_f32x4_div(vStrength, falloff);
        const v128_t invDist  = wasm_f32x4_div(vOne, dist);
        const v128_t scale    = wasm_f32x4_mul(invDist, forceMag);

        const v128_t validMask = wasm_v128_and(
            wasm_f32x4_le(dist, vMaxDist),
            wasm_f32x4_ge(dist, vEpsilon));

        const v128_t fx = wasm_v128_bitselect(wasm_f32x4_mul(dx, scale), vZero, validMask);
        const v128_t fy = wasm_v128_bitselect(wasm_f32x4_mul(dy, scale), vZero, validMask);
        const v128_t fz = wasm_v128_bitselect(wasm_f32x4_mul(dz, scale), vZero, validMask);

        storeVec3x4(out + base, fx, fy, fz);
    }

    computeForceFieldsBatchScalar(positions, strengths, out, count,
                                  fieldX, fieldY, fieldZ, falloffExp, minDist, maxDist,
                                  softening, i);
}
#endif // __wasm_simd128__

/**
 * Batched force-field evaluation writing directly into a HEAPF32 buffer.
 *
 * Layout (all float32):
 *   positions[i*3+0..2] = marble xyz
 *   strengths[i]        = per-marble strength (e.g. mass * base force)
 *   out[i*3+0..2]       = resulting force xyz
 */
void computeForceFieldsBatch(uintptr_t positionsPtr, uintptr_t strengthsPtr,
                             uintptr_t outPtr, int count,
                             float fieldX, float fieldY, float fieldZ,
                             float falloffExp, float minDist, float maxDist,
                             float softening) {
    if (count <= 0) return;

    float* positions = reinterpret_cast<float*>(positionsPtr);
    float* strengths = reinterpret_cast<float*>(strengthsPtr);
    float* out       = reinterpret_cast<float*>(outPtr);

#ifdef __wasm_simd128__
    computeForceFieldsBatchSimd(positions, strengths, out, count,
                                fieldX, fieldY, fieldZ, falloffExp, minDist, maxDist, softening);
#else
    computeForceFieldsBatchScalar(positions, strengths, out, count,
                                  fieldX, fieldY, fieldZ, falloffExp, minDist, maxDist, softening);
#endif
}

// ── Spring / Constraint Force ─────────────────────────────────────────────────

inline void computeSpringForceVec(float marbleX, float marbleY, float marbleZ,
                                  float anchorX, float anchorY, float anchorZ,
                                  float restLength, float stiffness, float damping,
                                  float velX, float velY, float velZ,
                                  float& outX, float& outY, float& outZ) {
    const float dx   = anchorX - marbleX;
    const float dy   = anchorY - marbleY;
    const float dz   = anchorZ - marbleZ;
    const float dist = std::sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < 1e-6f) {
        outX = outY = outZ = 0.f;
        return;
    }

    const float nx = dx / dist;
    const float ny = dy / dist;
    const float nz = dz / dist;

    const float extension    = dist - restLength;
    const float velAlongAxis = velX * nx + velY * ny + velZ * nz;
    const float fMag         = stiffness * extension - damping * velAlongAxis;

    outX = nx * fMag;
    outY = ny * fMag;
    outZ = nz * fMag;
}

void computeSpringForceOut(uintptr_t outPtr,
                           float marbleX, float marbleY, float marbleZ,
                           float anchorX, float anchorY, float anchorZ,
                           float restLength, float stiffness, float damping,
                           float velX, float velY, float velZ) {
    float* out = reinterpret_cast<float*>(outPtr);
    computeSpringForceVec(marbleX, marbleY, marbleZ,
                          anchorX, anchorY, anchorZ,
                          restLength, stiffness, damping,
                          velX, velY, velZ,
                          out[0], out[1], out[2]);
}

/**
 * Batched spring forces. Buffer layout (float32):
 *   positions[i*3+0..2], anchors[i*3+0..2], velocities[i*3+0..2],
 *   restLengths[i], stiffnesses[i], dampings[i], out[i*3+0..2]
 */
void computeSpringForcesBatch(uintptr_t positionsPtr, uintptr_t anchorsPtr,
                              uintptr_t velocitiesPtr, uintptr_t restLengthsPtr,
                              uintptr_t stiffnessesPtr, uintptr_t dampingsPtr,
                              uintptr_t outPtr, int count) {
    if (count <= 0) return;

    float* positions    = reinterpret_cast<float*>(positionsPtr);
    float* anchors      = reinterpret_cast<float*>(anchorsPtr);
    float* velocities   = reinterpret_cast<float*>(velocitiesPtr);
    float* restLengths  = reinterpret_cast<float*>(restLengthsPtr);
    float* stiffnesses  = reinterpret_cast<float*>(stiffnessesPtr);
    float* dampings     = reinterpret_cast<float*>(dampingsPtr);
    float* out          = reinterpret_cast<float*>(outPtr);

    for (int i = 0; i < count; ++i) {
        const int base = i * 3;
        float fx, fy, fz;
        computeSpringForceVec(
            positions[base], positions[base + 1], positions[base + 2],
            anchors[base], anchors[base + 1], anchors[base + 2],
            restLengths[i], stiffnesses[i], dampings[i],
            velocities[base], velocities[base + 1], velocities[base + 2],
            fx, fy, fz);
        out[base]     = fx;
        out[base + 1] = fy;
        out[base + 2] = fz;
    }
}

/**
 * Hooke's-law spring between a marble and an anchor point, with velocity
 * damping along the spring axis.
 */
emscripten::val computeSpringForce(float marbleX, float marbleY, float marbleZ,
                                    float anchorX, float anchorY, float anchorZ,
                                    float restLength, float stiffness, float damping,
                                    float velX, float velY, float velZ) {
    emscripten::val result = emscripten::val::object();
    float fx, fy, fz;
    computeSpringForceVec(marbleX, marbleY, marbleZ,
                          anchorX, anchorY, anchorZ,
                          restLength, stiffness, damping,
                          velX, velY, velZ,
                          fx, fy, fz);
    result.set("x", fx);
    result.set("y", fy);
    result.set("z", fz);
    return result;
}

// ── Collision / Reflection ────────────────────────────────────────────────────

/**
 * Reflects a velocity vector off a surface defined by its unit normal.
 * Uses the standard specular-reflection formula:
 *   v' = v - (1 + restitution) * (v · n) * n
 *
 * @param vx/vy/vz         Incoming velocity.
 * @param nx/ny/nz         Surface normal (should be unit length).
 * @param restitution      Coefficient of restitution (0 = inelastic, 1 = elastic).
 * @returns                Reflected velocity {x, y, z}.
 */
void reflectVelocityOut(uintptr_t outPtr,
                        float vx, float vy, float vz,
                        float nx, float ny, float nz, float restitution) {
    const float dot   = vx * nx + vy * ny + vz * nz;
    const float scale = (1.0f + restitution) * dot;
    float* out = reinterpret_cast<float*>(outPtr);
    out[0] = vx - scale * nx;
    out[1] = vy - scale * ny;
    out[2] = vz - scale * nz;
}

emscripten::val reflectVelocity(float vx, float vy, float vz,
                                 float nx, float ny, float nz,
                                 float restitution) {
    const float dot   = vx * nx + vy * ny + vz * nz;
    const float scale = (1.0f + restitution) * dot;

    emscripten::val result = emscripten::val::object();
    result.set("x", vx - scale * nx);
    result.set("y", vy - scale * ny);
    result.set("z", vz - scale * nz);
    return result;
}

inline void closestPointOnSegmentVec(float p0x, float p0y, float p0z,
                                   float p1x, float p1y, float p1z,
                                   float qx, float qy, float qz,
                                   float& outX, float& outY, float& outZ) {
    const float dx  = p1x - p0x, dy = p1y - p0y, dz = p1z - p0z;
    const float lenSq = dx * dx + dy * dy + dz * dz;

    if (lenSq < 1e-12f) {
        outX = p0x;
        outY = p0y;
        outZ = p0z;
        return;
    }

    const float t = std::clamp(
        ((qx - p0x) * dx + (qy - p0y) * dy + (qz - p0z) * dz) / lenSq,
        0.0f, 1.0f);

    outX = p0x + t * dx;
    outY = p0y + t * dy;
    outZ = p0z + t * dz;
}

void closestPointOnSegmentOut(uintptr_t outPtr,
                            float p0x, float p0y, float p0z,
                            float p1x, float p1y, float p1z,
                            float qx, float qy, float qz) {
    float* out = reinterpret_cast<float*>(outPtr);
    closestPointOnSegmentVec(p0x, p0y, p0z, p1x, p1y, p1z, qx, qy, qz,
                             out[0], out[1], out[2]);
}

/** Batched closest-point-on-segment. p0, p1, q, out each hold count*3 floats. */
void closestPointsOnSegmentBatch(uintptr_t p0Ptr, uintptr_t p1Ptr,
                               uintptr_t qPtr, uintptr_t outPtr, int count) {
    if (count <= 0) return;

    float* p0  = reinterpret_cast<float*>(p0Ptr);
    float* p1  = reinterpret_cast<float*>(p1Ptr);
    float* q   = reinterpret_cast<float*>(qPtr);
    float* out = reinterpret_cast<float*>(outPtr);

    for (int i = 0; i < count; ++i) {
        const int base = i * 3;
        float ox, oy, oz;
        closestPointOnSegmentVec(
            p0[base], p0[base + 1], p0[base + 2],
            p1[base], p1[base + 1], p1[base + 2],
            q[base], q[base + 1], q[base + 2],
            ox, oy, oz);
        out[base]     = ox;
        out[base + 1] = oy;
        out[base + 2] = oz;
    }
}

emscripten::val closestPointOnSegment(float p0x, float p0y, float p0z,
                                       float p1x, float p1y, float p1z,
                                       float qx,  float qy,  float qz) {
    emscripten::val result = emscripten::val::object();
    float ox, oy, oz;
    closestPointOnSegmentVec(p0x, p0y, p0z, p1x, p1y, p1z, qx, qy, qz, ox, oy, oz);
    result.set("x", ox);
    result.set("y", oy);
    result.set("z", oz);
    return result;
}

// ── Embind Registration ───────────────────────────────────────────────────────

EMSCRIPTEN_BINDINGS(marble_physics) {
    // Vector math
    emscripten::function("vec3Distance",           &vec3Distance);
    emscripten::function("vec3DistanceSq",         &vec3DistanceSq);
    emscripten::function("vec3Dot",                &vec3Dot);
    emscripten::function("vec3Length",             &vec3Length);
    emscripten::function("vec3Normalize",          &vec3Normalize);
    emscripten::function("computeDopplerRate",     &computeDopplerRate);

    // Physics helpers
    emscripten::function("applyVelocityDamping",          &applyVelocityDamping);
    emscripten::function("applyVelocityDampingOut",       &applyVelocityDampingOut);
    emscripten::function("applyVelocityDampingBatch",     &applyVelocityDampingBatch);
    emscripten::function("computeForceField",             &computeForceField);
    emscripten::function("computeForceFieldOut",          &computeForceFieldOut);
    emscripten::function("computeForceFieldsBatch",       &computeForceFieldsBatch);
    emscripten::function("computeSpringForce",            &computeSpringForce);
    emscripten::function("computeSpringForceOut",         &computeSpringForceOut);
    emscripten::function("computeSpringForcesBatch",      &computeSpringForcesBatch);
    emscripten::function("reflectVelocity",               &reflectVelocity);
    emscripten::function("reflectVelocityOut",            &reflectVelocityOut);
    emscripten::function("closestPointOnSegment",         &closestPointOnSegment);
    emscripten::function("closestPointOnSegmentOut",      &closestPointOnSegmentOut);
    emscripten::function("closestPointsOnSegmentBatch",   &closestPointsOnSegmentBatch);
}
