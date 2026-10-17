import type { Vec3 } from '../../types/geometry.ts';

/** A Rapier `RigidBody` or worker proxy that can take impulses. */
export interface ImpulseBody {
    mass(): number;
    applyImpulse(impulse: Vec3, wake: boolean): void;
}

/**
 * Change a body's velocity by `dv` (m/s) regardless of its mass. Marble masses
 * span ~0.05 to ~140 000, so ability tuning is expressed as Δv and converted
 * here rather than as raw impulses.
 */
export function applyVelocityChange(rb: ImpulseBody, dv: Vec3, wake = true): void {
    const mass = rb.mass();
    if (!(mass > 0)) return;
    rb.applyImpulse({ x: dv.x * mass, y: dv.y * mass, z: dv.z * mass }, wake);
}

/**
 * Apply an acceleration (m/s²) for `dt` simulated seconds — the impulse form of
 * a continuous force, so it is frame-rate independent.
 */
export function applyAcceleration(rb: ImpulseBody, accel: Vec3, dt: number, wake = true): void {
    if (!(dt > 0)) return;
    applyVelocityChange(rb, { x: accel.x * dt, y: accel.y * dt, z: accel.z * dt }, wake);
}
