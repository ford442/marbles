import type { Vec3 } from './geometry.js';

/** Scalar or batch physics helpers exposed by wasm-bridge (WASM or JS fallback). */
export interface MarblePhysicsApi {
    vec3Distance(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number;
    vec3DistanceSq(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number;
    vec3Dot(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number;
    vec3Length(x: number, y: number, z: number): number;
    vec3Normalize(x: number, y: number, z: number): Vec3;
    applyVelocityDamping(
        vx: number,
        vy: number,
        vz: number,
        dampingFactor: number,
        dt: number,
        maxSpeed: number,
    ): Vec3;
    applyVelocityDampingBatch(
        velocities: Float32Array,
        out: Float32Array,
        count: number,
        dampingFactor: number,
        dt: number,
        maxSpeed: number,
    ): void;
    computeForceField(
        fieldX: number,
        fieldY: number,
        fieldZ: number,
        marbleX: number,
        marbleY: number,
        marbleZ: number,
        strength: number,
        falloffExp: number,
        minDist: number,
        maxDist: number,
        softening?: number,
    ): Vec3;
    computeForceFieldInto(
        out: Float32Array | number[],
        fieldX: number,
        fieldY: number,
        fieldZ: number,
        marbleX: number,
        marbleY: number,
        marbleZ: number,
        strength: number,
        falloffExp: number,
        minDist: number,
        maxDist: number,
        softening?: number,
    ): void;
    computeForceFieldsBatch(
        positions: Float32Array,
        strengths: Float32Array,
        out: Float32Array,
        count: number,
        fieldX: number,
        fieldY: number,
        fieldZ: number,
        falloffExp: number,
        minDist: number,
        maxDist: number,
        softening?: number,
    ): void;
    computeSpringForce(
        marbleX: number,
        marbleY: number,
        marbleZ: number,
        anchorX: number,
        anchorY: number,
        anchorZ: number,
        restLength: number,
        stiffness: number,
        damping: number,
        velX: number,
        velY: number,
        velZ: number,
    ): Vec3;
    reflectVelocity(
        vx: number,
        vy: number,
        vz: number,
        nx: number,
        ny: number,
        nz: number,
        restitution: number,
    ): Vec3;
    closestPointOnSegment(
        p0x: number,
        p0y: number,
        p0z: number,
        p1x: number,
        p1y: number,
        p1z: number,
        qx: number,
        qy: number,
        qz: number,
    ): Vec3;
    computeSpringForcesBatch(
        positions: Float32Array,
        anchors: Float32Array,
        velocities: Float32Array,
        restLengths: Float32Array,
        stiffnesses: Float32Array,
        dampings: Float32Array,
        out: Float32Array,
        count: number,
    ): void;
    closestPointsOnSegmentBatch(
        p0: Float32Array,
        p1: Float32Array,
        q: Float32Array,
        out: Float32Array,
        count: number,
    ): void;
}

/** Emscripten module surface used by WasmBatchRunner. */
export interface MarblePhysicsWasmModule {
    _malloc(bytes: number): number;
    _free(ptr: number): void;
    HEAPF32: Float32Array;
    computeForceFieldsBatch(
        positionsPtr: number,
        strengthsPtr: number,
        forcesPtr: number,
        count: number,
        fieldX: number,
        fieldY: number,
        fieldZ: number,
        falloffExp: number,
        minDist: number,
        maxDist: number,
        softening: number,
    ): void;
    applyVelocityDampingBatch(
        velocitiesPtr: number,
        outPtr: number,
        count: number,
        dampingFactor: number,
        dt: number,
        maxSpeed: number,
    ): void;
    computeForceFieldOut(
        outPtr: number,
        fieldX: number,
        fieldY: number,
        fieldZ: number,
        marbleX: number,
        marbleY: number,
        marbleZ: number,
        strength: number,
        falloffExp: number,
        minDist: number,
        maxDist: number,
        softening: number,
    ): void;
    applyVelocityDampingOut(
        outPtr: number,
        vx: number,
        vy: number,
        vz: number,
        dampingFactor: number,
        dt: number,
        maxSpeed: number,
    ): void;
    computeSpringForceOut(
        outPtr: number,
        marbleX: number,
        marbleY: number,
        marbleZ: number,
        anchorX: number,
        anchorY: number,
        anchorZ: number,
        restLength: number,
        stiffness: number,
        damping: number,
        velX: number,
        velY: number,
        velZ: number,
    ): void;
    reflectVelocityOut(
        outPtr: number,
        vx: number,
        vy: number,
        vz: number,
        nx: number,
        ny: number,
        nz: number,
        restitution: number,
    ): void;
    closestPointOnSegmentOut(
        outPtr: number,
        p0x: number,
        p0y: number,
        p0z: number,
        p1x: number,
        p1y: number,
        p1z: number,
        qx: number,
        qy: number,
        qz: number,
    ): void;
    computeSpringForcesBatch(
        positionsPtr: number,
        anchorsPtr: number,
        velocitiesPtr: number,
        restLengthsPtr: number,
        stiffnessesPtr: number,
        dampingsPtr: number,
        outPtr: number,
        count: number,
    ): void;
    closestPointsOnSegmentBatch(
        p0Ptr: number,
        p1Ptr: number,
        qPtr: number,
        outPtr: number,
        count: number,
    ): void;
    vec3Distance(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number;
    vec3DistanceSq(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number;
    vec3Dot(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number;
    vec3Length(x: number, y: number, z: number): number;
    vec3Normalize(x: number, y: number, z: number): Vec3;
    applyVelocityDamping(
        vx: number,
        vy: number,
        vz: number,
        dampingFactor: number,
        dt: number,
        maxSpeed: number,
    ): Vec3;
    computeForceField(
        fieldX: number,
        fieldY: number,
        fieldZ: number,
        marbleX: number,
        marbleY: number,
        marbleZ: number,
        strength: number,
        falloffExp: number,
        minDist: number,
        maxDist: number,
        softening: number,
    ): Vec3;
    computeSpringForce(
        marbleX: number,
        marbleY: number,
        marbleZ: number,
        anchorX: number,
        anchorY: number,
        anchorZ: number,
        restLength: number,
        stiffness: number,
        damping: number,
        velX: number,
        velY: number,
        velZ: number,
    ): Vec3;
    reflectVelocity(
        vx: number,
        vy: number,
        vz: number,
        nx: number,
        ny: number,
        nz: number,
        restitution: number,
    ): Vec3;
    closestPointOnSegment(
        p0x: number,
        p0y: number,
        p0z: number,
        p1x: number,
        p1y: number,
        p1z: number,
        qx: number,
        qy: number,
        qz: number,
    ): Vec3;
}
