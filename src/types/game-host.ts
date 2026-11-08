import type { AbilityHost } from '../game/systems/ability-system.ts';
import type { HudControllerHost } from '../game/systems/hud-controller.ts';
import type { InputSystemHost } from '../game/systems/input-system.ts';
import type { PhysicsBackendHost } from '../game/systems/physics-backend.ts';
import type { PhysicsQueriesHost } from '../game/systems/physics-queries.ts';
import type { PhysicsWorldHost } from '../game/systems/physics-world.ts';
import type { RenderPipelineHost } from '../game/systems/render-pipeline.ts';

/**
 * Everything the composed systems read from the game object: the intersection
 * of their `*Host` interfaces, and nothing else. `create-runtime.ts` takes this
 * type, so `new PhysicsWorld(host)` (and the rest) stop compiling if a field
 * one of them requires is no longer part of the contract.
 *
 * Deliberately **no index signature** (unlike `GameMixinHost`). Where two host
 * interfaces describe the same field differently, fix the owning interface so
 * the intersection stays honest rather than widening this type: the
 * compile-time checks in `game/create-runtime.types-test.ts` fail if any
 * member collapses to `never`.
 */
export type GameHost =
    & PhysicsWorldHost
    & InputSystemHost
    & AbilityHost
    & HudControllerHost
    & PhysicsBackendHost
    & PhysicsQueriesHost
    & RenderPipelineHost;
