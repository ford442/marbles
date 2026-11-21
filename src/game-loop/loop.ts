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
    game: GameLoopHost;

    constructor(game: GameLoopHost) {
        this.game = game;
    }

    loop(): void {
        // Always update gamepads for pause toggle detection
        this.game.pollGamepads()

        const now = performance.now()
        const rawDt = this.game._lastLoopTime != null ? (now - this.game._lastLoopTime) / 1000 : 1 / 60
        this.game._lastLoopTime = now
        this.game.frameDt = Math.min(Math.max(rawDt, 0), MAX_FRAME_DT)

        // When paused, skip game logic but keep rendering
        if (this.game.isPaused) {
            this.game.simDt = 0
            this.game.physicsSubsteps = 0
            this.game.renderAndSync()
            requestAnimationFrame(() => this.game.loop())
            return
        }

        // Fixed-step contract: decide this frame's step count up front so
        // per-frame impulses can be scaled by the simulated time they cover.
        if (this.game.physicsClock) {
            this.game.physicsSubsteps = this.game.physicsClock.advance(this.game.frameDt)
            this.game.simDt = this.game.physicsClock.lastSimDt
        } else {
            this.game.physicsSubsteps = 1
            this.game.simDt = 1 / 60
        }

        if (this.game.mapEditor?.isActive && !this.game.mapEditor.isPlaytesting) {
            this.game.mapEditor.tick()
            this.game.renderAndSync()
            requestAnimationFrame(() => this.game.loop())
            return
        }

        this.game.updateGameState()
        this.game.renderAndSync()
        requestAnimationFrame(() => this.game.loop())
    }
}
