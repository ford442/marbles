import type { AssetRegistry } from '../../assets/AssetRegistry.js';
import type { getLevel } from '../../levels/catalog.js';
import type { PhysicsWorld } from './physics-world.ts';
import type { MarbleRegistry } from './marble-registry.js';

/** Party Race start (`NetworkClient.onStarting`): shared countdown deadline and race seed. */
export interface LevelStartOptions {
    startAtMs?: number;
    seed?: number;
}

/**
 * Level lifecycle methods implemented by the composed `InitLevelLoader` slice
 * (`init/level-loader.js`), constructed against the same game.
 */
export interface LevelRuntime {
    /** Resolves `false` when called before boot finished; otherwise once the countdown starts the run. */
    loadLevel(levelId: string, options?: LevelStartOptions): Promise<false | undefined>;
    startLevelSequence(options?: LevelStartOptions): Promise<void>;
    animateHUDIn(): void;
    delay(ms: number): Promise<void>;
    _waitUntil(targetMs: number): Promise<void>;
    createGhostMarble(): void;
}

/** Teardown implemented by the composed `InitCleanup` slice (`init/cleanup.js`). */
export interface LevelCleanupRuntime {
    clearLevel(...args: unknown[]): unknown;
}

export interface LevelLoaderDeps {
    physicsWorld: PhysicsWorld;
    marbleRegistry: MarbleRegistry;
    assetRegistry: AssetRegistry;
    getLevelById: typeof getLevel;
    runtime: LevelRuntime;
    cleanupRuntime: LevelCleanupRuntime;
}

/** First-class level lifecycle subsystem with explicit service dependencies. */
export class LevelLoader {
    game: unknown;
    physicsWorld: PhysicsWorld;
    marbleRegistry: MarbleRegistry;
    assetRegistry: AssetRegistry;
    getLevelById: typeof getLevel;
    runtime: LevelRuntime;
    cleanupRuntime: LevelCleanupRuntime;

    constructor(game: unknown, {
        physicsWorld,
        marbleRegistry,
        assetRegistry,
        getLevelById,
        runtime,
        cleanupRuntime,
    }: LevelLoaderDeps) {
        this.game = game;
        this.physicsWorld = physicsWorld;
        this.marbleRegistry = marbleRegistry;
        this.assetRegistry = assetRegistry;
        this.getLevelById = getLevelById;
        this.runtime = runtime;
        this.cleanupRuntime = cleanupRuntime;
    }

    getLevel(levelId: string) {
        return this.getLevelById(levelId);
    }

    loadLevel(...args: Parameters<LevelRuntime['loadLevel']>) {
        return this.runtime.loadLevel(...args);
    }

    clearLevel(...args: unknown[]) {
        return this.cleanupRuntime.clearLevel(...args);
    }

    startLevelSequence(...args: Parameters<LevelRuntime['startLevelSequence']>) {
        return this.runtime.startLevelSequence(...args);
    }

    animateHUDIn() {
        return this.runtime.animateHUDIn();
    }

    delay(ms: number) {
        return this.runtime.delay(ms);
    }

    _waitUntil(targetMs: number) {
        return this.runtime._waitUntil(targetMs);
    }

    createGhostMarble() {
        return this.runtime.createGhostMarble();
    }
}

export default LevelLoader;
