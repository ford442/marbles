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

/**
 * Batched velocity damping. Reads/writes xyz triplets in HEAPF32 buffers.
 * When in-place, pass the same pointer for velocitiesPtr and outPtr.
 */
void applyVelocityDampingBatch(uintptr_t velocitiesPtr, uintptr_t outPtr, int count,
                               float dampingFactor, float dt, float maxSpeed) {
    if (count <= 0) return;

    float* velocities = reinterpret_cast<float*>(velocitiesPtr);
    float* out        = reinterpret_cast<float*>(outPtr);

    for (int i = 0; i < count; ++i) {
        const int base = i * 3;
        float nx, ny, nz;
        applyVelocityDampingVec(velocities[base], velocities[base + 1], velocities[base + 2],
                                dampingFactor, dt, maxSpeed, nx, ny, nz);
        out[base]     = nx;
        out[base + 1] = ny;
        out[base + 2] = nz;
    }
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

    for (int i = 0; i < count; ++i) {
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

// ── Spring / Constraint Force ─────────────────────────────────────────────────

/**
 * Hooke's-law spring between a marble and an anchor point, with velocity
 * damping along the spring axis.
 *
 * @param marbleX/Y/Z  Marble world position.
 * @param anchorX/Y/Z  Anchor (fixed) world position.
 * @param restLength   Natural length of the spring.
 * @param stiffness    Spring constant k (N/m).
 * @param damping      Damping coefficient c (N·s/m).
 * @param velX/Y/Z     Marble velocity (used for damping).
 * @returns            Force vector {x, y, z}.
 */
emscripten::val computeSpringForce(float marbleX, float marbleY, float marbleZ,
                                    float anchorX, float anchorY, float anchorZ,
                                    float restLength, float stiffness, float damping,
                                    float velX, float velY, float velZ) {
    emscripten::val result = emscripten::val::object();

    const float dx   = anchorX - marbleX;
    const float dy   = anchorY - marbleY;
    const float dz   = anchorZ - marbleZ;
    const float dist = std::sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < 1e-6f) {
        result.set("x", 0.f);
        result.set("y", 0.f);
        result.set("z", 0.f);
        return result;
    }

    const float nx = dx / dist;
    const float ny = dy / dist;
    const float nz = dz / dist;

    const float extension    = dist - restLength;
    const float velAlongAxis = velX * nx + velY * ny + velZ * nz;
    const float fMag         = stiffness * extension - damping * velAlongAxis;

    result.set("x", nx * fMag);
    result.set("y", ny * fMag);
    result.set("z", nz * fMag);
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

/**
 * Computes the closest point on a line segment (p0→p1) to point q.
 * Useful for grapple-hook and rail-slide mechanics.
 *
 * @returns  Closest point {x, y, z} on the segment.
 */
emscripten::val closestPointOnSegment(float p0x, float p0y, float p0z,
                                       float p1x, float p1y, float p1z,
                                       float qx,  float qy,  float qz) {
    const float dx  = p1x - p0x, dy = p1y - p0y, dz = p1z - p0z;
    const float lenSq = dx * dx + dy * dy + dz * dz;

    emscripten::val result = emscripten::val::object();
    if (lenSq < 1e-12f) {
        result.set("x", p0x);
        result.set("y", p0y);
        result.set("z", p0z);
        return result;
    }

    const float t = std::clamp(
        ((qx - p0x) * dx + (qy - p0y) * dy + (qz - p0z) * dz) / lenSq,
        0.0f, 1.0f);

    result.set("x", p0x + t * dx);
    result.set("y", p0y + t * dy);
    result.set("z", p0z + t * dz);
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

    // Physics helpers
    emscripten::function("applyVelocityDamping",       &applyVelocityDamping);
    emscripten::function("applyVelocityDampingBatch",  &applyVelocityDampingBatch);
    emscripten::function("computeForceField",          &computeForceField);
    emscripten::function("computeForceFieldsBatch",    &computeForceFieldsBatch);
    emscripten::function("computeSpringForce",     &computeSpringForce);
    emscripten::function("reflectVelocity",        &reflectVelocity);
    emscripten::function("closestPointOnSegment",  &closestPointOnSegment);
}
