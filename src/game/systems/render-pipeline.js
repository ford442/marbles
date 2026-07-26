import { GameLoopSyncMethods } from '../../game-loop/sync.js';

/**
 * Main-thread render orchestration. Filament and the optional simple-WebGL
 * backend stay behind the game runtime, while this class owns frame ordering.
 */
export class RenderPipeline {
    constructor(game, { physicsWorld } = {}) {
        this.game = game;
        this.physicsWorld = physicsWorld;
    }

    renderAndSync() {
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

    syncTransformsAndRender(now) {
        return GameLoopSyncMethods.prototype.syncTransformsAndRender.call(this.game, now);
    }

    flushStaticBatches(...args) {
        return this.physicsWorld.flushStaticBatches(...args);
    }
}
