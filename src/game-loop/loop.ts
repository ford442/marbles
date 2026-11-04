import { MAX_FRAME_DT } from '../game/systems/fixed-step-clock.ts';

/** Game surface the top-level rAF loop drives. */
export interface GameLoopHost {
    isPaused: boolean
    mapEditor?: { isActive: boolean; isPlaytesting: boolean; tick(): void } | null
    physicsClock?: { advance(frameDtSec: number): number; readonly lastSimDt: number } | null
    _lastLoopTime?: number | null
    /** Wall-clock seconds since the previous frame (capped); drives energy meters and UI. */
    frameDt?: number
    /** Simulated seconds this frame's physics steps cover; scales continuous impulses. */
    simDt?: number
    /** Fixed physics steps `syncTransformsAndRender` runs this frame (main-thread mode). */
    physicsSubsteps?: number
    pollGamepads(): void
    updateGameState(): void
    renderAndSync(): void
    loop(): void
}

export class GameLoopLoop {
    loop(this: GameLoopHost): void {
        // Always update gamepads for pause toggle detection
        this.pollGamepads()

        const now = performance.now()
        const rawDt = this._lastLoopTime != null ? (now - this._lastLoopTime) / 1000 : 1 / 60
        this._lastLoopTime = now
        this.frameDt = Math.min(Math.max(rawDt, 0), MAX_FRAME_DT)

        // When paused, skip game logic but keep rendering
        if (this.isPaused) {
            this.simDt = 0
            this.physicsSubsteps = 0
            this.renderAndSync()
            requestAnimationFrame(() => this.loop())
            return
        }

        // Fixed-step contract: decide this frame's step count up front so
        // per-frame impulses can be scaled by the simulated time they cover.
        if (this.physicsClock) {
            this.physicsSubsteps = this.physicsClock.advance(this.frameDt)
            this.simDt = this.physicsClock.lastSimDt
        } else {
            this.physicsSubsteps = 1
            this.simDt = 1 / 60
        }

        if (this.mapEditor?.isActive && !this.mapEditor.isPlaytesting) {
            this.mapEditor.tick()
            this.renderAndSync()
            requestAnimationFrame(() => this.loop())
            return
        }

        this.updateGameState()
        this.renderAndSync()
        requestAnimationFrame(() => this.loop())
    }
}
