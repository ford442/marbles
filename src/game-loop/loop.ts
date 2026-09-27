/** Game surface the top-level rAF loop drives. */
export interface GameLoopHost {
    isPaused: boolean
    mapEditor?: { isActive: boolean; isPlaytesting: boolean; tick(): void } | null
    pollGamepads(): void
    updateGameState(): void
    renderAndSync(): void
    loop(): void
}

export class GameLoopLoop {
    loop(this: GameLoopHost): void {
        // Always update gamepads for pause toggle detection
        this.pollGamepads()

        // When paused, skip game logic but keep rendering
        if (this.isPaused) {
            this.renderAndSync()
            requestAnimationFrame(() => this.loop())
            return
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
