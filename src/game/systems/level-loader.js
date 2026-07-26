/** First-class level lifecycle subsystem with explicit service dependencies. */
export class LevelLoader {
    constructor(game, {
        physicsWorld,
        marbleRegistry,
        assetRegistry,
        getLevelById,
        runtime,
        cleanupRuntime,
    }) {
        this.game = game;
        this.physicsWorld = physicsWorld;
        this.marbleRegistry = marbleRegistry;
        this.assetRegistry = assetRegistry;
        this.getLevelById = getLevelById;
        this.runtime = runtime;
        this.cleanupRuntime = cleanupRuntime;
    }

    getLevel(levelId) {
        return this.getLevelById(levelId);
    }

    loadLevel(...args) {
        return this.runtime.loadLevel.call(this.game, ...args);
    }

    clearLevel(...args) {
        return this.cleanupRuntime.clearLevel.call(this.game, ...args);
    }

    startLevelSequence(...args) {
        return this.runtime.startLevelSequence.call(this.game, ...args);
    }

    animateHUDIn(...args) {
        return this.runtime.animateHUDIn.call(this.game, ...args);
    }

    delay(...args) {
        return this.runtime.delay.call(this.game, ...args);
    }

    _waitUntil(...args) {
        return this.runtime._waitUntil.call(this.game, ...args);
    }

    createGhostMarble(...args) {
        return this.runtime.createGhostMarble.call(this.game, ...args);
    }
}

export default LevelLoader;
