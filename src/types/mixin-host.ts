import type RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsQueries } from '../game/systems/physics-queries.ts';
import type { FilamentHandle, FilamentModule } from './filament.ts';

/**
 * `this` for `@ts-check`'d mixin methods (`/** @this {GameMixinHost} *\/`).
 *
 * The physics-facing members are typed for real so Rapier's `.d.ts` checks
 * raycasts, impulses and body access. Everything else on the game object is
 * still untyped (`any`) until the owning slice migrates.
 */
export interface MixinMarble {
    rigidBody: RAPIER.RigidBody;
    collider?: RAPIER.Collider | null;
    scale: number;
    [key: string]: any;
}

export interface GameMixinHost {
    world: RAPIER.World;
    physicsQueries: PhysicsQueries;
    playerMarble: MixinMarble | null;
    marbles: MixinMarble[];
    aimYaw: number;
    pitchAngle: number;
    Filament: FilamentModule;
    engine: FilamentHandle;
    scene: FilamentHandle;
    /** Wall-clock seconds since the previous frame. */
    frameDt?: number;
    /** Simulated seconds this frame's fixed steps cover. */
    simDt?: number;
    [key: string]: any;
}
