export class GameLoopRender {
    renderAndSync() {
        const now = Date.now()
        this.perfMonitor?.beginFrame()
        const INITIAL_FRAME_DELTA_SEC = 1 / 60
        const frameDeltaSec = this._lastRenderTick ? (now - this._lastRenderTick) / 1000 : INITIAL_FRAME_DELTA_SEC
        this._lastRenderTick = now
        const FOV_CHANGE_THRESHOLD = 0.25
        const ASPECT_CHANGE_THRESHOLD = 0.001
        const shouldUpdateHUD = (now - (this._lastHudStyleUpdate || 0)) >= 100
        if (shouldUpdateHUD) this._lastHudStyleUpdate = now
        let culledPowerUps = 0
        let culledCollectibles = 0
        const rotSpeed = 0.02
        const zoomSpeed = 0.5

        this.tickFrameInput(now, shouldUpdateHUD, frameDeltaSec, rotSpeed, zoomSpeed)
        this.updateCamera(now, shouldUpdateHUD, frameDeltaSec, FOV_CHANGE_THRESHOLD, ASPECT_CHANGE_THRESHOLD)
        const dynamicsCull = this.tickSceneDynamics(now)
        culledPowerUps = dynamicsCull.culledPowerUps
        culledCollectibles = dynamicsCull.culledCollectibles
        this.tickHudCooldownBars(now, shouldUpdateHUD)
        this.tickActiveProjectiles(now)
        this.finalizeFrame(now, culledPowerUps, culledCollectibles)
        this.syncTransformsAndRender(now)
    }
}

export function applyGameLoopRender(targetClass) {
    for (const name of Object.getOwnPropertyNames(GameLoopRender.prototype)) {
        if (name !== 'constructor') {
            targetClass.prototype[name] = GameLoopRender.prototype[name];
        }
    }
}
