/** 3-D position or direction in world space. */
export interface Vec3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** Unit quaternion (x, y, z, w). */
export interface Quat {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
}

/** Column-major 4×4 transform matrix (Filament / WebGL convention). */
export type Mat4 = Float32Array;
