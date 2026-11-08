import { assetRegistry } from '../assets/AssetRegistry.js';
import { getLevel } from '../levels/catalog.js';
import { InitCleanup } from '../init/cleanup.js';
import { InitLevelLoader } from '../init/level-loader.js';
import type { GameHost } from '../types/game-host.ts';
import { AbilitySystem } from './systems/ability-system.ts';
import { HudController } from './systems/hud-controller.ts';
import { InputSystem } from './systems/input-system.ts';
import { LevelLoader } from './systems/level-loader.ts';
import { MarbleRegistry } from './systems/marble-registry.js';
import { PhysicsWorld } from './systems/physics-world.ts';
import { GamePhysicsQueries } from './systems/physics-queries.ts';
import { RenderPipeline } from './systems/render-pipeline.ts';

/** The composed subsystems (Phase B) that `MarblesGame` delegates to. */
export interface GameRuntime {
    physicsQueries: GamePhysicsQueries;
    physicsWorld: PhysicsWorld;
    inputSystem: InputSystem;
    marbleRegistry: MarbleRegistry;
    abilitySystem: AbilitySystem;
    renderPipeline: RenderPipeline;
    levelLoader: LevelLoader;
    hudController: HudController;
}

/**
 * Build the composed systems against `host` and install each one on it as soon
 * as it exists: later constructors read earlier systems off the host (the HUD
 * asks `host.abilitySystem` for key labels while building its icons), so the
 * order below is load-bearing. `main.js` keeps DOM/boot, creates
 * `host.physicsClock`, and calls this once.
 *
 * Every constructor takes the *typed* `GameHost`, so a field a system requires
 * but `GameHost` lacks is a compile error here, not an `undefined` at runtime.
 * `MarbleRegistry` and `LevelLoader` still accept an untyped game object.
 */
export function createRuntime(host: GameHost): GameRuntime {
    const slots = host as GameHost & Partial<GameRuntime>;

    const physicsQueries = (slots.physicsQueries = new GamePhysicsQueries(host));
    const physicsWorld = (slots.physicsWorld = new PhysicsWorld(host));
    const inputSystem = (slots.inputSystem = new InputSystem(host));
    const marbleRegistry = (slots.marbleRegistry = new MarbleRegistry(host));
    const abilitySystem = (slots.abilitySystem = new AbilitySystem(host));
    const renderPipeline = (slots.renderPipeline = new RenderPipeline(host, { physicsWorld }));
    const levelLoader = (slots.levelLoader = new LevelLoader(host, {
        physicsWorld,
        marbleRegistry,
        assetRegistry,
        getLevelById: getLevel,
        runtime: InitLevelLoader.prototype,
        cleanupRuntime: InitCleanup.prototype,
    }));
    const hudController = (slots.hudController = new HudController(host));

    return {
        physicsQueries,
        physicsWorld,
        inputSystem,
        marbleRegistry,
        abilitySystem,
        renderPipeline,
        levelLoader,
        hudController,
    };
}
