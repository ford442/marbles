import { audio } from '../audio.js';
import { quaternionToMat4 } from '../math.js';

export class GameLoopLoop {
    loop() {
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
