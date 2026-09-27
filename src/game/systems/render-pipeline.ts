import { GameLoopSyncMethods } from '../../game-loop/sync.js';

/** Game surface the render pipeline drives each frame (the remaining game-loop mixins). */
export interface RenderPipelineHost {
    perfMonitor?: { beginFrame(): void } | null;
    _lastRenderTick?: number;
    _lastHudStyleUpdate?: number;
    tickFrameInput(now: number, shouldUpdateHUD: boolean, frameDeltaSec: number, ...tuning: number[]): void;
    updateCamera(now: number, shouldUpdateHUD: boolean, frameDeltaSec: number, ...tuning: number[]): void;
    tickSceneDynamics(now: number): { culledPowerUps: unknown; culledCollectibles: unknown };
    tickActiveProjectiles(now: number): void;
    finalizeFrame(
        now: number,
        culledPowerUps: unknown,
        culledCollectibles: unknown,
        shouldUpdateHUD: boolean,
    ): void;
}

/** The part of `PhysicsWorld` the pipeline forwards to. */
export interface StaticBatchFlusher {
    flushStaticBatches(...args: unknown[]): unknown;
}

/**
 * Main-thread render orchestration. Filament and the optional simple-WebGL
 * backend stay behind the game runtime, while this class owns frame ordering.
 */
export class RenderPipeline {
    game: RenderPipelineHost;
    physicsWorld: StaticBatchFlusher | undefined;

    constructor(game: RenderPipelineHost, { physicsWorld }: { physicsWorld?: StaticBatchFlusher } = {}) {
        this.game = game;
        this.physicsWorld = physicsWorld;
    }

    renderAndSync(): void {
        const g = this.game;
        const now = Date.now();
        g.perfMonitor?.beginFrame();
        const frameDeltaSec = g._lastRenderTick ? (now - g._lastRenderTick) / 1000 : 1 / 60;
        g._lastRenderTick = now;
        const shouldUpdateHUD = (now - (g._lastHudStyleUpdate || 0)) >= 100;
        if (shouldUpdateHUD) g._lastHudStyleUpdate = now;

        g.tickFrameInput(now, shouldUpdateHUD, frameDeltaSec, 0.02, 0.5);
        g.updateCamera(now, shouldUpdateHUD, frameDeltaSec, 0.25, 0.001);
        const { culledPowerUps, culledCollectibles } = g.tickSceneDynamics(now);
        g.tickActiveProjectiles(now);
        g.finalizeFrame(now, culledPowerUps, culledCollectibles, shouldUpdateHUD);
        this.syncTransformsAndRender(now);
    }

    syncTransformsAndRender(now: number): unknown {
        return GameLoopSyncMethods.prototype.syncTransformsAndRender.call(this.game, now);
    }

    flushStaticBatches(...args: unknown[]): unknown {
        return this.physicsWorld!.flushStaticBatches(...args);
    }
}
