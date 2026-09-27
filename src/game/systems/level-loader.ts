import type { getLevel } from '../../levels/catalog.js';
import type { PhysicsWorld } from './physics-world.ts';
import type { MarbleRegistry } from './marble-registry.js';

/**
 * Level lifecycle methods still implemented against the game object
 * (`InitLevelLoader.prototype`); `LevelLoader` invokes them with the game as `this`.
 */
export interface LevelRuntime {
    loadLevel(levelId: string, options?: Record<string, unknown>): Promise<unknown>;
    startLevelSequence(options?: { startAtMs?: number; seed?: number }): Promise<unknown>;
    animateHUDIn(): void;
    delay(ms: number): Promise<void>;
    _waitUntil(targetMs: number): Promise<void>;
    createGhostMarble(): unknown;
}

/** Teardown methods still implemented against the game object (`InitCleanup.prototype`). */
export interface LevelCleanupRuntime {
    clearLevel(...args: unknown[]): unknown;
}

export interface LevelLoaderDeps {
    physicsWorld: PhysicsWorld;
    marbleRegistry: MarbleRegistry;
    assetRegistry: unknown;
    getLevelById: typeof getLevel;
    runtime: LevelRuntime;
    cleanupRuntime: LevelCleanupRuntime;
}

/** First-class level lifecycle subsystem with explicit service dependencies. */
export class LevelLoader {
    game: unknown;
    physicsWorld: PhysicsWorld;
    marbleRegistry: MarbleRegistry;
    assetRegistry: unknown;
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
        return this.runtime.loadLevel.call(this.game, ...args);
    }

    clearLevel(...args: unknown[]) {
        return this.cleanupRuntime.clearLevel.call(this.game, ...args);
    }

    startLevelSequence(...args: Parameters<LevelRuntime['startLevelSequence']>) {
        return this.runtime.startLevelSequence.call(this.game, ...args);
    }

    animateHUDIn() {
        return this.runtime.animateHUDIn.call(this.game);
    }

    delay(ms: number) {
        return this.runtime.delay.call(this.game, ms);
    }

    _waitUntil(targetMs: number) {
        return this.runtime._waitUntil.call(this.game, targetMs);
    }

    createGhostMarble() {
        return this.runtime.createGhostMarble.call(this.game);
    }
}

export default LevelLoader;
